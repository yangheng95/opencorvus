const fs = require("node:fs")
const path = require("node:path")
const os = require("node:os")
const zlib = require("node:zlib")
const assert = require("node:assert/strict")
const { Database } = require("bun:sqlite")
const names = process.argv.slice(2)
assert(names.length > 0, "Supply completed policy run names")
for (const name of names) {
  assert(/^(?:cross-model-policy-revisions(?:-range|-sol)?|hierarchy-policy-revisions-luna(?:-retry[0-9]+)?)$/.test(name))
  const reportPath = path.join(__dirname, `${name}.json`)
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))
  assert(["passed", "failed", "error"].includes(report.status))
  const runtime = fs.realpathSync(report.runtime), relative = path.relative(os.tmpdir(), runtime)
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative))
  assert(path.basename(runtime).startsWith("opencorvus-compaction-stress-"))
  const dataRoot = path.join(runtime, "runtime/data")
  const credentialCleanup = ["auth.json", "models.json"].map(name => ({ name, present: fs.existsSync(path.join(dataRoot, name)) }))
  assert.deepEqual(credentialCleanup, [{ name: "auth.json", present: false }, { name: "models.json", present: false }])
  const db = new Database(path.join(dataRoot, "opencorvus.db"), { readonly: true })
  const facts = {
    capturedAt: new Date().toISOString(), credentialCleanup,
    sessions: db.query("SELECT * FROM session ORDER BY time_created,id").all(),
    messages: db.query("SELECT * FROM message ORDER BY time_created,id").all(),
    parts: db.query("SELECT * FROM part ORDER BY time_created,id").all(),
    requests: db.query("SELECT * FROM tool_part_request ORDER BY time_created,id").all(),
    outcomes: db.query("SELECT * FROM tool_part_outcome ORDER BY time_created,request_part_id").all(),
    usage: db.query("SELECT id,session_id,provider_id,model_id,occurred_at,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens FROM provider_usage_event ORDER BY occurred_at,id").all(),
    controls: db.query("SELECT * FROM session_control_record ORDER BY time_created,id").all(),
    controlEvents: db.query("SELECT * FROM session_control_event ORDER BY time_created,id").all(),
    effects: [],
  }
  db.close()
  for (const entry of report.cases) for (const lane of entry.lanes ?? []) for (const effect of lane.effects ?? []) {
    const file = fs.realpathSync(effect.file), relative = path.relative(runtime, file)
    assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative))
    facts.effects.push({ file: effect.file, content: JSON.parse(fs.readFileSync(file, "utf8")) })
  }
  for (const suffix of [".json", ".json.requests.json"]) {
    const original = fs.readFileSync(path.join(__dirname, name + suffix))
    const archive = path.join(__dirname, name + suffix + ".gz")
    if (fs.existsSync(archive)) assert.deepEqual(zlib.gunzipSync(fs.readFileSync(archive)), original)
    else fs.writeFileSync(archive, zlib.gzipSync(original))
  }
  fs.writeFileSync(path.join(__dirname, `${name}-facts.json.gz`), zlib.gzipSync(JSON.stringify(facts)))
  console.log(JSON.stringify({ name, messages: facts.messages.length, requests: facts.usage.length, effects: facts.effects.length, credentialCleanup }))
}
