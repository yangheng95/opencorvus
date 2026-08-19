import { describe, expect, test } from "bun:test"
import { projectRouteContextKind } from "@/server/project-route-context"

describe("Project route context authority", () => {
  test("classifies persisted deletions independently from live Project discovery", () => {
    expect(
      [
        ["/project/current", "DELETE"],
        ["/session/ses_1", "DELETE"],
        ["/session/ses_1/message/msg_1", "DELETE"],
        ["/session/ses_1/message/msg_1/part/prt_1", "DELETE"],
        ["/goal/gol_1", "DELETE"],
        ["/task/tsk_1", "DELETE"],
        ["/mission/mission_1", "DELETE"],
      ].map(([route, method]) => projectRouteContextKind(route!, method)),
    ).toEqual(["persisted", "persisted", "persisted", "persisted", "persisted", "persisted", "persisted"])
  })

  test("keeps identity-only configuration and full runtime routes distinct", () => {
    expect({
      identity: projectRouteContextKind("/config", "GET"),
      conversationCapabilities: [
        projectRouteContextKind("/chat/capability", "GET"),
        projectRouteContextKind("/chat/capability", "PATCH"),
        projectRouteContextKind("/work/capability", "GET"),
        projectRouteContextKind("/work/capability", "PATCH"),
      ],
      runtime: projectRouteContextKind("/session/ses_1", "GET"),
    }).toEqual({
      identity: "identity",
      conversationCapabilities: ["identity", "identity", "identity", "identity"],
      runtime: "runtime",
    })
  })

  test("gives project-owned routes on globally-served routers the same runtime authority as their siblings", () => {
    expect({
      taskPin: projectRouteContextKind("/work-ledger/item/task/tsk_1/pin", "PATCH"),
      missionPin: projectRouteContextKind("/work-ledger/item/mission/ses_1/pin", "PATCH"),
      directoryReference: projectRouteContextKind("/attachment/directory-reference", "POST"),
      attachmentUpload: projectRouteContextKind("/attachment", "POST"),
    }).toEqual({
      taskPin: "runtime",
      missionPin: "runtime",
      directoryReference: "runtime",
      attachmentUpload: "runtime",
    })
  })
})
