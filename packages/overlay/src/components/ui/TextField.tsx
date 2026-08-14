import {
  createContext,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  splitProps,
  useContext,
  type JSX,
  type Setter,
} from "solid-js"

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

interface TextFieldContextValue {
  descriptionID: string
  errorID: string
  invalid: () => boolean
  descriptionPresent: () => boolean
  errorPresent: () => boolean
  setDescriptionPresent: Setter<boolean>
  setErrorPresent: Setter<boolean>
}

const TextFieldContext = createContext<TextFieldContextValue>()

export function useTextFieldControlProps(): {
  describedBy: () => string | undefined
  invalid: () => boolean
  errorMessageID: () => string | undefined
} {
  const context = useContext(TextFieldContext)
  return {
    describedBy: () =>
      [
        context?.descriptionPresent() ? context.descriptionID : undefined,
        context?.errorPresent() ? context.errorID : undefined,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    invalid: () => Boolean(context?.invalid()),
    errorMessageID: () => (context?.invalid() && context.errorPresent() ? context.errorID : undefined),
  }
}

function classes(base: string, feature?: string): string {
  return feature ? `${base} ${feature}` : base
}

function Root(props: TextFieldRootProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "classList", "as", "size", "variant", "disabled", "invalid"])
  const id = createUniqueId()
  const [descriptionPresent, setDescriptionPresent] = createSignal(false)
  const [errorPresent, setErrorPresent] = createSignal(false)
  const context: TextFieldContextValue = {
    descriptionID: `${id}-description`,
    errorID: `${id}-error`,
    invalid: () => Boolean(local.invalid),
    descriptionPresent,
    errorPresent,
    setDescriptionPresent,
    setErrorPresent,
  }
  const shared = {
    class: classes("oc-text-field", local.class),
    "data-size": local.size ?? "md",
    "data-variant": local.variant ?? "default",
    "data-disabled": local.disabled ? "" : undefined,
    "data-invalid": local.invalid ? "" : undefined,
  }
  return (
    <TextFieldContext.Provider value={context}>
      {local.as === "label" ? (
        <label {...(rest as JSX.LabelHTMLAttributes<HTMLLabelElement>)} {...shared} classList={local.classList} />
      ) : (
        <div {...(rest as JSX.HTMLAttributes<HTMLDivElement>)} {...shared} classList={local.classList} />
      )}
    </TextFieldContext.Provider>
  )
}

function Label(props: TextFieldLabelProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <span {...rest} class={classes("oc-text-field__label", local.class)} />
}

function Input(props: TextFieldInputProps): JSX.Element {
  const context = useContext(TextFieldContext)
  const [local, rest] = splitProps(props, ["class", "aria-describedby", "aria-invalid", "aria-errormessage"])
  const describedBy = () =>
    [
      local["aria-describedby"],
      context?.descriptionPresent() ? context.descriptionID : undefined,
      context?.errorPresent() ? context.errorID : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined
  return (
    <input
      {...rest}
      class={classes("oc-text-field__input", local.class)}
      aria-describedby={describedBy()}
      aria-invalid={local["aria-invalid"] ?? (context?.invalid() ? "true" : undefined)}
      aria-errormessage={
        local["aria-errormessage"] ?? (context?.invalid() && context.errorPresent() ? context.errorID : undefined)
      }
    />
  )
}

function TextArea(props: TextFieldTextAreaProps): JSX.Element {
  const context = useContext(TextFieldContext)
  const [local, rest] = splitProps(props, [
    "class",
    "surface",
    "aria-describedby",
    "aria-invalid",
    "aria-errormessage",
  ])
  const describedBy = () =>
    [
      local["aria-describedby"],
      context?.descriptionPresent() ? context.descriptionID : undefined,
      context?.errorPresent() ? context.errorID : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined
  return (
    <textarea
      {...rest}
      class={classes("oc-text-field__textarea", local.class)}
      data-surface={local.surface ?? "default"}
      aria-describedby={describedBy()}
      aria-invalid={local["aria-invalid"] ?? (context?.invalid() ? "true" : undefined)}
      aria-errormessage={
        local["aria-errormessage"] ?? (context?.invalid() && context.errorPresent() ? context.errorID : undefined)
      }
    />
  )
}

function Description(props: TextFieldLabelProps): JSX.Element {
  const context = useContext(TextFieldContext)
  const [local, rest] = splitProps(props, ["class", "id"])
  onMount(() => context?.setDescriptionPresent(true))
  onCleanup(() => context?.setDescriptionPresent(false))
  return <span {...rest} id={local.id ?? context?.descriptionID} class={classes("oc-text-field__description", local.class)} />
}

function ErrorMessage(props: TextFieldLabelProps): JSX.Element {
  const context = useContext(TextFieldContext)
  const [local, rest] = splitProps(props, ["class", "id"])
  onMount(() => context?.setErrorPresent(true))
  onCleanup(() => context?.setErrorPresent(false))
  return <span {...rest} id={local.id ?? context?.errorID} class={classes("oc-text-field__error", local.class)} />
}

/** Canonical native text-entry semantics and visual slots. */
export const TextField = { Root, Label, Input, TextArea, Description, ErrorMessage }
