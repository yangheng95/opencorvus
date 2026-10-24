import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { parse, modify, applyEdits } from "jsonc-parser"
import { Global } from "@/global"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

for (const scenario of [
  { cut: "configuration-published", policy: undefined, expected: "deny", disposition: "applied" },
  { cut: "catalog-published", policy: undefined, expected: "deny", disposition: "applied" },
  { cut: "configuration-published", policy: "allow", expected: "allow", disposition: "superseded" },
  { cut: "catalog-published", policy: "mixed", expected: "mixed", disposition: "superseded" },
] as const) {
  test(`Skill recovery preserves current config scope at ${scenario.cut} with ${scenario.policy ?? "unrelated"} edits`, async () => {
    const root = await fs.mkdtemp(path.join(Global.Path.temporary, "skill-config-scope-"))
    const env = { ...process.env, OPENCORVUS_HOME: root }
    delete env.OPENCORVUS_TEST_HOME
    delete env.OPENCORVUS_TEST_PROCESS_ROOT
    async function run(args: string[]) {
      const child = Bun.spawn(
        [process.execPath, path.join(import.meta.dir, "fixture/skill-replacement-child.ts"), ...args],
        { cwd: path.join(import.meta.dir, ".."), env, stdout: "pipe", stderr: "pipe" },
      )
      const [exit, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      return { exit, stderr, result: stdout.trim() ? JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!) : null }
    }
    try {
      const setup = await run(["setup"])
      expect(setup.exit, setup.stderr).toBe(0)
      await run(["import-cut", setup.result.projectID, scenario.cut])
      const file = path.join(root, "config/opencorvus.jsonc")
      let edited = await fs.readFile(file, "utf8")
      edited = applyEdits(edited, modify(edited, ["username"], "operator retained edit", {}))
      if (scenario.policy)
        for (const name of ["replacement-alpha", "replacement-beta"])
          edited = applyEdits(
            edited,
            modify(
              edited,
              ["skill_policy", name],
              scenario.policy === "mixed" ? (name === "replacement-alpha" ? "deny" : "allow") : scenario.policy,
              {},
            ),
          )
      await fs.writeFile(file, edited)
      const recovered = await run(["inspect", setup.result.projectID])
      expect(recovered.exit, recovered.stderr).toBe(0)
      expect({
        username: parse(await fs.readFile(file, "utf8")).username,
        policies: recovered.result.policies,
        terminal: recovered.result.occurrences.at(-1).terminal,
        disposition: recovered.result.occurrences.at(-1).configurationDisposition,
      }).toEqual({
        username: "operator retained edit",
        policies:
          scenario.expected === "mixed"
            ? { "replacement-alpha": "deny", "replacement-beta": "allow" }
            : { "replacement-alpha": scenario.expected, "replacement-beta": scenario.expected },
        terminal: "committed",
        disposition: scenario.disposition,
      })
      const repeated = await run(["inspect", setup.result.projectID])
      expect({ policies: repeated.result.policies, occurrences: repeated.result.occurrences }).toEqual({
        policies: recovered.result.policies,
        occurrences: recovered.result.occurrences,
      })
    } finally {
      await removeManagedDirectoryTree(root)
    }
  }, 120000)
}
