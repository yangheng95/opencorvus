// ── InteractionDialogHost ──
// Pops the oldest pending permission/question interaction into a dismissible
// overlay so the user never has to hunt for the answer surface inside the
// conversation timeline or task-scope panel. The inline <InteractionCard>
// still renders in both surfaces as the persistent record; replies funnel
// through the same services/interaction-reply mutex, so submitting in either
// surface is safe.
//
// Behavior:
//   • Reactively reads the card tree's normalized interaction-card parts,
//     picks the oldest pending interaction not already dismissed for this
//     overlay session.
//   • Reuses <InteractionCard> for the body — there is exactly one place that
//     renders an interaction (rule 8 / rule 9). The card already closes the
//     loop with loadBoard() after a successful reply, which collapses the
//     dialog automatically once status moves off "pending".
//   • Esc / backdrop click marks the current interaction id as dismissed for
//     the lifetime of the host (until status changes or a fresh id arrives),
//     letting the user fall back to the inline card without the popup
//     re-asserting itself for the same prompt.

import { createMemo, createSignal, Show } from "solid-js"
import { cardTreeStore } from "../store/card-tree"
import { collectDialogInteractions, pickDialogInteraction } from "../utils/interaction-dialog"
import { t } from "../utils/i18n"
import { InteractionCard, type InteractionData } from "./InteractionCard"
import { Dialog } from "./ui/Dialog"

export function InteractionDialogHost() {
  const [dismissed, setDismissed] = createSignal<ReadonlySet<string>>(new Set())

  const current = createMemo<InteractionData | null>(() => {
    const list = collectDialogInteractions(cardTreeStore.cards) as InteractionData[]
    const it = pickDialogInteraction(list, dismissed())
    if (!it) return null
    const pruned = pruneDismissed(dismissed(), list)
    if (pruned !== dismissed()) setDismissed(pruned)
    return it
  })

  const titleText = (it: InteractionData) => {
    return it.type === "permission" ? t("interaction.icon.permission") : t("interaction.icon.question")
  }

  return (
    <Show when={current()} keyed>
      {(it) => (
        <Dialog
          id="interactionDialog"
          open={true}
          backdropClose={true}
          modal={false}
          overlayClass="interaction-dialog-backdrop"
          title={<span>{titleText(it)}</span>}
          formClass="interaction-dialog-form"
          onClose={() => {
            setDismissed((prev) => {
              const next = new Set(prev)
              next.add(it.id)
              return next
            })
          }}
        >
          <InteractionCard interaction={it} surface="dialog" />
        </Dialog>
      )}
    </Show>
  )
}

function pruneDismissed(dismissed: ReadonlySet<string>, interactions: InteractionData[]): ReadonlySet<string> {
  if (dismissed.size === 0) return dismissed
  const stillPending = new Set<string>()
  for (const it of interactions) {
    if (it?.status === "pending" && dismissed.has(it.id)) stillPending.add(it.id)
  }
  if (stillPending.size === dismissed.size) return dismissed
  return stillPending
}
