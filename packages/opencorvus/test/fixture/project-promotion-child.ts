const [action, projectID, destinationParent, name, requestedCut] = process.argv.slice(2)
if (!action || !destinationParent) {
  throw new Error(
    "usage: project-promotion-child <setup|promote|promote-cut|inspect|recover> <project-id-or-dash> <destination-parent> [name] [cut]",
  )
}

const fs = await import("node:fs/promises")
const { ImplicitProject } = await import("../../src/project/implicit-project")

if (action === "setup") {
  await fs.mkdir(destinationParent, { recursive: true })
  const anonymous = await ImplicitProject.create()
  process.stdout.write(`${JSON.stringify({ projectID: anonymous.project.id, source: anonymous.directory })}\n`)
} else if (action === "promote" || action === "promote-cut") {
  const { Project } = await import("../../src/project/project")
  const project = Project.get(projectID!)
  if (!project) throw new Error(`Project not found: ${projectID}`)
  if (action === "promote-cut") {
    const { setDurablePublicationTestCutHook } = await import("@opencorvus-ai/util/durable-publication")
    setDurablePublicationTestCutHook((cut) => {
      if (cut === requestedCut) process.kill(process.pid, "SIGKILL")
    })
  }
  const result = await ImplicitProject.promote({ project, destinationParent, name: name! })
  process.stdout.write(`${JSON.stringify({ directory: result.directory })}\n`)
} else if (action === "recover") {
  const { Project } = await import("../../src/project/project")
  const recovered = await ImplicitProject.recoverPromotions()
  process.stdout.write(`${JSON.stringify({ recovered, project: Project.get(projectID!) })}\n`)
} else if (action === "inspect") {
  const { Project } = await import("../../src/project/project")
  const { ProjectMaintenanceFenceTable } = await import("../../src/project/project.sql")
  const { Database, eq } = await import("../../src/storage/db")
  const promotionFences = Database.use((db) =>
    db.select().from(ProjectMaintenanceFenceTable).where(eq(ProjectMaintenanceFenceTable.project_id, projectID!)).all(),
  )
  process.stdout.write(`${JSON.stringify({ project: Project.get(projectID!), promotionFences })}\n`)
} else {
  throw new Error(`unknown action: ${action}`)
}
