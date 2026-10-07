import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { State } from "@/project/state"
import { Log } from "@/util/log"
import { Global } from "@/global"
import { SkillReadDiagnostics as Diagnostics } from "@/skill/read-diagnostics"
import { DurablePublicationStore } from "@opencorvus-ai/util/durable-publication"

async function rows(ids: Array<string | null>) {
  await Log.flush()
  return (await fs.readFile(Log.file(), "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.service === "skill-read-diagnostics" && ids.includes(entry.data.http.requestID))
    .map((entry) => entry.data)
}

test("startup initialization and late causal work have their actual request lifetime", async () => {
  const before = (await rows([null])).length
  const state = State.create(
    () => crypto.randomUUID(),
    () => Diagnostics.initialize("config", () => Promise.resolve(7)),
    undefined,
    "diagnostic-startup",
  )
  expect(await Diagnostics.readState("config", state)).toBe(7)
  const initialized = (await rows([null]))
    .slice(before)
    .filter((entry) => entry.phase === "state.initialize" && entry.status === "completed")
  expect(
    initialized.map((entry) => ({ origin: entry.origin, request: entry.http.requestID, outcome: entry.outcome })),
  ).toEqual([{ origin: "startup-or-unattributed", request: null, outcome: "fulfilled" }])
  const id = crypto.randomUUID()
  const hold = Promise.withResolvers<void>()
  let background!: Promise<number>
  expect(
    await Diagnostics.request(id, () => {
      background = (async () => {
        await hold.promise
        return Diagnostics.phase("matrix.registry", () => 42)
      })()
      return Promise.resolve("request-settled")
    }),
  ).toBe("request-settled")
  hold.resolve()
  expect(await background).toBe(42)
  const later = (await rows([id])).find((entry) => entry.phase === "matrix.registry" && entry.status === "completed")
  expect({ request: later.http.requestID, settled: later.http.requestSettled, outcome: later.outcome }).toEqual({
    request: id,
    settled: true,
    outcome: "fulfilled",
  })
})

test("diagnostics retain actual State promise identity and one creator with distinct join and cache reads", async () => {
  await Log.init({ print: false, dev: true, level: "DEBUG" })
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const value = { count: 32 }
  const state = State.create(
    () => ids[0]!,
    () =>
      Diagnostics.initialize("inventory", async () => {
        await pending
        await Diagnostics.aggregate("risk.scripts", () => Promise.resolve(["owned-a", "owned-b"]))
        return value
      }),
    undefined,
    "diagnostic-inventory",
  )
  const first = Diagnostics.request(ids[0]!, () => Diagnostics.readState("inventory", state))
  const second = Diagnostics.request(ids[1]!, () => Diagnostics.readState("inventory", state))
  expect(first).toBe(state())
  expect(second).toBe(first)
  release()
  expect(await first).toBe(value)
  expect(await second).toBe(value)
  const cached = Diagnostics.request(ids[2]!, () => Diagnostics.readState("inventory", state))
  expect(cached).toBe(first)
  expect(await cached).toBe(value)
  const events = await rows(ids)
  const initialized = events.filter((entry) => entry.phase === "state.initialize" && entry.status === "completed")
  expect(initialized.length).toBe(1)
  expect(initialized[0].http.requestID).toBe(ids[0])
  expect(initialized[0].aggregates["risk.scripts"]).toMatchObject({ count: 1, items: 2, rejected: 0 })
  expect(
    events
      .filter((entry) => entry.phase === "state.read" && entry.status === "completed")
      .map((entry) => ({
        request: entry.http.requestID,
        disposition: entry.disposition,
        initializer: entry.initializerID,
        creator: entry.creatorRequestID,
      })),
  ).toEqual(
    ids.map((id, index) => ({
      request: id,
      disposition: ["creator", "join-pending", "cached-settled"][index],
      initializer: initialized[0].spanID,
      creator: ids[0],
    })),
  )
  await state.reset()
})

test("diagnostics preserve the original State rejection and observe its successful new initializer on retry", async () => {
  const ids = [crypto.randomUUID(), crypto.randomUUID()]
  const failure = new Error("owned fixture error")
  let attempts = 0
  const state = State.create(
    () => ids[0]!,
    () =>
      Diagnostics.initialize("skill", () => {
        attempts++
        return attempts === 1 ? Promise.reject(failure) : Promise.resolve({ revision: "retry-completed" })
      }),
    undefined,
    "diagnostic-retry",
  )
  const first = Diagnostics.request(ids[0]!, () => Diagnostics.readState("skill", state))
  expect(await first.catch((error) => error)).toBe(failure)
  const next = Diagnostics.request(ids[1]!, () => Diagnostics.readState("skill", state))
  expect(await next).toEqual({ revision: "retry-completed" })
  expect(attempts).toBe(2)
  const events = await rows(ids)
  expect(
    events
      .filter((entry) => entry.phase === "state.initialize" && entry.status === "completed")
      .map((entry) => ({ outcome: entry.outcome, errorType: entry.errorType ?? null })),
  ).toEqual([
    { outcome: "rejected", errorType: "error" },
    { outcome: "fulfilled", errorType: null },
  ])
  await state.reset()
})

test("catalog diagnostics preserve real durable owner results and balanced failure phases", async () => {
  const ids = [crypto.randomUUID(), crypto.randomUUID()]
  const root = await fs.mkdtemp(path.join(Global.Path.temporary, "skill-read-owner-"))
  const store = new DurablePublicationStore(root)
  const failure = new Error("owned projection failure")
  const run = <T>(fn: () => Promise<T>) =>
    Diagnostics.catalogOwner((owned) => store.withSubjectLock("diagnostic", "catalog", owned), fn)
  expect(await Diagnostics.request(ids[0]!, () => run(() => Promise.resolve({ revision: 1 })))).toEqual({ revision: 1 })
  expect(
    await Diagnostics.request(ids[1]!, () =>
      run(() => {
        throw failure
      }),
    ).catch((error) => error),
  ).toBe(failure)
  const events = await rows(ids)
  for (const id of ids) {
    const selected = events.filter((entry) => entry.http.requestID === id)
    const complete = selected.filter((entry) => entry.status === "completed")
    expect(complete.map((entry) => entry.phase).sort()).toEqual([
      "catalog.admission",
      "catalog.held",
      "catalog.release",
      "catalog.total",
      "request",
    ])
    expect(
      selected
        .filter((entry) => entry.status === "started")
        .map((entry) => entry.spanID)
        .sort(),
    ).toEqual(complete.map((entry) => entry.spanID).sort())
    expect(complete.find((entry) => entry.phase === "catalog.total")?.outcome).toBe(
      id === ids[0] ? "fulfilled" : "rejected",
    )
  }
  await Log.init({ print: false, dev: true, level: "INFO" })
  const original = Promise.resolve("same operation result")
  expect(Diagnostics.phase("matrix.inventory", () => original)).toBe(original)
  expect(await Diagnostics.readState("inventory", () => original)).toBe("same operation result")
  await Log.init({ print: false, dev: true, level: "DEBUG" })
})
