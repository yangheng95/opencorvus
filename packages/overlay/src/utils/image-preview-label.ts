import { t } from "./i18n"

export function imagePreviewTriggerLabel(alt?: string): string {
  const label = alt?.trim() ?? ""
  return label ? t("image_preview.open_trigger_with_alt", { alt: label }) : t("image_preview.open_trigger")
}
