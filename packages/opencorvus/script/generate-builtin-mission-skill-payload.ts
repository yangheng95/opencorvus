#!/usr/bin/env bun

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { renderBuiltinSkillPayloadModule } from "./generate-builtin-skill-payload"

export function resolveBuiltinMissionSkillSourceRoot(repoRoot: string): string {
  return path.join(repoRoot, "packages", "opencorvus", "src", "mission-skill", "builtin")
}

export function resolveBuiltinMissionSkillPayloadModulePath(repoRoot: string): string {
  return path.join(repoRoot, "packages", "opencorvus", "src", "mission-skill", "builtin-payload.ts")
}

export async function renderBuiltinMissionSkillPayloadModule(repoRoot: string): Promise<string> {
  return renderBuiltinSkillPayloadModule(repoRoot, {
    sourceRoot: resolveBuiltinMissionSkillSourceRoot(repoRoot),
    generatedBy: "packages/opencorvus/script/generate-builtin-mission-skill-payload.ts",
    typeImport: "./builtin-source",
    typeName: "BuiltinMissionSkillSource",
    constantName: "builtinMissionSkillSources",
  })
}

export async function generateBuiltinMissionSkillPayloadModule(repoRoot: string): Promise<string> {
  const modulePath = resolveBuiltinMissionSkillPayloadModulePath(repoRoot)
  const content = await renderBuiltinMissionSkillPayloadModule(repoRoot)
  const current = await fs.promises.readFile(modulePath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (current !== content) await fs.promises.writeFile(modulePath, content)
  return modulePath
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
  const modulePath = await generateBuiltinMissionSkillPayloadModule(repoRoot)
  console.log(`Generated ${path.relative(repoRoot, modulePath).replaceAll(path.sep, "/")}`)
}

if (import.meta.main) await main()
