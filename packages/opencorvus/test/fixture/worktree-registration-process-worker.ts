const [primaryDirectory, worktreeDirectory, barrierPath] = process.argv.slice(2)
if (!primaryDirectory || !worktreeDirectory || !barrierPath) {
  throw new Error("usage: worktree-registration-process-worker <primary-directory> <worktree-directory> <barrier-path>")
}

const fs = await import("node:fs/promises")
const { Instance } = await import("../../src/project/instance")
const { ProjectDirectoryAdmission } = await import("../../src/project/directory-admission")

await Instance.provideProjectIdentity({
  directory: primaryDirectory,
  fn: async () => {
    const occurrence = await ProjectDirectoryAdmission.observeDirectory(worktreeDirectory)
    const acquired = await ProjectDirectoryAdmission.acquire({
      directory: worktreeDirectory,
      operationID: ProjectDirectoryAdmission.scopeOperationID(
        Instance.project.id,
        `registration-death-fixture:${occurrence.directoryKey}`,
      ),
      kind: "registration",
      occurrence,
    })
    if (acquired.outcome !== "acquired") throw new Error("registration fixture did not acquire directory admission")
    await fs.writeFile(barrierPath, "admitted")
    await new Promise((resolve) => setTimeout(resolve, 120_000))
  },
})
