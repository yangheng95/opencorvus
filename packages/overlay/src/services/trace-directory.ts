import { activeSessionID, activeTaskID, selectedTaskDirectory } from "../store/board"
import { conversationSourceDirectory } from "./conversation"

export function currentTraceDirectory(): string {
  const taskID = activeTaskID()
  if (taskID) {
    const directory = selectedTaskDirectory().trim()
    if (!directory) throw new Error(`trace for task ${taskID} requires the selected task directory`)
    return directory
  }
  const sessionID = activeSessionID()
  if (sessionID) return conversationSourceDirectory({ kind: "session", id: sessionID })
  throw new Error("trace requires a selected task or session source")
}
