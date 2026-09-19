import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"

export function classifyCIPaths(files: string[]): "docs" | "code" {
  return files.every((file) => /^(?:docs\/|specs\/).+\.md$/.test(file) || /^[^/]+\.md$/.test(file)) ? "docs" : "code"
}

export function resolveCIScope(input: { event: string; base?: string; cwd?: string }): "docs" | "code" {
  if (input.event === "workflow_dispatch" || !input.base || /^0+$/.test(input.base)) return "code"
  if (!/^[a-f0-9]{40}$/.test(input.base)) throw new Error("CI base must be an exact Git commit SHA")
  const range = input.event === "pull_request" ? `${input.base}...HEAD` : input.base
  const files = execFileSync(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", range, ...(input.event === "pull_request" ? [] : ["HEAD"])],
    {
      cwd: input.cwd,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean)
  return classifyCIPaths(files)
}

if (import.meta.main) {
  const scope = resolveCIScope({
    event: process.env.GITHUB_EVENT_NAME ?? "workflow_dispatch",
    base: process.env.CI_BASE_SHA,
  })
  if (!process.env.GITHUB_OUTPUT) throw new Error("CI scope requires GITHUB_OUTPUT")
  appendFileSync(process.env.GITHUB_OUTPUT, `scope=${scope}\n`)
  console.log(`CI change scope: ${scope}`)
}
