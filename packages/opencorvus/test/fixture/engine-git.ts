import { persistEstablishedTask as persistTask } from "./engine-task"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"

export async function createEngineGitCheckpointTask(input: {
  projectPath: string
  title: string
  packageDigestCharacter?: string
}) {
  const session = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: input.title })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const packageRevision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "base",
    version: "2026.08.06.1",
    packageDigest: (input.packageDigestCharacter ?? "a").repeat(64),
  }
  persistTask({
    taskID,
    rootSession: session,
    now,
    title: input.title,
    request: `Checkpoint ${input.title}`,
    productPillar: "code",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: input.projectPath,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  return taskID
}
