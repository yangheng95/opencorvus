#!/usr/bin/env bun

import { $ } from "bun"
import path from "node:path"
import { GENERATED_ARTIFACT_PATHS } from "./generated-artifacts"
import { generateOpencorvusGeneratedBuildArtifacts } from "../packages/opencorvus/script/generate-build-artifacts"
import { generatePortableExpertSquadTemplate } from "../packages/opencorvus/script/generate-portable-expert-squad-template"

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
  ...API_MDX_ARTIFACT_PATHS,
  ...OPENCORVUS_BUILD_ARTIFACT_PATHS,
  "templates/portable-expert-squad-template",
])
const prettierArtifactPaths = GENERATED_ARTIFACT_PATHS.filter(
  (artifact) => !CANONICAL_TEXT_ARTIFACT_PATHS.has(artifact),
)

await generateOpencorvusGeneratedBuildArtifacts({ log: console.log })

await generatePortableExpertSquadTemplate(path.resolve(import.meta.dir, ".."))

await $`bun ./packages/sdk/js/script/build.ts`

await $`bun ./packages/opencorvus/script/docs/render-api-md.ts`

const prettier = Bun.spawn(["bun", "run", "prettier", "--ignore-unknown", "--write", ...prettierArtifactPaths], {
  stdout: "inherit",
  stderr: "inherit",
})
const code = await prettier.exited
if (code !== 0) throw new Error(`prettier failed with exit code ${code}`)
