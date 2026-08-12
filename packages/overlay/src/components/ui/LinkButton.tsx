import { splitProps, type JSX } from "solid-js"
import type { ButtonSize, ButtonTone, ButtonVariant } from "./Button"

export interface LinkButtonProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant: ButtonVariant
  size: ButtonSize
  tone: ButtonTone
}

export function LinkButton(props: LinkButtonProps): JSX.Element {
  const [local, anchorProps] = splitProps(props, ["variant", "size", "tone", "class"])
  const className = () => (local.class ? `oc-button ${local.class}` : "oc-button")

  return (
    <a
      {...anchorProps}
      class={className()}
      data-variant={local.variant}
      data-size={local.size}
      data-tone={local.tone}
    />
  )
}
