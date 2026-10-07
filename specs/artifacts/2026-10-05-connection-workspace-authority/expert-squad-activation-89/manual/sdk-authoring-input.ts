import path from "node:path"
import { mkdir, stat } from "node:fs/promises"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "../packages/sdk/js/src/expert-squad-authoring.ts"

const outputRoot = path.resolve("C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/expert-activation-authoring-89")
if (await stat(outputRoot).catch(() => undefined)) throw new Error("Preserve the existing authoring occurrence")
await mkdir(outputRoot, { recursive: true })
const definitions = [
  { folder: "project-only", id: "activation-project", label: "Activation Project", scope: "project", version: "2026.10.07.1" },
  { folder: "global-only", id: "activation-global", label: "Activation Global", scope: "global", version: "2026.10.07.1" },
  { folder: "shared-global", id: "activation-shared", label: "Activation Shared Global", scope: "global", version: "2026.10.07.1" },
  { folder: "shared-project", id: "activation-shared", label: "Activation Shared Project", scope: "project", version: "2026.10.07.2" },
] as const
const sources = []
for (const entry of definitions) {
  const definition: ExpertSquadPackageDefinition = {
    manifest: {
      schema_version: 2, namespace: "activation-check", id: entry.id, label: entry.label,
      description: "Owned current selection and declaration qualification package.", version: entry.version,
      product_pillars: ["code", "work"], readme: "README.md",
      selector: { summary: "Inspect owned activation behavior.", selection_guidance: "Use this package only in the owned qualification Project.", instructions: "selector.md" },
      capability_sets: {}, capability_projection: { scheduler: { base_role: "orchestrator", capability_refs: [] }, agents: {}, virtual_workflows: {} },
    },
    files: { "README.md": `# ${entry.label}\n\nReal SDK-authored ${entry.scope} package ${entry.version} for owned manual qualification.\n`, "selector.md": "# Owned activation\n\nInspect this current installation in the isolated Project.\n" },
  }
  const sourceDirectory = path.join(outputRoot, entry.folder)
  await writeExpertSquadPackage({ directory: sourceDirectory, definition })
  sources.push({ id: entry.id, namespace: definition.manifest.namespace, version: entry.version, installationScope: entry.scope, sourceDirectory })
}
console.log(JSON.stringify({ outputRoot, sources }, null, 2))
