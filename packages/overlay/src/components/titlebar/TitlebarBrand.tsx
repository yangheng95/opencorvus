import brandLogoUrl from "../../opencorvus-logo-dark.svg"
import { t } from "../../utils/i18n"
import { appStore } from "../../store/app"

export function TitlebarBrand() {
  return (
    <a
      class="titlebar-brand-identity"
      href={`https://opencorvus.com/${appStore.locale === "zh-CN" ? "zh-cn/" : ""}`}
      aria-label={t("titlebar.homepage")}
      title={t("titlebar.homepage")}
    >
      <img class="brand-logo" src={brandLogoUrl} alt="" aria-hidden="true" />
      <span class="titlebar-brand-identity__copy" aria-hidden="true">
        <span class="titlebar-brand-identity__wordmark">OpenCorvus</span>
      </span>
    </a>
  )
}
