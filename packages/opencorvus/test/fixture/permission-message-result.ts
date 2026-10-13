import { Bus } from "../../src/bus"
import { PermissionAuthority } from "../../src/permission/authority"
import { completedReadResult } from "./completed-read-result"
import type { Session } from "../../src/session"

export async function permissionMessageResult(filePath: string, session?: Session.Info) {
  let request: PermissionAuthority.Request | undefined
  const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => {
    request = properties
  })
  try {
    const value = await completedReadResult({ mode: "ask", filePath, session })
    if (!request || request.toolCallID !== value.callID) throw new Error("Actual read permission request required")
    await value.processor.completeRecoveredToolPart({
      toolCallID: value.callID,
      toolInput: value.args,
      output: value.result,
    })
    return { ...value, request }
  } finally {
    stop()
  }
}
