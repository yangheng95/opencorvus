import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/text-part-time-live-252-live-01"
const evidence = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/text-part-time-live-252/live-01"
const partID = "prt_g0VXaVSJM00Pg5SIg81t"
const before = JSON.parse(fs.readFileSync(path.join(evidence, "running-canonical-metadata.json"), "utf8"))
const running = before.parts.find((part: any) => part.id === partID)
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const row = db.query("SELECT id,message_id,data FROM part WHERE id=?").get(partID) as any
  const data = JSON.parse(row.data)
  const message = db.query("SELECT id,session_id,data FROM message WHERE id=?").get(row.message_id) as any
  const info = JSON.parse(message.data)
  const user = db.query("SELECT data FROM part WHERE message_id=? AND json_extract(data,'$.type')='text'").get("msg_315bd338-6e21-439f-b20e-6fb230a07bad") as any
  const intent = fs.readFileSync(path.join(evidence, "submitted-intent.txt"), "utf8")
  const result = {
    observedAtUtc: new Date().toISOString(), access: "Actual original completed SQLite readonly BEGIN/ROLLBACK after physical closure",
    partID, messageID: row.message_id, sessionID: message.session_id,
    running: { observedAt: before.observedAtUtc, chars: running.textChars, time: running.time },
    completed: { chars: data.text.length, time: data.time, messageTime: info.time, finish: info.finish },
    preservedActualStart: running.time.start === data.time.start,
    actualSpanMs: data.time.end - data.time.start,
    directlyAcceptedIntent: JSON.parse(user.data).text === intent,
    sessions: db.query("SELECT id,kind,parent_id FROM session ORDER BY time_created,id").all(),
    boundary: "Same real persisted Part before and after natural completion; full time numbers, no hashes, UI assertions or invented start/end. Running metadata retains length only, so this check does not claim full prefix byte identity."
  }
  fs.writeFileSync(path.join(evidence, "actual-clock-readback.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
  if (row.id !== running.id || row.message_id !== running.messageID || message.session_id !== running.sessionID || data.type !== "text" || !result.preservedActualStart || !Number.isFinite(result.actualSpanMs) || result.actualSpanMs <= 0 || info.finish !== "stop" || !Number.isFinite(info.time.completed) || !result.directlyAcceptedIntent) throw new Error("Actual current text completion contract differs; evidence retained")
  console.log(JSON.stringify(result))
} finally {
  db.exec("ROLLBACK")
  db.close()
}
