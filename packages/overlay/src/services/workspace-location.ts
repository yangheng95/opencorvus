export type SessionWorkspaceLocation =
  | { kind: "conversation"; sessionID: string; directory: string; experience: "chat" | "work" }
  | { kind: "mission"; sessionID: string; directory: string }

export type ClientWorkspaceLocation = SessionWorkspaceLocation | {
  kind: "launcher"
  productPillar: "code" | "work"
  conversationTarget: "chat" | "mission"
}
export type WorkspaceLocation = { kind: "task"; taskID: string } | ClientWorkspaceLocation

export class WorkspaceLocationError extends Error {
  override readonly name = "WorkspaceLocationError"
}

const LOCATION_PARAMS = ["taskID", "sessionID", "sessionKind", "directory", "experience", "launcher", "productPillar"] as const
const UNSUPPORTED_TASK_PARAMS = ["task", "taskId", "task_id"]

function canonicalValue(params: URLSearchParams, name: string): string | undefined {
  const values = params.getAll(name)
  if (values.length === 0) return undefined
  if (values.length > 1) throw new WorkspaceLocationError(`Workspace location parameter "${name}" must appear once`)
  const value = values[0]?.trim()
  if (!value) throw new WorkspaceLocationError(`Workspace location parameter "${name}" must be non-empty`)
  return value
}

export function workspaceLocationFromSearch(search: string): WorkspaceLocation | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  for (const name of UNSUPPORTED_TASK_PARAMS) {
    if (params.has(name)) throw new WorkspaceLocationError(`Unsupported workspace location parameter "${name}"`)
  }
  const taskID = canonicalValue(params, "taskID")
  const sessionID = canonicalValue(params, "sessionID")
  const sessionKind = canonicalValue(params, "sessionKind")
  const directory = canonicalValue(params, "directory")
  const experience = canonicalValue(params, "experience")
  const launcher = canonicalValue(params, "launcher")
  const productPillar = canonicalValue(params, "productPillar")
  if (launcher || productPillar) {
    if (taskID || sessionID || sessionKind || directory || experience) throw new WorkspaceLocationError("Launcher location must contain only its creation intent")
    if ((launcher === "chat" || launcher === "mission") && (productPillar === "code" || productPillar === "work")) {
      return { kind: "launcher", conversationTarget: launcher, productPillar }
    }
    throw new WorkspaceLocationError("Launcher location requires its declared creation intent")
  }
  if (taskID) {
    if (sessionID || sessionKind || directory || experience) {
      throw new WorkspaceLocationError("Task location must contain only its taskID")
    }
    return { kind: "task", taskID }
  }
  if (!sessionID) {
    if (sessionKind || directory || experience) throw new WorkspaceLocationError("Session location requires sessionID")
    return null
  }
  if (!directory) throw new WorkspaceLocationError("Session location requires directory")
  if (sessionKind === "conversation" && (experience === "chat" || experience === "work")) {
    return { kind: "conversation", sessionID, directory, experience }
  }
  if (sessionKind === "mission" && experience === undefined) return { kind: "mission", sessionID, directory }
  throw new WorkspaceLocationError("Session location requires its declared kind and conversation experience")
}

/** The URL is the refresh input; History state is retained, never a selection cache. */
export function replaceWorkspaceLocation(location: WorkspaceLocation | null): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  for (const name of [...LOCATION_PARAMS, ...UNSUPPORTED_TASK_PARAMS]) url.searchParams.delete(name)
  if (location?.kind === "task") url.searchParams.set("taskID", location.taskID)
  else if (location?.kind === "launcher") {
    url.searchParams.set("launcher", location.conversationTarget)
    url.searchParams.set("productPillar", location.productPillar)
  }
  else if (location) {
    url.searchParams.set("sessionID", location.sessionID)
    url.searchParams.set("sessionKind", location.kind)
    url.searchParams.set("directory", location.directory)
    if (location.kind === "conversation") url.searchParams.set("experience", location.experience)
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href)
}
