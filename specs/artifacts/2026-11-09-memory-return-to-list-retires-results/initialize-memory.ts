import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { Memory } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/index.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"

declareNativeTaskProcessDeployment()
const [root, phase] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
const seed = JSON.parse(await fs.readFile(root + "/seed.json", "utf8"))[phase]
try {
  await Instance.provide({ directory: seed.directory, fn: async () => {
    const project = await Project.update({ projectID: Instance.project.id, name: "Notes Recovery" })
    const inputs = [
      { role: "neighbor", title: "Neighbor original note", content: "Neighbor note: the orange telescope remains in the south cabinet." },
      { role: "target", title: "Project field notes", content: [
        "Field note 1: the survey starts at the northern trail marker.",
        "Field note 2: the water sample remains sealed in the blue case.",
        "Field note 3: the signed record stays in the field notebook.",
        "Field note 4: the complete original is kept with the project.",
      ].join("\n") },
    ]
    const files = inputs.map(({ role, ...input }) => ({
      ...Memory.writeFile({ projectId: project.id, source: "user", kind: "note", ...input }),
      role,
      content: input.content,
    }))
    for (const file of files) {
      assert.equal(Memory.getChunksInProject({ fileId: file.id, projectId: project.id }).map(chunk => chunk.content).join("\n\n"), file.content)
    }
    const receipt = { phase, project: { id: project.id, name: project.name, worktree: project.worktree }, files }
    await fs.writeFile(root + "/" + phase + "-memory.json", JSON.stringify(receipt, null, 2) + "\n")
    console.log(JSON.stringify({ phase, project: receipt.project.id, fileIDs: files.map(file => file.id) }))
  } })
} finally {
  await Instance.disposeAll()
}
