import { Instance } from "@/project/instance"
import { Session } from "@/session"

export async function getActiveProjectSession(sessionID: string): Promise<Session.Info> {
  return Session.assertLineageInProject({ sessionID, projectID: Instance.project.id })
}

export async function assertActiveProjectSession(sessionID: string): Promise<Session.Info> {
  return getActiveProjectSession(sessionID)
}
