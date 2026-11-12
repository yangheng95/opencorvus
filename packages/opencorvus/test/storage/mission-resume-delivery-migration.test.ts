import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { materializeMissionAcceptanceGap } from "@/mission/acceptance-gap"
import { MissionTaskResumeReceiptSchema } from "@/mission/acceptance-resume-receipt"
import {
  deriveEngineArtifactCatalogMetadata,
  engineArtifactCatalogMetadataSHA256,
} from "@/engine/artifact-catalog-metadata"
import { DATABASE_MIGRATIONS } from "@/storage/migrations"
import { migrateSchema, schemaVersion } from "@/storage/schema-migration"

test("version ten and the current schema preserve historical no-delivery receipts through migration, backup and reopen", () => {
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw Error("Migration requires the isolated repository runner")
  const directory = fs.mkdtempSync(path.join(root, "resume-delivery-migration-")),
    databasePath = path.join(directory, "history.db")
  const sqlite = new SQLite(databasePath)
  sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000")
  const query = (sql: string, ...bindings: any[]): any[] => {
    const statement = sqlite.query(sql)
    try {
      return statement.all(...bindings)
    } finally {
      statement.finalize()
    }
  }
  try {
    sqlite.exec(DATABASE_MIGRATIONS[8]!.ddl)
    sqlite.exec("PRAGMA user_version=9")
    sqlite.run(
      "INSERT INTO project(id,worktree,time_created,time_updated,sandboxes,generation) VALUES('project',?,1,2,'[]',?)",
      [directory, randomUUID()],
    )
    sqlite.run(
      "INSERT INTO session(id,project_id,slug,directory,title,version,kind,time_created,time_updated) VALUES('session','project','retained',?,'原会话','1','root',1,2)",
      [directory],
    )
    sqlite.run(
      "INSERT INTO engine_task(id,project_id,session_id,product_pillar,title,request,time_created) VALUES('task','project','session','work','历史任务','保留原始请求',1)",
    )
    const terminal = { terminalEventID: "pev_historical_terminal" },
      locator = {
        source: "engine_artifact" as const,
        artifact_id: "art_historical_evidence",
        catalog_revision: 1,
        expected_sha256: "a".repeat(64),
      }
    const gap = materializeMissionAcceptanceGap({
      reviewedTerminalLifecycleReference: terminal,
      evidenceByReadReference: new Map([["ar_historical", locator]]),
      gap: {
        gap_id: "historical-gap",
        current_ledger_revision_artifact_id: null,
        criteria: [
          {
            criterion_id: "input",
            state: "open",
            disposition: "unresolved",
            finding: "历史修复",
            responsibility: { kind: "task_initialization", failure_reference: terminal },
            observation_evidence_read_refs: ["ar_historical"],
            repair_evidence_read_refs: [],
            resolution_evidence_read_refs: [],
            invalidating_evidence_read_refs: [],
            irreducible_blocker_evidence_read_refs: [],
            repair_action: { operation: "repair", target: "input", expected_evidence_kind: "input", parameters: {} },
          },
        ],
      },
    })
    const old = MissionTaskResumeReceiptSchema.parse({
      protocol: "mission-acceptance-resume-receipt",
      task_id: "task",
      mission_id: "mission",
      mission_session_id: "mission-session",
      panel_message_id: "panel-message",
      tool_call_id: "historical-call",
      tool_part_id: "historical-part",
      message_id: "repair-message",
      wake_id: "repair-message",
      ingress_artifact_id: "ingress",
      acceptance_ledger_revision_artifact_id: "ledger",
      prior_terminal_lifecycle_reference: terminal,
      acceptance_gap: gap,
      time_accepted: 100,
    })
    const payload = JSON.stringify(old),
      index = deriveEngineArtifactCatalogMetadata({ kind: "mission_acceptance_resume_receipt", payloadText: payload })
    sqlite.run("INSERT INTO engine_artifact_catalog_revision DEFAULT VALUES")
    const values = {
      id: "receipt",
      task_id: "task",
      kind: "mission_acceptance_resume_receipt",
      label: "accepted",
      payload,
      ...index,
      catalog_metadata_sha256: engineArtifactCatalogMetadataSHA256({
        artifact_id: "receipt",
        task_id: "task",
        kind: "mission_acceptance_resume_receipt",
        label_index: "accepted",
        time_created: 100,
        time_updated: 100,
        ...index,
      }),
      catalog_revision: 1,
      time_created: 100,
      time_updated: 100,
    }
    const columns = Object.keys(values)
    sqlite.run(
      `INSERT INTO engine_artifact(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
      Object.values(values).map((value) =>
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : typeof value === "boolean"
            ? Number(value)
            : value,
      ),
    )
    const before = {
      receipt: query("SELECT * FROM engine_artifact"),
      task: query("SELECT * FROM engine_task"),
      session: query("SELECT * FROM session"),
    }
    const migrate = (migrations = DATABASE_MIGRATIONS) =>
      migrateSchema({
        sqlite,
        databasePath,
        migrations,
        currentDDL: migrations.at(-1)!.ddl,
        validate() {},
      })
    const receipt = migrate(DATABASE_MIGRATIONS.slice(0, 10))
    expect({ from: receipt.from, to: receipt.to, version: schemaVersion(sqlite) }).toEqual({
      from: 9,
      to: 10,
      version: 10,
    })
    expect({
      receipt: query("SELECT * FROM engine_artifact"),
      task: query("SELECT * FROM engine_task"),
      session: query("SELECT * FROM session"),
    }).toEqual(before)
    expect(
      MissionTaskResumeReceiptSchema.parse(JSON.parse(query("SELECT payload FROM engine_artifact")[0].payload)),
    ).toEqual(old)
    const backup = new SQLite(receipt.backupPath!, { readonly: true })
    try {
      expect(backup.query("SELECT payload FROM engine_artifact").get()).toEqual({ payload })
      expect(schemaVersion(backup)).toBe(9)
    } finally {
      backup.close(true)
    }
    const target = DATABASE_MIGRATIONS.at(-1)!.version
    const upgrade = migrate()
    expect({ from: upgrade.from, to: upgrade.to, version: schemaVersion(sqlite) }).toEqual({
      from: 10,
      to: target,
      version: target,
    })
    const repeat = migrate()
    expect({ from: repeat.from, to: repeat.to }).toEqual({ from: target, to: target })
    expect(() =>
      migrateSchema({
        sqlite,
        databasePath,
        migrations: DATABASE_MIGRATIONS.slice(0, 9),
        currentDDL: DATABASE_MIGRATIONS[8]!.ddl,
        validate() {},
      }),
    ).toThrow(expect.objectContaining({ code: "SCHEMA_VERSION_AHEAD" }))
    sqlite.close(true)
    const reopened = new SQLite(databasePath, { readonly: true })
    try {
      expect(schemaVersion(reopened)).toBe(target)
      expect({
        receipt: reopened.query("SELECT * FROM engine_artifact").all(),
        task: reopened.query("SELECT * FROM engine_task").all(),
        session: reopened.query("SELECT * FROM session").all(),
      }).toEqual(before)
    } finally {
      reopened.close(true)
    }
  } finally {
    sqlite.close(true)
    const relative = path.relative(path.resolve(root), path.resolve(directory))
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
      throw Error("Migration cleanup escaped its isolated root")
    fs.rmSync(directory, { recursive: true })
  }
})
