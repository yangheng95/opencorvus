import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { ProjectMemory } from "@/memory/project-memory"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"

const [phase, root, receipt] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase))
const result = []
for (const key of ["a", "b"] as const) {
  const directory = path.join(root, "project-" + phase + "-" + key)
  result.push(await Instance.provide({ directory, async fn() {
    const projectID = Instance.project.id
    const generation = "owned-review-" + phase + "-" + key
    const status = key === "a" ? "capacity_reached" : "evidence_too_large"
    const message = key === "a" ? "Alpha review: the protected project memory reached capacity." : "Bravo review: one pending memory item exceeds the size limit."
    const committed = Database.transaction(db => ProjectMemory.setStatusInTransaction(db, { projectID, status, generation, message }))
    assert.equal(committed, true)
    const document = ProjectMemory.read(projectID)
    assert.deepEqual(document.notice, { status, generation, message, acknowledged:false })
    return { directory, projectID, status, generation, message }
  }}))
}
await Instance.disposeAll()
Database.close()
await fs.writeFile(receipt, JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))