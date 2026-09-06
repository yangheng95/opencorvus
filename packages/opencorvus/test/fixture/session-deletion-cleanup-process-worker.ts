import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"
import {
  claimSessionDeletionCleanup,
  createSessionDeletionCleanupPlan,
  recoverSessionDeletionCleanup,
  SessionDeletionCleanupTestHooks,
  stageSessionDeletionCleanup,
} from "@/session/deletion-cleanup"
import { publishJSONBarrier } from "./json-barrier"

const [mode, projectDirectory, barrierDirectory, sessionID] = process.argv.slice(2)
if (!mode || !projectDirectory || !barrierDirectory) {
  throw new Error("Session deletion cleanup worker requires mode, Project directory and barrier directory")
}

async function state(input: { source: string; quarantine: string }) {
  const present = async (target: string) => fs.stat(target).then(() => true, () => false)
  return {
    sourcePresent: await present(input.source),
    quarantinePresent: await present(input.quarantine),
    sessionPresent: sessionID ? await Session.get(sessionID).then(() => true, () => false) : false,
    activeManifests: await fs.readdir(SessionDeletionCleanupTestHooks.activeRoot()).catch(() => []),
  }
}

const result = await Instance.provide({
  directory: projectDirectory,
  fn: async () => {
    if (mode === "init") {
      const session = await Session.create({ kind: "root", title: "Cross-process deletion cleanup" })
      const source = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
      await fs.mkdir(source, { recursive: true })
      await fs.writeFile(path.join(source, "authority.txt"), "exact deletion owner")
      return { sessionID: session.id }
    }
    if (!sessionID) throw new Error(`${mode} requires a Session identity`)
    if (mode === "hold") {
      const session = await Session.get(sessionID)
      const plan = await createSessionDeletionCleanupPlan({
        projectID: session.projectID,
        rootSessionID: session.id,
        rootIdentity: { kind: session.kind, conversationExperience: null },
        sessions: [{ id: session.id, directory: session.directory }],
      })
      const claim = claimSessionDeletionCleanup(plan)
      if (!claim.acquired) throw new Error(`Deletion occurrence is already owned by ${claim.ownerOccurrenceID}`)
      await stageSessionDeletionCleanup(plan)
      await publishJSONBarrier(
        path.join(barrierDirectory, "owner-ready.json"),
        { source: plan.manifest.targets[0]!.source, quarantine: plan.manifest.targets[0]!.quarantine },
      )
      await new Promise(() => undefined)
    }
    if (mode === "recover") {
      const paths = JSON.parse(await fs.readFile(path.join(barrierDirectory, "owner-ready.json"), "utf8")) as {
        source: string
        quarantine: string
      }
      const recovery = await recoverSessionDeletionCleanup()
      return { recovery: { unreconciled: recovery.unreconciled.map(String) }, ...(await state(paths)) }
    }
    throw new Error(`Unknown Session deletion cleanup worker mode: ${mode}`)
  },
})

if (result !== undefined) process.stdout.write(`${JSON.stringify(result)}\n`)
