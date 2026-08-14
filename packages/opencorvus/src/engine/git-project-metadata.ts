import { currentProjectDirectory } from "@/project/instance-context"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import fs from "node:fs/promises"
import path from "node:path"

// OpenCorvus owns exactly one project ignore rule, derived from the canonical
// runtime root. Static `.opencorvus/` project inputs remain versionable.
const OPENCORVUS_GITIGNORE_RULE = `${ProjectRuntimePaths.relativeRuntimeRoot()}/`

// Known Office deliverables and PDF exports must never inherit machine-global
// text/EOL conversion. A small, NUL-free PDF is otherwise classified as text
// under core.autocrlf=true and checkout corrupts its xref offsets while Git's
// filtered status still reports the worktree clean.
const OPENCORVUS_GITATTRIBUTES_RULES = [
  "*.pdf binary",
  "*.doc binary",
  "*.docx binary",
  "*.docm binary",
  "*.xls binary",
  "*.xlsx binary",
  "*.xlsm binary",
  "*.xlsb binary",
  "*.ppt binary",
  "*.pptx binary",
  "*.pptm binary",
] as const

type ProjectMetadataFileSnapshot =
  | { path: string; name: string; existed: true; bytes: Buffer }
  | { path: string; name: string; existed: false }

async function captureProjectMetadataFile(root: string, name: string): Promise<ProjectMetadataFileSnapshot> {
  const filePath = path.join(root, name)
  return fs.readFile(filePath).then(
    (bytes) => ({ path: filePath, name, existed: true as const, bytes }),
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return { path: filePath, name, existed: false as const }
      throw error
    },
  )
}

export async function captureProjectMetadataRollback(root: string): Promise<() => Promise<string[]>> {
  const snapshots = await Promise.all([
    captureProjectMetadataFile(root, ".gitignore"),
    captureProjectMetadataFile(root, ".gitattributes"),
  ])
  return async () => {
    const errors: string[] = []
    for (const snapshot of snapshots) {
      try {
        if (snapshot.existed) await fs.writeFile(snapshot.path, snapshot.bytes)
        else await fs.rm(snapshot.path, { force: true })
      } catch (error) {
        errors.push(`restore maintenance ${snapshot.name} failed: ${String(error)}`)
      }
    }
    return errors
  }
}

async function ensureProjectRuleFile(filePath: string, requiredRules: readonly string[]) {
  const file = Bun.file(filePath)
  if (await file.exists()) {
    // Preserve user policy verbatim and append only missing OpenCorvus rules.
    const existing = await file.text()
    const lines = new Set(existing.split(/\r?\n/).map((line) => line.trim()))
    const missing = requiredRules.filter((rule) => !lines.has(rule))
    if (missing.length === 0) return
    const separator = existing.length === 0 || existing.endsWith("\n") ? "" : "\n"
    await Bun.write(filePath, `${existing}${separator}${missing.join("\n")}\n`)
    return
  }
  await Bun.write(filePath, `${requiredRules.join("\n")}\n`)
}

/** Ensure canonical checkpoints and later Git checkout share one project metadata policy. */
export async function ensureGitProjectMetadata(dir = currentProjectDirectory()) {
  await ensureProjectRuleFile(`${dir}/.gitignore`, [OPENCORVUS_GITIGNORE_RULE])
  await ensureProjectRuleFile(`${dir}/.gitattributes`, OPENCORVUS_GITATTRIBUTES_RULES)
}
