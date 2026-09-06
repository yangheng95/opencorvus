#!/usr/bin/env bun

import { $ } from "bun"
import path from "node:path"
import { GENERATED_ARTIFACT_PATHS } from "./generated-artifacts"
import { generateOpencorvusGeneratedBuildArtifacts } from "../packages/opencorvus/script/generate-build-artifacts"
import { generatePortableExpertSquadTemplate } from "../packages/opencorvus/script/generate-portable-expert-squad-template"
import { generateExpertSquadRevisions } from "../packages/opencorvus/script/generate-expert-squad-revisions"

// MDX means Markdown with JSX. API MDX files are byte-checked against the docs renderer output.
const API_MDX_ARTIFACT_PATHS = new Set([
  "packages/web/src/content/docs/reference/api.mdx",
  "packages/web/src/content/docs/zh-cn/reference/api.mdx",
])
const OPENCORVUS_BUILD_ARTIFACT_PATHS = new Set([
  "packages/opencorvus/generated/expert-squad-payload.ts",
  "packages/opencorvus/generated/expert-squad-search-localization.ts",
  "packages/opencorvus/src/skill/builtin-payload.ts",
  "packages/opencorvus/src/mission-skill/builtin-payload.ts",
])
const CANONICAL_TEXT_ARTIFACT_PATHS = new Set([
  "packages/sdk/openapi.json",
  // Written by its own deterministic renderer; leaving it out of the prettier pass keeps a
  // standalone run byte-identical to a run through this pipeline, which the freshness check needs.
  "packages/opencorvus/generated/expert-squad-revisions.ts",
  ...API_MDX_ARTIFACT_PATHS,
  ...OPENCORVUS_BUILD_ARTIFACT_PATHS,
  "templates/portable-expert-squad-template",
])
const prettierArtifactPaths = GENERATED_ARTIFACT_PATHS.filter(
  (artifact) => !CANONICAL_TEXT_ARTIFACT_PATHS.has(artifact),
)

// Before the payload: stamping a version edits `expert-squad.jsonc`, and the payload has to carry
// the exact bytes the site registry will publish under that version.
const revisions = await generateExpertSquadRevisions(path.resolve(import.meta.dir, ".."))
for (const { id, from, to } of revisions.stamped) console.log(`stamped expert squad ${id}: ${from} -> ${to}`)

await generateOpencorvusGeneratedBuildArtifacts({ log: console.log })

await generatePortableExpertSquadTemplate(path.resolve(import.meta.dir, ".."))

await $`bun ./packages/sdk/js/script/build.ts`

await $`bun ./packages/opencorvus/script/docs/render-api-md.ts`

const prettierBin = await Bun.resolve("prettier/bin/prettier.cjs", path.resolve(import.meta.dir, ".."))
const prettier = Bun.spawn([process.execPath, prettierBin, "--ignore-unknown", "--write", ...prettierArtifactPaths], {
  stdout: "inherit",
  stderr: "inherit",
})
const code = await prettier.exited
if (code !== 0) throw new Error(`prettier failed with exit code ${code}`)
