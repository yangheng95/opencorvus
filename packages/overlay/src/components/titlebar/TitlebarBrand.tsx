import brandLogoUrl from "../../opencorvus-logo-dark.svg"

export function TitlebarBrand() {
  return (
    <div class="titlebar-brand-identity" aria-label="OpenCorvus">
      <img class="brand-logo" src={brandLogoUrl} alt="" aria-hidden="true" />
      <span class="titlebar-brand-identity__copy" aria-hidden="true">
        <span class="titlebar-brand-identity__wordmark">OpenCorvus</span>
      </span>
    </div>
  )
}
