import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
}

test("ConnectionBadge is a read-only live status node", () => {
  const source = read("src/components/ConnectionBadge.tsx")

  expect(source).not.toContain('import { Button } from "./ui/Button"')
  expect(source).not.toContain("openConfigDialog")
  expect(source).toContain("<span")
  expect(source).toContain('data-ui="connection-badge"')
  expect(source).not.toContain("onClick")
  expect(source).toContain('aria-live="polite"')
  expect(source).toContain("title={diagnosticsLabel()}")
  expect(source).toContain("aria-label={diagnosticsLabel()}")
  expect(source).not.toContain("onDblClick")
  expect(source).not.toContain('apiJson("restart"')
  expect(source).toMatch(/<span[\s\S]*id="connBadge"/)
})

test("ConnectionBadge sidebar footer CSS has no interactive hover affordance", () => {
  const css = read("src/styles/surfaces/sidebar.css")

  expect(css).toContain('.conn-badge[data-ui="connection-badge"]')
  expect(css).not.toContain(".conn-badge:hover")
  expect(css).not.toContain(".conn-badge:focus-visible")
  expect(read("src/styles/surfaces/conversation.css")).not.toContain(
    '.chat[data-empty-chat-home="true"] #solidConnBadge',
  )
})
