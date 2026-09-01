const [directory, workspaceID, barrierPath, releasePath] = process.argv.slice(2)
if (!directory || !workspaceID) {
  throw new Error("usage: workspace-lifecycle-process-worker <directory> <workspace-id>")
}

const { Instance } = await import("../../src/project/instance")
const { Workspace } = await import("../../src/workspace/workspace")

if (barrierPath && releasePath) {
  const fs = await import("node:fs/promises")
  const { setDurablePublicationTestCutHook } = await import("@opencorvus-ai/util/durable-publication")
  setDurablePublicationTestCutHook(async (cut, kind) => {
    if (!kind.startsWith("workspace-lifecycle-") || cut !== "occurrence-published") return
    await fs.writeFile(barrierPath, "published")
    const deadline = Date.now() + 30_000
    for (;;) {
      try {
        await fs.stat(releasePath)
        return
      } catch {
        if (Date.now() >= deadline) throw new Error(`timed out waiting for ${releasePath}`)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }
  })
}

try {
  const workspace = await Instance.provideProjectIdentity({
    directory,
    fn: () => Workspace.create({ id: workspaceID, projectID: Instance.project.id }),
  })
  process.stdout.write(`${JSON.stringify(workspace)}\n`)
} finally {
  await Instance.disposeAll()
}
