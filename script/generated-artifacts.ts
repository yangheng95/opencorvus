#!/usr/bin/env bun

import { spawn } from "node:child_process"

export const GENERATED_ARTIFACT_PATHS = [
  "packages/sdk/openapi.json",
  "packages/sdk/js/src/gen",
  "packages/sdk/js/src/defaults.ts",
  "packages/sdk/js/src/route-policy.ts",
  "packages/opencorvus/generated/expert-squad-payload.ts",
  "packages/opencorvus/src/skill/builtin-payload.ts",
  "packages/opencorvus/src/mission-skill/builtin-payload.ts",
  "templates/portable-expert-squad-template",
  "packages/web/src/content/docs/reference/api.mdx",
  "packages/web/src/content/docs/zh-cn/reference/api.mdx",
] as const

export function isGeneratedArtifactPath(file: string): boolean {
  const normalized = file.replaceAll("\\", "/")
  return GENERATED_ARTIFACT_PATHS.some((artifact) => normalized === artifact || normalized.startsWith(`${artifact}/`))
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`git ${args.join(" ")} failed with ${code}: ${stderr}`))
    })
  })
}

async function changedPaths(): Promise<string[]> {
  const outputs = await Promise.all([
    runGit(["diff", "--name-only"]),
    runGit(["diff", "--cached", "--name-only"]),
    runGit(["ls-files", "--others", "--exclude-standard"]),
  ])
  return [
    ...new Set(
      outputs.flatMap((output) =>
        output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    ),
  ]
    .sort()
    .map((file) => file.replaceAll("\\", "/"))
}

async function checkWorktree(): Promise<void> {
  const changed = await changedPaths()
  const offenders = changed.filter((file) => !isGeneratedArtifactPath(file))
  if (offenders.length === 0) return
  console.error(`Generate changed non-generated file(s):`)
  for (const file of offenders) console.error(file)
  process.exit(1)
}

async function checkCleanWorktree(): Promise<void> {
  const changed = await changedPaths()
  if (changed.length === 0) return
  const generated = changed.filter(isGeneratedArtifactPath)
  const offenders = changed.filter((file) => !isGeneratedArtifactPath(file))
  if (generated.length > 0) {
    console.error("Generated artifact drift:")
    for (const file of generated) console.error(file)
  }
  if (offenders.length > 0) {
    console.error("Generate changed non-generated file(s):")
    for (const file of offenders) console.error(file)
  }
  process.exit(1)
}

if (import.meta.main) {
  const mode = process.argv[2] ?? ""
  if (mode === "--print") {
    console.log(GENERATED_ARTIFACT_PATHS.join("\n"))
  } else if (mode === "--print0") {
    process.stdout.write(GENERATED_ARTIFACT_PATHS.join("\0"))
  } else if (mode === "--check-worktree") {
    await checkWorktree()
  } else if (mode === "--check-clean-worktree") {
    await checkCleanWorktree()
  } else {
    throw new Error(
      "Usage: bun ./script/generated-artifacts.ts <--print|--print0|--check-worktree|--check-clean-worktree>",
    )
  }
}
