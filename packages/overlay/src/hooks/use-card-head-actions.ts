import { createSignal } from "solid-js"

import type { CardNode } from "../store/card-tree"
import { collectCardText } from "../utils/card-tree"
import { t } from "../utils/i18n"
import { showAppDialog } from "../services/app-dialog"
import { formatErrorDetails, reportError } from "../services/diagnostics"

export interface UseCardHeadActionsInput {
  node: () => CardNode
  onRewind?: (cursorTime: number, anchorID: string, opts: { resetWorktree: boolean }) => Promise<void>
  onAgentCancel?: (sessionID: string) => Promise<void>
  agentSessionID?: () => string | undefined
}

export interface UseCardHeadActionsOutput {
  state: {
    copied: () => boolean
    rewinding: () => boolean
    cancelling: () => boolean
  }
  caps: {
    canCopy: () => boolean
    canRewind: () => boolean
    rewindDisabled: () => boolean
    canCancel: () => boolean
  }
  onCopy: (e?: Event) => void
  onRewind: (e?: Event) => void
  onAgentCancel: (e?: Event) => void
  labels: {
    copy: () => string
    copied: () => string
    rewind: () => string
    rewindStep: () => string
    rewindDisabled: () => string
    cancel: () => string
  }
}

function isStageCard(node: CardNode): boolean {
  return node.kind === "agent"
}

async function writeClipboard(text: string): Promise<boolean> {
  if (!text) return false
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  return false
}

function cardHeadActionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function reportCardHeadActionError(owner: string, nodeID: string, error: unknown): void {
  reportError({
    id: `card-head:${owner}:${nodeID}`,
    title: t("common.error"),
    message: cardHeadActionErrorMessage(error),
    details: formatErrorDetails(error),
  })
}

function runCardHeadAction(owner: string, nodeID: string, action: () => void | Promise<void>): void {
  try {
    void Promise.resolve(action()).catch((error) => reportCardHeadActionError(owner, nodeID, error))
  } catch (error) {
    reportCardHeadActionError(owner, nodeID, error)
  }
}

export function useCardHeadActions(input: UseCardHeadActionsInput): UseCardHeadActionsOutput {
  const [copied, setCopied] = createSignal(false)
  const [rewinding, setRewinding] = createSignal(false)
  const [cancelling, setCancelling] = createSignal(false)

  const canCopy = () => !!collectCardText(input.node())
  const canRewind = () => {
    const node = input.node()
    return !!input.onRewind && isStageCard(node) && typeof node.time === "number" && node.time > 0
  }
  const rewindDisabled = () => canRewind()
  const canCancel = () => input.node().status === "running" && !!input.onAgentCancel && !!input.agentSessionID?.()

  const onCopy = (event?: Event) => {
    event?.stopPropagation()
    runCardHeadAction("copy", input.node().id, async () => {
      const text = collectCardText(input.node())
      if (!text) return
      const ok = await writeClipboard(text)
      if (!ok) return
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  const onRewind = (event?: Event) => {
    event?.stopPropagation()
    if (rewindDisabled()) return
    if (!input.onRewind || !canRewind() || rewinding()) return
    runCardHeadAction("rewind", input.node().id, async () => {
      const choice = await showAppDialog({
        title: t("card.rewind_confirm.title"),
        message: t("card.rewind_confirm.message"),
        select: true,
        selectValue: "view",
        selectOptions: [
          { value: "view", label: t("card.rewind_confirm.audit_only") },
          { value: "worktree", label: t("card.rewind_confirm.with_worktree") },
        ],
        okLabel: t("card.rewind_confirm.apply"),
        cancel: true,
        cancelLabel: t("common.cancel"),
      })
      if (!choice.confirmed || !choice.value) return
      setRewinding(true)
      try {
        const node = input.node()
        await input.onRewind!(node.time, node.id, {
          resetWorktree: choice.value === "worktree",
        })
      } catch (error) {
        reportError({
          id: `card-rewind:${input.node().id}`,
          title: t("card.rewind_failed_title"),
          message: t("card.rewind_failed_message"),
          details: formatErrorDetails(error),
        })
      } finally {
        setTimeout(() => setRewinding(false), 800)
      }
    })
  }

  const onAgentCancel = (event?: Event) => {
    event?.stopPropagation()
    const sessionID = input.agentSessionID?.()
    if (!sessionID || !input.onAgentCancel || cancelling()) return
    runCardHeadAction("agent-cancel", input.node().id, async () => {
      setCancelling(true)
      try {
        await input.onAgentCancel!(sessionID)
      } finally {
        setTimeout(() => setCancelling(false), 800)
      }
    })
  }

  return {
    state: {
      copied,
      rewinding,
      cancelling,
    },
    caps: {
      canCopy,
      canRewind,
      rewindDisabled,
      canCancel,
    },
    onCopy,
    onRewind,
    onAgentCancel,
    labels: {
      copy: () => t("common.copy"),
      copied: () => t("common.copied"),
      rewind: () => t("card.rewind"),
      rewindStep: () => t("card.rewind_step"),
      rewindDisabled: () => t("card.rewind_disabled"),
      cancel: () => t("card.agent_cancel"),
    },
  }
}
