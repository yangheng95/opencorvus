import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const LAUNCHER_SOURCE = readFileSync(join(import.meta.dir, "../src/components/WorkspaceSplitLauncher.tsx"), "utf8")
const CONVERSATION_CSS = readFileSync(join(import.meta.dir, "../src/styles/surfaces/conversation.css"), "utf8")
const DROPDOWN_MENU_CSS = readFileSync(join(import.meta.dir, "../src/styles/primitives/dropdown-menu.css"), "utf8")

function selectorRuleBody(css: string, selector: string): string {
  for (const chunk of css.replace(/\/\*[\s\S]*?\*\//g, "").split("}")) {
    const openIdx = chunk.indexOf("{")
    if (openIdx < 0) continue
    const selectors = chunk
      .slice(0, openIdx)
      .split(",")
      .map((item) => item.trim())
    if (selectors.includes(selector)) return chunk.slice(openIdx + 1)
  }
  throw new Error(`selector not found: ${selector}`)
}

describe("WorkspaceSplitLauncher primitive", () => {
  test("delegates menu behavior to Kobalte dropdown menu", () => {
    expect(LAUNCHER_SOURCE).toContain('import { DropdownMenu } from "./ui/DropdownMenu"')
    expect(LAUNCHER_SOURCE).not.toContain("@kobalte/core/dropdown-menu")
    expect(LAUNCHER_SOURCE).toContain('import { Button } from "./ui/Button"')
    expect(LAUNCHER_SOURCE).toContain("<DropdownMenu.Root")
    expect(LAUNCHER_SOURCE).toContain("modal={false}")
    expect(LAUNCHER_SOURCE).toContain("<Button")
    expect(LAUNCHER_SOURCE).toContain("<DropdownMenu.Trigger")
    expect(LAUNCHER_SOURCE).toContain("as={Button}")
    expect(LAUNCHER_SOURCE).toContain("<DropdownMenu.Portal")
    expect(LAUNCHER_SOURCE).toContain("<DropdownMenu.Content")
    expect(LAUNCHER_SOURCE).toContain("<DropdownMenu.Item")
    expect(LAUNCHER_SOURCE).not.toContain("<button")
    expect(LAUNCHER_SOURCE).not.toContain("workspace-split-launcher-primary")
    expect(LAUNCHER_SOURCE).not.toContain("workspace-split-launcher-menu-button")
    expect(LAUNCHER_SOURCE).not.toContain("primaryClass")
    expect(LAUNCHER_SOURCE).not.toContain("menuButtonClass")
    expect(LAUNCHER_SOURCE).not.toContain('data-open={props.open ? "true" : "false"}')
    expect(LAUNCHER_SOURCE).not.toContain("document.addEventListener")
    expect(LAUNCHER_SOURCE).not.toContain("getBoundingClientRect")
    expect(LAUNCHER_SOURCE).not.toContain('from "solid-js/web"')
    expect(LAUNCHER_SOURCE).toContain("function runWorkspaceLauncherAction")
    expect(LAUNCHER_SOURCE).not.toContain("void props.onPrimaryClick")
    expect(LAUNCHER_SOURCE).not.toContain("void props.onSelect")
  })

  test("opens the Kobalte menu on launcher hover and closes after leaving its portaled content", () => {
    expect(LAUNCHER_SOURCE).toContain("const WORKSPACE_LAUNCHER_HOVER_CLOSE_DELAY_MILLISECONDS = 120")
    expect(LAUNCHER_SOURCE).toContain("function openFromMouseHover(): void")
    expect(LAUNCHER_SOURCE).toContain("function keepOpenFromMouseHover(): void")
    expect(LAUNCHER_SOURCE).toContain("function closeAfterMouseLeave(): void")
    expect(LAUNCHER_SOURCE.match(/onMouseEnter=\{openFromMouseHover\}/g)).toHaveLength(1)
    expect(LAUNCHER_SOURCE.match(/onMouseEnter=\{keepOpenFromMouseHover\}/g)).toHaveLength(1)
    expect(LAUNCHER_SOURCE.match(/onMouseLeave=\{closeAfterMouseLeave\}/g)).toHaveLength(2)
    expect(LAUNCHER_SOURCE).toContain("function preserveFocusForMouseHover(event: Event): void")
    expect(LAUNCHER_SOURCE).toContain("onOpenAutoFocus={preserveFocusForMouseHover}")
    expect(LAUNCHER_SOURCE).toContain("onFocusOutside={preventFocusDismissForMouseHover}")
    expect(LAUNCHER_SOURCE).toContain("hoverFocusRestoreFrame = requestAnimationFrame")
    expect(LAUNCHER_SOURCE).toContain("focusTarget.focus({ preventScroll: true })")
    expect(LAUNCHER_SOURCE).toContain("clearHoverFocusRestoreFrame()")
    expect(LAUNCHER_SOURCE).toContain("if (props.disabled) return")
    expect(LAUNCHER_SOURCE).toContain("onPointerDown={prepareMenuTriggerInteraction}")
    expect(LAUNCHER_SOURCE).toContain("onKeyDown={prepareMenuTriggerInteraction}")
  })

  test("styles Kobalte highlighted workspace menu options", () => {
    const body = selectorRuleBody(DROPDOWN_MENU_CSS, ".oc-menu-item[data-highlighted]")
    expect(body).toMatch(/background:\s*var\(--hover-wash\)/)
    expect(body).toMatch(/color:\s*var\(--text-strong\)/)
    expect(CONVERSATION_CSS).not.toContain(".workspace-editor-option[data-highlighted]")
    const openButton = selectorRuleBody(
      CONVERSATION_CSS,
      '.chat-header-meta .workspace-editor-launchers .oc-button[data-chrome="workspace-split-menu"][data-expanded]',
    )
    expect(openButton).toMatch(/--oc-button-bg:\s*var\(--oc-control-bg-hover\)/)
    expect(CONVERSATION_CSS).not.toContain(
      '.chat-header-meta .workspace-editor-launchers .oc-button[data-chrome="workspace-split-menu"][data-open="true"]',
    )
  })

  test("keeps launcher labels on the shared descender-safe line box", () => {
    const label = selectorRuleBody(CONVERSATION_CSS, ".chat-header-meta .workspace-editor-primary-label")
    expect(label).toMatch(/line-height:\s*var\(--ui-line-height-tight\)/)
  })
})
