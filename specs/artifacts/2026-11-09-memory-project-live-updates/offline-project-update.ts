import fs from "node:fs/promises"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b39"
const saved = JSON.parse(await fs.readFile(`${root}/after-projects.json`, "utf8"))
const target = saved.projects.find((project: { name: string }) => project.name === "张三")
if (!target) throw new Error("Owned target project required")
try {
  await Instance.provide({directory: target.worktree, fn: async () => {
    if (Instance.project.id !== target.id) throw new Error("Owned project identity mismatch")
    const result = await Project.update({projectID: target.id, name: "Gamma"})
    if (result.id !== target.id || result.worktree !== target.worktree || result.name !== "Gamma") throw new Error("Project update contract mismatch")
    await fs.writeFile(`${root}/offline-project-update.json`, JSON.stringify(result, null, 2) + "\n")
    console.log(JSON.stringify({id: result.id, name: result.name, worktree: result.worktree}))
  }})
} finally { await Instance.disposeAll() }
