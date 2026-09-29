import type { Quotation } from "../services/quotation"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"

export function QuotationChip(props: { quotation: Quotation; onRemove: () => void }) {
  return (
    <div class="quotation-chip" data-ui="quotation-chip">
      <Icon name="quotation" />
      <div class="quotation-chip__content">
        <span>{t("quotation.selected")}</span>
        <blockquote>{props.quotation.text}</blockquote>
      </div>
      <Button
        variant="ghost"
        size="icon"
        tone="neutral"
        aria-label={t("quotation.remove")}
        title={t("quotation.remove")}
        onClick={props.onRemove}
      >
        <Icon name="close" />
      </Button>
    </div>
  )
}
