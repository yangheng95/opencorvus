import { afterEach, expect, test } from "bun:test"
import { configure, DEFAULT_SERVER } from "../src/services/api"
import { projectMailboxNotifications } from "../src/services/desktop-notifications"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { MailboxItem, MailboxPage } from "../src/services/mailbox"

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ serverUrl: DEFAULT_SERVER, username: "opencorvus", password: "", directory: "" })
})

test("notification projection without a supplied page reads the canonical global Mailbox cursor chain", async () => {
  const requests: Array<Pick<TransportRequest, "path" | "query">> = []
  const item: MailboxItem = {
    id: "original-global-notice", eventType: "interaction.requested", category: "notification", attention: true,
    subject: "Original global notice", body: "Independent of the sidebar query", evidenceLocators: [],
    sourceAgentID: "agent", taskID: "original-task", taskTitle: "Original task", taskDirectory: "D:/project", orderKey: "1", createdAt: 2,
  }
  const first: MailboxPage = { items: [item], nextCursor: { createdAt: 2, id: item.id }, activeCount: 2, unreadCount: 2, archivedCount: 0 }
  const second: MailboxPage = { ...first, items: [{ ...item, id: "older-global-notice", createdAt: 1 }], nextCursor: null }
  const transport: HostTransport = {
    kind: "browser", capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest) {
      requests.push({ path: request.path, query: request.query })
      return { status: 200, ok: true, headers: {}, body: (requests.length === 1 ? first : second) as T }
    },
    openStream() { return { close() {} } },
    async native() { return false },
  }
  __setHostTransportForTest(transport)
  configure({ serverUrl: "http://mailbox-query.test", username: "opencorvus", password: "", directory: "D:/project" })
  await projectMailboxNotifications({ view: "active", signal: new AbortController().signal })
  expect(requests).toEqual([
    { path: "mailbox", query: { view: "active", limit: "100" } },
    { path: "mailbox", query: { view: "active", limit: "100", cursorCreatedAt: "2", cursorID: item.id } },
  ])
})
