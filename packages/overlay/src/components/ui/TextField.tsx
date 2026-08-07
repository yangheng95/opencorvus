import { splitProps, type JSX } from "solid-js"

export const TEXT_FIELD_SIZES = ["sm", "md"] as const
export const TEXT_FIELD_VARIANTS = ["default", "search", "multiline", "group"] as const

export type TextFieldSize = (typeof TEXT_FIELD_SIZES)[number]
export type TextFieldVariant = (typeof TEXT_FIELD_VARIANTS)[number]

export interface TextFieldRootProps extends JSX.HTMLAttributes<HTMLElement> {
  as?: "div" | "label"
  size?: TextFieldSize
  variant?: TextFieldVariant
  disabled?: boolean
  invalid?: boolean
}

export type TextFieldLabelProps = JSX.HTMLAttributes<HTMLSpanElement>
export type TextFieldInputProps = JSX.InputHTMLAttributes<HTMLInputElement>
export interface TextFieldTextAreaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  surface?: "default" | "composer"
}

function classes(base: string, feature?: string): string {
  return feature ? `${base} ${feature}` : base
}

function Root(props: TextFieldRootProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "classList", "as", "size", "variant", "disabled", "invalid"])
  const shared = {
    class: classes("oc-text-field", local.class),
    "data-size": local.size ?? "md",
    "data-variant": local.variant ?? "default",
    "data-disabled": local.disabled ? "" : undefined,
    "data-invalid": local.invalid ? "" : undefined,
  }
  if (local.as === "label") {
    return <label {...(rest as JSX.LabelHTMLAttributes<HTMLLabelElement>)} {...shared} classList={local.classList} />
  }
  return <div {...(rest as JSX.HTMLAttributes<HTMLDivElement>)} {...shared} classList={local.classList} />
}

function Label(props: TextFieldLabelProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <span {...rest} class={classes("oc-text-field__label", local.class)} />
}

function Input(props: TextFieldInputProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <input {...rest} class={classes("oc-text-field__input", local.class)} />
}

function TextArea(props: TextFieldTextAreaProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "surface"])
  return (
    <textarea
      {...rest}
      class={classes("oc-text-field__textarea", local.class)}
      data-surface={local.surface ?? "default"}
    />
  )
}

function Description(props: TextFieldLabelProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <span {...rest} class={classes("oc-text-field__description", local.class)} />
}

function ErrorMessage(props: TextFieldLabelProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <span {...rest} class={classes("oc-text-field__error", local.class)} />
}

/** Canonical native text-entry semantics and visual slots. */
export const TextField = { Root, Label, Input, TextArea, Description, ErrorMessage }
