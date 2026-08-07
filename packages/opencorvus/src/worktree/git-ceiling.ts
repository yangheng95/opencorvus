import path from "path"

export function gitCeilingEnvForWorktree(
  cwd: string | undefined,
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  if (!cwd) return {}
  const normalized = path.normalize(cwd)
  const lower = normalized.toLowerCase()
  const marker = `${path.sep}.opencorvus${path.sep}.r${path.sep}`.toLowerCase()
  const index = lower.indexOf(marker)
  if (index < 0) return {}
  const ceiling = path.join(normalized.slice(0, index), ".opencorvus", ".r")
  const existing = source.GIT_CEILING_DIRECTORIES?.trim()
  return {
    GIT_CEILING_DIRECTORIES: existing ? `${ceiling}${path.delimiter}${existing}` : ceiling,
  }
}
