import { describe, expect, test } from "bun:test"
import { projectRouteContextKind } from "@/server/project-route-context"

describe("Project route context authority", () => {
  test("uses exact identity metadata reads while memory organization and prompt retain runtime", () => {
    expect({
      search: projectRouteContextKind("/expert-squad/search", "GET"),
      catalog: projectRouteContextKind("/expert-squad/catalog", "GET"),
      missionSkills: projectRouteContextKind("/mission-skill/catalog", "GET"),
      memory: projectRouteContextKind("/experimental/project-memory", "GET"),
      organize: projectRouteContextKind("/experimental/project-memory/organize", "POST"),
      prompt: projectRouteContextKind("/session/ses_1/prompt", "POST"),
      config: projectRouteContextKind("/session/ses_1/config", "GET"),
      vcs: projectRouteContextKind("/vcs", "GET"),
      channel: projectRouteContextKind("/channel", "GET"),
    }).toEqual({
      search: "identity",
      catalog: "identity",
      missionSkills: "identity",
      memory: "identity",
      organize: "runtime",
      prompt: "runtime",
      config: "runtime",
      vcs: "runtime",
      channel: "runtime",
    })
  })

  test("classifies ordinary conversation title mutations through exact Project identity", () => {
    expect({
      chatTitle: projectRouteContextKind("/coding/chat/session/ses_1", "PATCH"),
      workTitle: projectRouteContextKind("/coding/work/session/ses_2", "PATCH"),
      archive: projectRouteContextKind("/coding/work/session/ses_2/archive", "PATCH"),
      selection: projectRouteContextKind("/coding/work/session/ses_2/selection", "PATCH"),
      abort: projectRouteContextKind("/coding/work/session/ses_2/abort", "POST"),
      sessionConfig: projectRouteContextKind("/session/ses_2/config", "GET"),
    }).toEqual({
      chatTitle: "identity",
      workTitle: "identity",
      archive: "runtime",
      selection: "runtime",
      abort: "runtime",
      sessionConfig: "runtime",
    })
  })
  test("uses Project identity for persisted Session pages and event subscriptions", () => {
    expect({
      tail: projectRouteContextKind("/session/ses_1/conversation", "GET"),
      history: projectRouteContextKind("/session/ses_1/conversation/history", "GET"),
      events: projectRouteContextKind("/session/ses_1/events", "GET"),
      sideHistory: projectRouteContextKind("/session/ses_1/side-chat", "GET"),
      sideCreate: projectRouteContextKind("/session/ses_1/side-chat", "POST"),
      config: projectRouteContextKind("/session/ses_1/config", "GET"),
      configWrite: projectRouteContextKind("/session/ses_1/config", "PATCH"),
      prompt: projectRouteContextKind("/session/ses_1/prompt", "POST"),
    }).toEqual({
      tail: "identity",
      history: "identity",
      events: "identity",
      sideHistory: "identity",
      sideCreate: "runtime",
      config: "runtime",
      configWrite: "runtime",
      prompt: "runtime",
    })
  })

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

  test("provisions obsolete packages through identity-only routes", () => {
    expect([
      projectRouteContextKind("/expert-squad/market/detail", "GET"),
      projectRouteContextKind("/expert-squad/repair-bundled", "POST"),
    ]).toEqual(["identity", "identity"])
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
