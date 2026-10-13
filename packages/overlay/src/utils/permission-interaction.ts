import type { InteractionData } from "../components/InteractionCard"
import type { PermissionDecision } from "../services/interaction-reply"
import { requireTimelineOrderKeyDomain, timelineOrderKeyTime } from "./timeline-order"

export interface PermissionInteraction extends InteractionData {
  type: "permission"
  status: "pending"
  projectID: string
  sessionID: string
  orderKey: string
  directory: string
  time: { created: number }
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`)
  return value
}

/** Project the same durable Request for HTTP, ordered connection snapshots and live events. */
export function permissionInteraction(request: unknown, directory: string): PermissionInteraction {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("permission interaction requires a request object")
  }
  const value = request as Record<string, unknown>
  const id = requiredText(value.id, "permission request id")
  const label = `permission ${id}`
  const projectID = requiredText(value.projectID, `${label} projectID`)
  const sessionID = requiredText(value.sessionID, `${label} sessionID`)
  const title = requiredText(value.toolName, `${label} toolName`)
  const summary = requiredText(value.summary, `${label} summary`)
  const owningDirectory = requiredText(directory, `${label} directory`).trim()
  if (!value.scope || typeof value.scope !== "object" || Array.isArray(value.scope)) {
    throw new Error(`${label} scope must be an object`)
  }
  if (
    !Array.isArray(value.choices) ||
    !value.choices.every((choice) =>
      choice === "allow_once" || choice === "allow_task" || choice === "allow_project" || choice === "deny",
    )
  ) {
    throw new Error(`${label} choices must be an array of permission decisions`)
  }
  const created = value.timeCreated
  if (typeof created !== "number" || !Number.isInteger(created) || created <= 0) {
    throw new Error(`${label} timeCreated must be a positive integer`)
  }
  const orderKey = requireTimelineOrderKeyDomain(value.orderKey, label, "interaction")
  const orderTime = timelineOrderKeyTime(orderKey, label)
  if (orderTime !== created) {
    throw new Error(`${label} orderKey time ${orderTime} does not match timeCreated ${created}`)
  }
  return {
    id,
    projectID,
    sessionID,
    orderKey,
    type: "permission",
    status: "pending",
    title,
    body: `${summary}\n\n\`\`\`json\n${JSON.stringify(value.scope, null, 2)}\n\`\`\``,
    payload: { choices: value.choices as Array<PermissionDecision | "deny"> },
    replyEndpoint: "permission",
    directory: owningDirectory,
    time: { created },
  }
}

export function preparePermissionInteractions(requests: unknown, directory: string): PermissionInteraction[] {
  if (!Array.isArray(requests)) throw new Error("pendingPermissions must be an array")
  const ids = new Set<string>()
  return requests.map((request) => {
    const interaction = permissionInteraction(request, directory)
    if (ids.has(interaction.id)) throw new Error(`pendingPermissions contains duplicate request ${interaction.id}`)
    ids.add(interaction.id)
    return interaction
  })
}
