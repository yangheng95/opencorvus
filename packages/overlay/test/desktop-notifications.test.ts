import { describe, expect, test } from "bun:test"
import { MailboxNotificationProjector } from "../src/services/desktop-notifications"
import type { MailboxItem } from "../src/services/mailbox"

function mailboxItem(id: string): MailboxItem {
  return {
    attention: true,
    body: `Body for ${id}`,
    category: "notification",
    createdAt: 1,
    eventType: "interaction.requested",
    evidenceLocators: [],
    id,
    orderKey: id,
    sourceAgentID: "agent",
    subject: `Subject for ${id}`,
    taskDirectory: "D:/workspace",
    taskID: "task",
    taskTitle: "Task",
  }
}

describe("Mailbox native notification projection", () => {
  test("delivers each newly observed unread Mailbox item once through the canonical notification dependency", async () => {
    const delivered: string[] = []
    const projector = new MailboxNotificationProjector({
      canSendNotification: async () => true,
      sendNotification: async (item) => {
        delivered.push(item.id)
        return "delivered"
      },
    })
    const existing = mailboxItem("existing")
    const added = mailboxItem("added")

    await projector.project([existing], () => true)
    await projector.project([added, existing], () => true)
    await projector.project([added, existing], () => true)

    expect(delivered).toEqual(["added"])
  })
})
