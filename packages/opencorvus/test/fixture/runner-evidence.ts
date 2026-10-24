import { Database } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

export const RUNNER_EVIDENCE_BYTES = [0, 255, 13, 10, 195, 169, 0, 128]

export function writeRunnerEvidence(manifest: string, tag: string): void {
  const runtimeRoot = process.env.OPENCORVUS_HOME
  const ownerRoot = process.env.OPENCORVUS_TEST_OWNER_ROOT
  if (!runtimeRoot || !ownerRoot) throw new Error("Synthetic runner evidence requires an isolated runtime")
  const directory = path.join(runtimeRoot, "data")
  fs.mkdirSync(directory, { recursive: true })
  const database = path.join(directory, "synthetic-runner-effect.sqlite")
  const binary = path.join(directory, "synthetic-runner-effect.bin")
  const db = new Database(database)
  try {
    db.exec("CREATE TABLE synthetic_runner_effect (id TEXT PRIMARY KEY, outcome TEXT NOT NULL, evidence BLOB NOT NULL)")
    db.query("INSERT INTO synthetic_runner_effect (id, outcome, evidence) VALUES (?, ?, ?)").run(
      tag,
      "effect_written_before_checker_failure",
      new Uint8Array(RUNNER_EVIDENCE_BYTES),
    )
  } finally {
    db.close()
  }
  fs.writeFileSync(binary, new Uint8Array(RUNNER_EVIDENCE_BYTES))
  fs.writeFileSync(manifest, JSON.stringify({ ownerRoot, runtimeRoot, database, binary }))
}

export function readRunnerEvidence(manifest: string) {
  const original = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
    ownerRoot: string
    runtimeRoot: string
    database: string
    binary: string
  }
  let db: Database
  try {
    db = new Database(original.database, { readonly: true, create: false })
  } catch (cause) {
    throw new Error(`Original synthetic runner database cannot be cold-read: ${original.database}`, { cause })
  }
  try {
    db.exec("PRAGMA query_only=ON;BEGIN")
    const row = db.query("SELECT id, outcome, evidence FROM synthetic_runner_effect").get() as {
      id: string
      outcome: string
      evidence: Uint8Array
    }
    return { original, row: { ...row, evidence: [...row.evidence] }, binary: [...fs.readFileSync(original.binary)] }
  } finally {
    db.exec("ROLLBACK")
    db.close()
  }
}

export async function removeVerifiedRunnerEvidence(
  evidence: ReturnType<typeof readRunnerEvidence>,
  physicalAndOutputSettled: boolean,
): Promise<void> {
  const testRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!testRoot || !physicalAndOutputSettled) throw new Error("Synthetic runner cleanup requires confirmed settlement")
  const [testDirectory, ownerRoot, runtimeRoot] = await Promise.all(
    [testRoot, evidence.original.ownerRoot, evidence.original.runtimeRoot].map((directory) =>
      fs.promises.realpath(directory),
    ),
  )
  const descendant = (parent: string, child: string) => {
    const relative = path.relative(parent, child)
    return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)
  }
  if (
    !path.basename(ownerRoot).startsWith("opencorvus-test-run-") ||
    !descendant(testDirectory, ownerRoot) ||
    !descendant(ownerRoot, runtimeRoot)
  )
    throw new Error("Synthetic runner cleanup escaped its exact owned temporary runtime")
  await removeManagedDirectoryTree(ownerRoot)
}
