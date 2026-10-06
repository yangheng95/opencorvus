import { Show } from "solid-js"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"

export function ComposerReferenceFeedback(props: { error?: string; onRetry?: () => void }) {
  return (
    <Show when={props.error}>
      {(error) => (
        <Feedback
          tone="error"
          details={error()}
          actions={
            <Show when={props.onRetry}>
              {(retry) => (
                <Button variant="outline" size="sm" tone="neutral" type="button" onClick={() => retry()()}>
                  {t("common.retry")}
                </Button>
              )}
            </Show>
          }
        >
          {t("chat.references.catalog_unavailable")}
        </Feedback>
      )}
    </Show>
  )
}
