import { describe, expect, test } from "bun:test"
import { projectRouteContextKind } from "@/server/project-route-context"

describe("Project route context authority", () => {
  test("assigns Project display metadata to identity while general Project properties retain runtime", () => {
    expect({
      current: projectRouteContextKind("/project/current", "GET"),
      rename: projectRouteContextKind("/project/current", "PATCH"),
      properties: projectRouteContextKind("/project/prj_1", "PATCH"),
    }).toEqual({ current: "identity", rename: "identity", properties: "runtime" })
  })
  test("assigns durable Task, Session and native artifact reads to Project identity", () => {
    expect({
      taskDeliveries: projectRouteContextKind("/task/tsk_1/turn-artifacts", "GET"),
      taskBytes: projectRouteContextKind("/task/tsk_1/artifact-read", "POST"),
      sessionDeliveries: projectRouteContextKind("/session/ses_1/turn-artifacts", "GET"),
      nativeArtifact: projectRouteContextKind("/session/ses_1/interactive-artifact/art_1", "GET"),
    }).toEqual({
      taskDeliveries: "identity", taskBytes: "identity", sessionDeliveries: "identity", nativeArtifact: "identity",
    })
  })

  test("assigns Mission authoring and Task titles to Project identity while dispatch retains runtime", () => {
    expect({
      draft: projectRouteContextKind("/mission/draft", "POST"),
      edit: projectRouteContextKind("/mission/mission_1/draft", "PATCH"),
      missionTitle: projectRouteContextKind("/mission/mission_1/title", "PATCH"),
      taskTitle: projectRouteContextKind("/task/tsk_1/title", "PATCH"),
      dispatch: projectRouteContextKind("/mission/mission_1/dispatch", "POST"),
    }).toEqual({ draft: "identity", edit: "identity", missionTitle: "identity", taskTitle: "identity", dispatch: "runtime" })
  })
  test("assigns explicit file mutations to Project identity", () => {
    expect([
      projectRouteContextKind("/file/content", "PATCH"),
      projectRouteContextKind("/file/item", "POST"),
      projectRouteContextKind("/file/item", "PATCH"),
      projectRouteContextKind("/file/item", "DELETE"),
      projectRouteContextKind("/file/item/copy", "POST"),
      projectRouteContextKind("/file/upload", "POST"),
    ]).toEqual(["identity", "identity", "identity", "identity", "identity", "identity"])
  })

  test("assigns durable continuous-goal intent to Project identity for every owner kind", () => {
    expect(
      ["chat", "task", "mission"].map((kind) => ({
        kind,
        read: projectRouteContextKind(`/continuous-goal/${kind}/owner_1`, "GET"),
        create: projectRouteContextKind(`/continuous-goal/${kind}/owner_1`, "POST"),
        update: projectRouteContextKind(`/continuous-goal/${kind}/owner_1`, "PATCH"),
      })),
    ).toEqual([
      { kind: "chat", read: "identity", create: "identity", update: "identity" },
      { kind: "task", read: "identity", create: "identity", update: "identity" },
      { kind: "mission", read: "identity", create: "identity", update: "identity" },
    ])
  })

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
      branches: projectRouteContextKind("/vcs/branches", "GET"),
      diff: projectRouteContextKind("/vcs/diff", "GET"),
      worktrees: projectRouteContextKind("/project/current/worktrees", "GET"),
      deleteWorktree: projectRouteContextKind("/project/current/worktrees", "DELETE"),
      cleanupCandidates: projectRouteContextKind("/project/current/cleanup-candidates", "GET"),
      switchBranch: projectRouteContextKind("/vcs/branch", "POST"),
      commit: projectRouteContextKind("/vcs/commit", "POST"),
      push: projectRouteContextKind("/vcs/push", "POST"),
      commitMessage: projectRouteContextKind("/vcs/commit-message/stream", "POST"),
      channel: projectRouteContextKind("/channel", "GET"),
    }).toEqual({
      search: "identity",
      catalog: "identity",
      missionSkills: "identity",
      memory: "identity",
      organize: "runtime",
      prompt: "runtime",
      config: "runtime",
      vcs: "identity",
      branches: "identity",
      diff: "identity",
      worktrees: "identity",
      deleteWorktree: "runtime",
      cleanupCandidates: "runtime",
      switchBranch: "runtime",
      commit: "runtime",
      push: "runtime",
      commitMessage: "runtime",
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
      archive: "identity",
      selection: "runtime",
      abort: "identity",
      sessionConfig: "runtime",
    })
  })
  test("assigns archive and restore controls to Project identity for every public owner", () => {
    expect([
      "/coding/chat/session/ses_1/archive",
      "/coding/work/session/ses_2/archive",
      "/task/tsk_1/archive",
      "/mission/mission_1/archive",
    ].map(path => projectRouteContextKind(path, "PATCH"))).toEqual([
      "identity", "identity", "identity", "identity",
    ])
  })
  test("assigns existing-execution Stop controls to Project identity", () => {
    expect([
      "/coding/chat/session/ses_1/abort",
      "/coding/work/session/ses_2/abort",
      "/session/ses_3/abort",
      "/mission/mission_1/abort",
      "/task/tsk_1/cancel",
      "/task/tsk_1/session/ses_4/cancel",
    ].map(path => projectRouteContextKind(path, "POST"))).toEqual([
      "identity", "identity", "identity", "identity", "identity", "identity",
    ])
  })
  test("uses Project identity for persisted Session pages and event subscriptions", () => {
    expect({
      list: projectRouteContextKind("/session", "GET"),
      info: projectRouteContextKind("/session/ses_1", "GET"),
      children: projectRouteContextKind("/session/ses_1/children", "GET"),
      todos: projectRouteContextKind("/session/ses_1/todo", "GET"),
      artifacts: projectRouteContextKind("/session/ses_1/turn-artifacts", "GET"),
      missionStatus: projectRouteContextKind("/mission/mission_1/status", "GET"),
      missionActivity: projectRouteContextKind("/mission/mission_1/activity-cursor", "GET"),
      tail: projectRouteContextKind("/session/ses_1/conversation", "GET"),
      history: projectRouteContextKind("/session/ses_1/conversation/history", "GET"),
      messages: projectRouteContextKind("/session/ses_1/message", "GET"),
      message: projectRouteContextKind("/session/ses_1/message/msg_1", "GET"),
      part: projectRouteContextKind("/session/ses_1/message/msg_1/part/prt_1", "GET"),
      events: projectRouteContextKind("/session/ses_1/events", "GET"),
      sideHistory: projectRouteContextKind("/session/ses_1/side-chat", "GET"),
      status: projectRouteContextKind("/session/status", "GET"),
      sideCreate: projectRouteContextKind("/session/ses_1/side-chat", "POST"),
      config: projectRouteContextKind("/session/ses_1/config", "GET"),
      configWrite: projectRouteContextKind("/session/ses_1/config", "PATCH"),
      prompt: projectRouteContextKind("/session/ses_1/prompt", "POST"),
    }).toEqual({
      list: "identity",
      info: "identity",
      children: "identity",
      todos: "identity",
      artifacts: "identity",
      missionStatus: "identity",
      missionActivity: "identity",
      tail: "identity",
      history: "identity",
      messages: "identity",
      message: "identity",
      part: "identity",
      events: "identity",
      sideHistory: "identity",
      status: "identity",
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
      runtime: projectRouteContextKind("/session/ses_1/prompt", "POST"),
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

  test("gives project-owned administrative and attachment routes their required authority", () => {
    expect({
      taskPin: projectRouteContextKind("/work-ledger/item/task/tsk_1/pin", "PATCH"),
      missionPin: projectRouteContextKind("/work-ledger/item/mission/ses_1/pin", "PATCH"),
      chatPin: projectRouteContextKind("/work-ledger/item/chat/ses_2/pin", "PATCH"),
      directoryReference: projectRouteContextKind("/attachment/directory-reference", "POST"),
      attachmentUpload: projectRouteContextKind("/attachment", "POST"),
    }).toEqual({
      taskPin: "identity",
      missionPin: "identity",
      chatPin: "identity",
      directoryReference: "identity",
      attachmentUpload: "identity",
    })
  })
})
