import { Show } from "solid-js"
import { formatErrorDetails } from "../services/diagnostics"
import type { ExpertSquadMarketInstallOutcome } from "../services/expert-squad"
import { t } from "../utils/i18n"
import { Feedback } from "./ui/Feedback"

type InstallWithoutReceipt = Exclude<ExpertSquadMarketInstallOutcome, { kind: "receipt" }>

function summary(outcome: InstallWithoutReceipt): string {
  return outcome.kind === "confirmed"
    ? t("expert_squad.market_install_confirmed_without_receipt", { id: outcome.inspection.id })
    : t("expert_squad.market_install_unconfirmed", { id: outcome.id })
}

function details(outcome: InstallWithoutReceipt): string {
  const original = formatErrorDetails(outcome.receiptError)
  return outcome.kind === "confirmed"
    ? original
    : [original, formatErrorDetails(outcome.inspectionError)].filter(Boolean).join("\n\n")
}

export function ExpertSquadMarketInstallFeedback(props: { outcome: ExpertSquadMarketInstallOutcome | undefined }) {
  const result = () => props.outcome?.kind === "receipt" ? undefined : props.outcome
  return (
    <Show when={result()}>
      {(outcome) => (
        <Feedback
          tone={outcome().kind === "confirmed" ? "info" : "error"}
          data-ui="expert-squad-market-install-feedback"
          details={details(outcome())}
        >
          {summary(outcome())}
        </Feedback>
      )}
    </Show>
  )
}
