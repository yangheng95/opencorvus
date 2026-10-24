import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import { validateHistoricalPermissionMemoryDeliveries } from "@/storage/migrations/0005-atomic-permission-memory"

// Focused SQL selection contracts. The old-source/process upgrade checker in
// specs/artifacts separately exercises the actual schema and public HTTP path.
function fixture(input: { taskID?: string | null; human?: boolean; phase?: string } = {}) {
  const sqlite = new SQLite(":memory:")
  sqlite.exec(`
    CREATE TABLE permission_ledger(request_id TEXT,event_type TEXT,task_id TEXT);
    CREATE TABLE bus_publication_outbox(occurrence_id TEXT,event_type TEXT,properties TEXT);
    CREATE TABLE bus_publication_delivery_receipt(occurrence_id TEXT,phase TEXT,subscriber_id TEXT,outcome TEXT);
    CREATE TABLE bus_publication_phase_receipt(occurrence_id TEXT,phase TEXT);
    CREATE TABLE engine_control_activation_lease(target TEXT,target_id TEXT);
  `)
  sqlite.run("INSERT INTO permission_ledger VALUES(?,?,?)", ["request", "requested", input.taskID === undefined ? "task" : input.taskID])
  sqlite.run("INSERT INTO bus_publication_outbox VALUES(?,?,?)", ["original", "permission.replied", JSON.stringify({
    requestID: "request", ...(input.human === false ? {} : { userInput: { surface: "test.operator", text: "Original human input" } }),
  })])
  const subscriber = "engine.interaction.permission-replied", phase = input.phase ?? "exact"
  return {
    sqlite,
    lease() { sqlite.run("INSERT INTO engine_control_activation_lease VALUES(?,?)", ["bus_delivery", `original\0${phase}\0${subscriber}`]) },
    receipt(outcome: string) { sqlite.run("INSERT INTO bus_publication_delivery_receipt VALUES(?,?,?,?)", ["original", phase, subscriber, outcome]) },
    settledPhase() { sqlite.run("INSERT INTO bus_publication_phase_receipt VALUES(?,?)", ["original", phase]) },
    rows() { return ["permission_ledger", "bus_publication_outbox", "bus_publication_delivery_receipt", "bus_publication_phase_receipt", "engine_control_activation_lease"]
      .map(name => ({ name, rows: sqlite.query(`SELECT * FROM ${name}`).all() })) },
    [Symbol.dispose]() { sqlite.close(true) },
  }
}

for (const state of ["unattempted", "succeeded", "automatic", "standalone", "other-phase"] as const) {
  test(`the v5 selector accepts the original ${state} delivery facts unchanged`, () => {
    using value = fixture({ ...(state === "automatic" ? { human: false } : {}),
      ...(state === "standalone" ? { taskID: null } : {}), ...(state === "other-phase" ? { phase: "global" } : {}) })
    if (state !== "unattempted") value.lease()
    if (state === "succeeded") { value.receipt("succeeded"); value.settledPhase() }
    if (state === "other-phase") { value.receipt("failed"); value.settledPhase() }
    const original = value.rows()
    const result = validateHistoricalPermissionMemoryDeliveries(value.sqlite)
    expect({ result, facts: value.rows() }).toEqual({ result: undefined, facts: original })
  })
}

for (const state of ["leased", "failed", "ignored", "bypassed"] as const) {
  test(`the v5 selector maps ${state} human delivery to the explicit original-evidence error`, () => {
    using value = fixture()
    if (state === "leased") value.lease()
    else if (state === "bypassed") value.settledPhase()
    else value.receipt(state)
    const original = value.rows()
    expect(() => validateHistoricalPermissionMemoryDeliveries(value.sqlite)).toThrow(expect.objectContaining({
      name: "SchemaMigrationError", code: "SCHEMA_MIGRATION_REQUIRED",
      message: expect.stringContaining('[{"occurrence_id":"original","request_id":"request"}]'),
    }))
    expect(value.rows()).toEqual(original)
  })
}
