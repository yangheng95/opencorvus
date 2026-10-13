import fs from "node:fs/promises"
import path from "node:path"
const root = import.meta.dir
const startedAt = Date.now()
const deadlineAt = startedAt + 60000
const timer = setTimeout(() => { console.error("Owned configuration probe reached original 60000ms deadline"); process.exit(1) }, 60000)
process.env.OPENCORVUS_HOME = path.join(root, "runtime")
process.env.OPENCORVUS_TEST_MANAGED_CONFIG_DIR = path.join(root, "managed")
process.env.GIT_CEILING_DIRECTORIES = root
process.env.OPENCORVUS_DISABLE_AUTOUPDATE = "1"
process.env.OPENCORVUS_DISABLE_EXTERNAL_SKILLS = "1"
for (const key of ["OPENCORVUS_CONFIG", "OPENCORVUS_CONFIG_CONTENT", "OPENCORVUS_CONFIG_DIR", "OPENCORVUS_TEST_HOME", "OPENCORVUS_DISABLE_PROJECT_CONFIG"]) delete process.env[key]
const globalInput = {
  prompt_profile: { active: "base" }, permission_mode: "ask",
  experimental: { auto_question: false, memory: { document_token_limit: 5000, organizer_input_token_budget: 16000, pending_availability_limit: 50 } },
  terminal: { profiles: { public: { command: "powershell", label: "Public", args: ["-NoProfile"], env: { MODE: "public" } } } },
}
const cases: [string, string | undefined][] = [
  ["absent", undefined], ["empty", ""], ["whitespace", " \n\t"], ["empty-object", "{}"],
  ["unrelated-username", JSON.stringify({ username: "public-project-user" })],
  ["nested-experimental", JSON.stringify({ experimental: { openTelemetry: true } })],
  ["nested-memory", JSON.stringify({ experimental: { memory: { enabled: true } } })],
  ["nested-terminal", JSON.stringify({ terminal: { profiles: { public: { command: "powershell", label: "Project" } } } })],
  ["inherited-memory-relation", JSON.stringify({ experimental: { memory: { organizer_input_token_budget: 12000 } } })],
]
const results: any[] = []
try {
  await fs.mkdir(path.join(root, "runtime/config"), { recursive: true })
  await fs.mkdir(path.join(root, "managed"), { recursive: true })
  await fs.writeFile(path.join(root, "runtime/config/opencorvus.jsonc"), JSON.stringify(globalInput, null, 2), { flag: "wx" })
  const { Config } = await import("../packages/opencorvus/src/config/config")
  for (const [name, text] of cases) {
    const directory = path.join(root, "projects", name)
    await fs.mkdir(path.join(directory, ".opencorvus"), { recursive: true })
    if (text !== undefined) await fs.writeFile(path.join(directory, ".opencorvus/opencorvus.jsonc"), text, { flag: "wx" })
    try {
      const output = await Config.snapshotForProject(directory)
      results.push({ name, input: text ?? null, outcome: "resolved", output: { prompt_profile: output.prompt_profile, permission_mode: output.permission_mode, experimental: output.experimental, terminal: output.terminal } })
    } catch (error: any) {
      results.push({ name, input: text ?? null, outcome: "error", error: { name: error.name, message: error.message, data: error.data } })
    }
  }
  const result = { pid: process.pid, startedAt, deadlineAt, completedAt: Date.now(), globalInput, results, boundary: "Actual Config.snapshotForProject readOnly over public fixtures in own runtime; no service, Provider/model, user config or credential copying" }
  await fs.writeFile(path.join(root, "probe-results.json"), JSON.stringify(result, null, 2), { flag: "wx" })
  console.log(JSON.stringify(result, null, 2))
} finally { clearTimeout(timer) }
