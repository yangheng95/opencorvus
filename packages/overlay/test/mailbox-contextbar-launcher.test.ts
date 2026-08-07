import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const read = (relativePath: string) => readFileSync(join(ROOT, relativePath), "utf8")

const APP = read("src/components/App.tsx")
const MAIN = read("src/main.tsx")
const ICONS = read("src/components/ui/Icon.lucide.ts")
const RIGHT_DOCK = read("src/components/RightDock.tsx")
const TITLEBAR = read("src/styles/surfaces/titlebar.css")

test("workspace context bar owns one Search-then-Mailbox action cluster", () => {
  const search = APP.indexOf('data-ui="work-ledger-search-toggle"')
  const mailbox = APP.indexOf('data-ui="mailbox-toggle"')

  expect(APP).toContain('class="workspace-context-actions"')
  expect(search).toBeGreaterThan(-1)
  expect(mailbox).toBeGreaterThan(search)
  expect(APP.slice(search, mailbox)).toContain("hidden={mailboxVisible()}")
  expect(APP).toContain('class="workspace-command-action workspace-command-mailbox"')
  expect(APP).toContain("data-attention={String(props.mailboxAttention)}")
  expect(APP).toContain("data-active={String(mailboxVisible())}")
  expect(APP).toContain('aria-controls="leftPanelMailbox"')
  expect(APP).toContain("aria-expanded={mailboxVisible()}")
  expect(APP).not.toContain("aria-pressed=")
  expect(APP).toContain("MAILBOX_HOVER_OPEN_DELAY_MILLISECONDS")
  expect(APP).toContain("const [mailboxHoverPreview, setMailboxHoverPreview] = createSignal(false)")
  expect(APP).toContain("const mailboxVisible = mailboxHoverPreview")
  expect(APP).toContain("onMouseEnter={scheduleMailboxHoverPreview}")
  expect(APP).toContain("onMouseEnter={cancelMailboxHoverClose}")
  expect(APP).toContain("onMouseLeave={scheduleMailboxHoverPreviewClose}")
  expect(APP).toContain("cancelMailboxHoverClose()")
  expect(APP).toContain("setMailboxHoverPreview(true)")
  expect(APP).toContain("setMailboxHoverPreview(false)")
  expect(APP).toContain("props.onMailboxViewed()")
  expect(APP).not.toContain("onClick={openMailboxHoverPreview}")
  expect(APP).not.toContain("mailboxActive")
  expect(APP).not.toContain("onToggleMailbox")
  expect(APP.match(/data-ui="mailbox-toggle"/g)).toHaveLength(1)
})

test("canonical Mailbox presentation blinks the launcher without automatic sidebar reveal", () => {
  expect(MAIN).toContain("const [mailboxAttention, setMailboxAttention] = createSignal(false)")
  expect(MAIN).toContain("const [mailboxUnreadCount, setMailboxUnreadCount] = createSignal(0)")
  expect(MAIN).toContain("function presentMailboxNotification(): void")
  expect(MAIN).toContain("setMailboxAttention(true)")
  expect(MAIN).not.toContain("type LeftSidebarPanel")
  expect(MAIN).not.toContain("leftSidebarPanel")
  expect(MAIN).not.toContain("openLeftSidebarMailbox")
  expect(MAIN).not.toContain("closeLeftSidebarMailbox")
  expect(MAIN).not.toContain("toggleLeftSidebarMailbox")
  expect(MAIN).toContain("if (directory !== previousDirectory) setMailboxAttention(false)")
  expect(MAIN).toContain("onMailboxViewed={() => setMailboxAttention(false)}")
  expect(MAIN).not.toContain("mailboxActive=")
  expect(MAIN).not.toContain("onToggleMailbox=")
  expect(MAIN).toContain("<MailboxPanel")
  expect(MAIN).toContain("onNotification={presentMailboxNotification}")
  expect(MAIN).toContain("onUnreadCountChange={setMailboxUnreadCount}")
  expect(MAIN).not.toContain('<MailboxPanel onNotification={() => openRightActivity("mailbox")} />')
})

test("Mailbox uses dedicated launcher and mark-all-read Lucide glyphs with restrained accessible motion", () => {
  expect(ICONS).toContain("Inbox,")
  expect(ICONS).toContain("MailCheck,")
  expect(ICONS).toContain("Mails,")
  expect(ICONS).toContain("mailbox: { component: Mails }")
  expect(ICONS).toContain('"mail-check": { component: MailCheck }')
  expect(ICONS).toContain("inbox: { component: Inbox }")
  expect(RIGHT_DOCK).not.toContain('{ id: "mailbox", icon: "mailbox"')
  expect(APP).toContain('<Icon name="mailbox" />')
  expect(APP).toContain("<Badge")
  expect(TITLEBAR).toContain(".workspace-command-mailbox__count.oc-badge")
  expect(TITLEBAR).toContain("@keyframes workspace-mailbox-attention")
  expect(TITLEBAR).toContain(
    "animation: workspace-mailbox-attention var(--ui-duration-loop-pulse) var(--ui-timing-standard) infinite;",
  )
  expect(TITLEBAR).toContain("@media (prefers-reduced-motion: reduce)")
  expect(TITLEBAR).toMatch(
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?workspace-command-mailbox\[data-attention="true"\][\s\S]*?animation:\s*none;/,
  )
})
