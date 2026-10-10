import fs from "node:fs"
import { Database } from "bun:sqlite"
const output = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/research-source-277"
const db = new Database("C:/Users/hengu/AppData/Local/opencorvus/data/opencorvus.db", { readonly: true })
try {
  db.exec("BEGIN")
  const taskID = "tsk_g00VXMejke00KwIb9xRv"
  const worker = "ses_h0crs8qatiIhgesOsaX1"
  const failures = (db.query("SELECT id,payload,time_created FROM engine_artifact WHERE task_id=? AND kind='task-infrastructure-error' ORDER BY time_created,id").all(taskID) as any[]).map((row) => ({ id: row.id, timeCreated: row.time_created, ...JSON.parse(row.payload) }))
  const descriptors = (db.query("SELECT id,payload FROM worker_turn_descriptor WHERE session_id=? ORDER BY time_created,id").all(worker) as any[]).map((row) => {
    const payload = JSON.parse(row.payload)
    return { id: row.id, dispatchID: payload.dispatchTurn.current_dispatch_id, initialUserMessageID: payload.dispatchTurn.task_authority.initial_user_message_id, initialControlPartIDs: payload.dispatchTurn.task_authority.initial_control_text_parts.map((part: any) => part.part_id) }
  })
  const checkpoints = (db.query("SELECT p.id,p.data,m.id AS messageID,m.data AS messageData FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? AND json_extract(p.data,'$.type')='compaction' ORDER BY p.time_created,p.id").all(worker) as any[]).map((row) => {
    const part = JSON.parse(row.data)
    const summary = JSON.parse(row.messageData)
    const anchor = db.query("SELECT data FROM message WHERE id=?").get(part.anchor_id) as any
    const anchorMessage = JSON.parse(anchor.data)
    return { partID: row.id, summaryMessageID: row.messageID, sourceUserMessageID: summary.parentID, anchorMessageID: part.anchor_id, tailStartID: part.tail_start_id, completedAt: summary.time?.completed, anchorDescriptorID: anchorMessage.extra?.workerTurnDescriptor?.id }
  })
  const terminal = db.query("SELECT id,type,source,emitted_at,payload FROM protocol_event WHERE id='pev_g0VXPigX300oLaV5z1Kq'").get() as any
  const terminalPayload = JSON.parse(terminal.payload)
  const index = db.query("SELECT name,sql FROM sqlite_schema WHERE type='index' AND name='engine_dispatch_lineage_initial_workflow_node_idx'").get()
  const result = {
    observedAtUtc: new Date().toISOString(),
    access: "Original readonly exact infrastructure artifacts, descriptor boundaries and checkpoint identity; terminal model-written explanation is retained only as private source, not asserted as a cause",
    taskID, workerSessionID: worker, failures, descriptors, checkpoints,
    terminal: { id: terminal.id, type: terminal.type, source: terminal.source, emittedAt: terminal.emitted_at, epoch: terminalPayload.execution_epoch, summaryChars: terminalPayload.summary.length, errorChars: terminalPayload.error.length },
    unexpectedSchemaObject: index,
    currentRepairRecord: "specs/records/2026-10/2026-10-08-compaction-window-and-task-anchor.md",
    currentRepairCommits: ["4dd8f2c2", "0784ba8a7"],
    boundary: "Direct historical failure evidence; current repairs already exist. Bad immutable old markers and old source schema are retained. No new execution, historical rewrite or current original child visual acceptance.",
  }
  fs.writeFileSync(`${output}/error-facts.json`, JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ historicalFailures: failures.length, descriptors: descriptors.length, checkpoints: checkpoints.length, terminal: result.terminal.type, immutableInitialMessageIDs: [...new Set(descriptors.map((descriptor) => descriptor.initialUserMessageID))] }))
} finally { db.exec("ROLLBACK"); db.close() }
