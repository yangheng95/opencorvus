import { Identifier } from "@/id/id"

export function taskWaitFireID(jobID: string): string {
  return Identifier.deterministic("call", `task-wait\0${jobID}`)
}
