
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { writeExpertSquadPackage } from "file:///D:/myhexin-local/opencorvus/packages/sdk/js/src/expert-squad-authoring.ts"

const base = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(base, "seed.json"), "utf8"))
for (const phase of ["before", "after"]) {
  const project = path.join(base, "project-" + phase)
  assert.equal(seed[phase].directory, project)
  const installed: string[] = []
  for (let i = 1; i <= 22; i++) {
    const suffix = String(i).padStart(2, "0")
    const id = "page-review-" + suffix
    const label = "Page Review " + suffix
    await writeExpertSquadPackage({
      directory: path.join(project, ".opencorvus", "expert-squads", "local-review", id),
      definition: {
        manifest: {
          schema_version: 2,
          namespace: "local-review",
          id,
          label,
          description: "An isolated package for observing the actual installed catalog.",
          version: "2026.11.10.1",
          product_pillars: ["code"],
          readme: "README.md",
          selector: {
            summary: "Inspect this installed declaration.",
            selection_guidance: "Use only during catalog review.",
            instructions: "selector.md",
          },
          capability_sets: {},
          capability_projection: {
            scheduler: { base_role: "orchestrator", capability_refs: [] },
            agents: {},
            virtual_workflows: {},
          },
        },
        files: { "README.md": "# " + label + "\n", "selector.md": "# Catalog review\n" },
      },
    })
    installed.push(id)
  }
  seed[phase].packages = installed
}
await fs.writeFile(path.join(base, "seed.json"), JSON.stringify(seed, null, 2) + "\n");
console.log(JSON.stringify({ fixtures: [seed.before.packages.length, seed.after.packages.length] }))
