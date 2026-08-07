import type { JSX } from "solid-js"
import { SelectControl } from "./SelectControl"

export interface SelectFieldOption {
  value: string
  label: string
  description?: string
}

export interface SelectFieldProps<T extends SelectFieldOption> {
  options: T[]
  value: string
  ariaLabel: string
  onChange: (next: string) => void
  disabled?: boolean
  placeholder?: string
  testid?: string
  class?: string
  optionData?: (option: T) => Record<string, string | undefined>
}

/**
 * Canonical value-based select. Domain surfaces provide data and layout only;
 * trigger, popup, option, indicator, and focus chrome stay owned by primitives.
 */
export function SelectField<T extends SelectFieldOption>(props: SelectFieldProps<T>): JSX.Element {
  const selectedOption = () => props.options.find((option) => option.value === props.value) ?? null
  const setSelectedOption = (option: T | null) => {
    if (!option || option.value === props.value) return
    props.onChange(option.value)
  }

  return (
    <SelectControl<T>
      class={props.class}
      options={props.options}
      value={selectedOption()}
      onChange={setSelectedOption}
      optionValue="value"
      optionTextValue="label"
      disabled={props.disabled}
      disallowEmptySelection
      triggerTestID={props.testid}
      ariaLabel={props.ariaLabel}
      optionData={props.optionData}
      renderValue={(selected) => <span>{selected?.label ?? props.placeholder ?? ""}</span>}
      renderOptionLabel={(option) => option.label}
      renderOptionDescription={(option) => option.description}
    />
  )
}
