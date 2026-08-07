import { DropdownMenu } from "./ui/DropdownMenu"
import { onCleanup, type JSX } from "solid-js"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"

const WORKSPACE_LAUNCHER_HOVER_CLOSE_DELAY_MILLISECONDS = 120

interface WorkspaceSplitLauncherProps {
  rootClass: string
  rootRole?: JSX.IntrinsicElements["div"]["role"]
  rootAriaLabel?: string
  menuClass: string
  disabled: boolean
  open: boolean
  title: string
  primaryAriaLabel: string
  menuAriaLabel: string
  primaryDataUI?: string
  menuDataUI?: string
  pressed?: boolean
  primaryChildren: JSX.Element
  menuButtonChildren: JSX.Element
  onPrimaryClick: () => void | Promise<void>
  onOpenChange: (open: boolean) => void
  children: JSX.Element
}

function launcherErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function runWorkspaceLauncherAction(label: string, action: () => void | Promise<void>): void {
  try {
    void Promise.resolve(action()).catch((error) => {
      reportError({
        id: `workspace-launcher:${label}`,
        title: t("common.error"),
        message: launcherErrorMessage(error),
        details: formatErrorDetails(error),
      })
    })
  } catch (error) {
    reportError({
      id: `workspace-launcher:${label}`,
      title: t("common.error"),
      message: launcherErrorMessage(error),
      details: formatErrorDetails(error),
    })
  }
}

export function WorkspaceSplitLauncherItem(props: {
  class: string
  children: JSX.Element
  dataAttributes?: Record<string, string>
  onSelect: () => void | Promise<void>
}): JSX.Element {
  return (
    <DropdownMenu.Item
      as="button"
      type="button"
      class={props.class}
      {...props.dataAttributes}
      onSelect={() => runWorkspaceLauncherAction(props.class, props.onSelect)}
    >
      {props.children}
    </DropdownMenu.Item>
  )
}

export function WorkspaceSplitLauncher(props: WorkspaceSplitLauncherProps): JSX.Element {
  let hoverCloseTimer: ReturnType<typeof setTimeout> | undefined
  let hoverFocusRestoreFrame: number | undefined
  let openedFromMouseHover = false
  let focusBeforeMouseHover: HTMLElement | null = null

  function clearHoverCloseTimer(): void {
    if (hoverCloseTimer === undefined) return
    clearTimeout(hoverCloseTimer)
    hoverCloseTimer = undefined
  }

  function clearHoverFocusRestoreFrame(): void {
    if (hoverFocusRestoreFrame === undefined) return
    cancelAnimationFrame(hoverFocusRestoreFrame)
    hoverFocusRestoreFrame = undefined
  }

  function openFromMouseHover(): void {
    clearHoverCloseTimer()
    if (props.disabled) return
    clearHoverFocusRestoreFrame()
    focusBeforeMouseHover = document.activeElement instanceof HTMLElement ? document.activeElement : null
    openedFromMouseHover = true
    props.onOpenChange(true)
  }

  function keepOpenFromMouseHover(): void {
    clearHoverCloseTimer()
  }

  function prepareMenuTriggerInteraction(): void {
    clearHoverCloseTimer()
    clearHoverFocusRestoreFrame()
    openedFromMouseHover = false
    focusBeforeMouseHover = null
  }

  function preserveFocusForMouseHover(event: Event): void {
    if (!openedFromMouseHover) return
    event.preventDefault()
    const focusTarget = focusBeforeMouseHover
    clearHoverFocusRestoreFrame()
    hoverFocusRestoreFrame = requestAnimationFrame(() => {
      hoverFocusRestoreFrame = requestAnimationFrame(() => {
        hoverFocusRestoreFrame = undefined
        if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true })
      })
    })
  }

  function preventFocusDismissForMouseHover(event: Event): void {
    if (openedFromMouseHover) event.preventDefault()
  }

  function closeAfterMouseLeave(): void {
    clearHoverCloseTimer()
    hoverCloseTimer = setTimeout(() => {
      hoverCloseTimer = undefined
      clearHoverFocusRestoreFrame()
      openedFromMouseHover = false
      focusBeforeMouseHover = null
      props.onOpenChange(false)
    }, WORKSPACE_LAUNCHER_HOVER_CLOSE_DELAY_MILLISECONDS)
  }

  function close(): void {
    clearHoverCloseTimer()
    clearHoverFocusRestoreFrame()
    openedFromMouseHover = false
    focusBeforeMouseHover = null
    props.onOpenChange(false)
  }

  function primaryClick(): void {
    if (props.disabled) return
    close()
    runWorkspaceLauncherAction(props.title, props.onPrimaryClick)
  }

  onCleanup(() => {
    clearHoverCloseTimer()
    clearHoverFocusRestoreFrame()
  })

  return (
    <DropdownMenu.Root
      open={props.open}
      onOpenChange={(open) => props.onOpenChange(props.disabled ? false : open)}
      modal={false}
      placement="bottom-end"
      gutter={6}
    >
      <div
        class={props.rootClass}
        data-no-drag="true"
        role={props.rootRole}
        aria-label={props.rootAriaLabel}
        onMouseEnter={openFromMouseHover}
        onMouseLeave={closeAfterMouseLeave}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-chrome="workspace-split-primary"
          data-ui={props.primaryDataUI}
          aria-pressed={props.pressed}
          title={props.title}
          aria-label={props.primaryAriaLabel}
          disabled={props.disabled}
          onClick={primaryClick}
        >
          {props.primaryChildren}
        </Button>
        <DropdownMenu.Trigger
          as={Button}
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-chrome="workspace-split-menu"
          data-ui={props.menuDataUI}
          disabled={props.disabled}
          title={props.title}
          aria-label={props.menuAriaLabel}
          onPointerDown={prepareMenuTriggerInteraction}
          onKeyDown={prepareMenuTriggerInteraction}
        >
          {props.menuButtonChildren}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            class={props.menuClass}
            onOpenAutoFocus={preserveFocusForMouseHover}
            onFocusOutside={preventFocusDismissForMouseHover}
            onMouseEnter={keepOpenFromMouseHover}
            onMouseLeave={closeAfterMouseLeave}
          >
            {props.children}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </div>
    </DropdownMenu.Root>
  )
}
