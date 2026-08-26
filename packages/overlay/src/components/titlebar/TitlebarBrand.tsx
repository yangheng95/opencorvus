import brandLogoUrl from "../../opencorvus-logo-dark.svg"

export function TitlebarBrand() {
  return (
    <a
      class="titlebar-brand-identity"
      href="https://opencorvus.com/"
      aria-label="OpenCorvus homepage"
      title="OpenCorvus homepage"
    >
      <img class="brand-logo" src={brandLogoUrl} alt="" aria-hidden="true" />
      <span class="titlebar-brand-identity__copy" aria-hidden="true">
        <span class="titlebar-brand-identity__wordmark">OpenCorvus</span>
      </span>
    </a>
  )
}
