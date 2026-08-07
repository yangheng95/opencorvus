import * as KobalteSlider from "@kobalte/core/slider"
import { splitProps, type ComponentProps, type JSX } from "solid-js"

function classes(base: string, feature?: string): string {
  return feature ? `${base} ${feature}` : base
}

function SliderRoot(props: ComponentProps<typeof KobalteSlider.Root>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteSlider.Root {...rest} class={classes("oc-slider", local.class)} />
}

function SliderTrack(props: ComponentProps<typeof KobalteSlider.Track>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteSlider.Track {...rest} class={classes("oc-slider-track", local.class)} />
}

function SliderFill(props: ComponentProps<typeof KobalteSlider.Fill>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteSlider.Fill {...rest} class={classes("oc-slider-fill", local.class)} />
}

function SliderThumb(props: ComponentProps<typeof KobalteSlider.Thumb>): JSX.Element {
  const [local, rest] = splitProps(props, ["class"])
  return <KobalteSlider.Thumb {...rest} class={classes("oc-slider-thumb", local.class)} />
}

/** Canonical accessible slider behavior and visual slots. */
export const Slider = {
  Root: SliderRoot,
  Label: KobalteSlider.Label,
  ValueLabel: KobalteSlider.ValueLabel,
  Track: SliderTrack,
  Fill: SliderFill,
  Thumb: SliderThumb,
  Input: KobalteSlider.Input,
}
