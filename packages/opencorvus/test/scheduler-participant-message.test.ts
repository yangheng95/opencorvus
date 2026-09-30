import { expect, test } from "bun:test"
import { renderSchedulerParticipantMessage, SchedulerMessageConflictError } from "@/protocol/delivery"

test.each(["request", "reply", "notification"] as const)("scheduler %s carries the unchanged body and exact delivery references", (kind) => {
  const message = "已完成复核。\n\n- 第一项：`src/main.ts`\n- 第二项：保留原始证据\n\n```text\n  indented body\n```"
  const text = renderSchedulerParticipantMessage({
    eventID: "pev_current",
    kind,
    source: { kind: "task_scheduler", project_id: "project_1", task_id: "tsk_source", root_session_id: "ses_source" },
    threadID: 'scheduler-message:ses_source:msg_source:call_1\n"quoted"',
    ...(kind === "reply" ? { replyTo: "pev_request" } : {}),
    subject: "复核 [main] 与 `origin/main`",
    message,
  })
  const references = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].at(-1)
  expect(JSON.parse(references![1]!)).toEqual({
    source: "Task scheduler tsk_source",
    event_id: "pev_current",
    thread_id: 'scheduler-message:ses_source:msg_source:call_1\n"quoted"',
    ...(kind === "reply" ? { reply_to: "pev_request" } : {}),
  })
  expect(text).toContain(`\n\n${message}\n\n`)
})

test("scheduler reply requires its original request identity", () => {
  expect(() => renderSchedulerParticipantMessage({
    eventID: "pev_current",
    kind: "reply",
    source: { kind: "mission_scheduler", project_id: "project_1", mission_id: "mission_1", session_id: "ses_source" },
    threadID: "thread_1",
    subject: "Reply",
    message: "Completed",
  })).toThrow(SchedulerMessageConflictError)
})
