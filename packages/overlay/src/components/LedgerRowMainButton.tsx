import type { JSX } from "solid-js"
import { Button } from "./ui/Button"

export interface LedgerRowMainButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class"> {
  class?: string
}

export function LedgerRowMainButton(props: LedgerRowMainButtonProps): JSX.Element {
  const className = () => (props.class ? `task-row-main ${props.class}` : "task-row-main")

  return (
    <Button
      {...props}
      type={props.type ?? "button"}
      variant="ghost"
      size="sm"
      tone="neutral"
      class={className()}
      data-ui="ledger-row-main"
    />
  )
}
