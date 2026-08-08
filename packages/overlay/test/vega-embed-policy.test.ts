import { expect, test } from "bun:test"
import { INLINE_VEGA_EMBED_OPTIONS } from "../src/components/interactive-artifact/vega-embed-policy"

test("inline Vega rendering uses one immutable Content Security Policy safe runtime contract", () => {
  expect(Object.isFrozen(INLINE_VEGA_EMBED_OPTIONS)).toBe(true)
  expect(Object.isFrozen(INLINE_VEGA_EMBED_OPTIONS.actions)).toBe(true)
  expect(Object.isFrozen(INLINE_VEGA_EMBED_OPTIONS.loader)).toBe(true)
  expect(Object.isFrozen(INLINE_VEGA_EMBED_OPTIONS.tooltip)).toBe(true)
  expect({
    actions: INLINE_VEGA_EMBED_OPTIONS.actions,
    ast: INLINE_VEGA_EMBED_OPTIONS.ast,
    defaultStyle: INLINE_VEGA_EMBED_OPTIONS.defaultStyle,
    mode: INLINE_VEGA_EMBED_OPTIONS.mode,
    renderer: INLINE_VEGA_EMBED_OPTIONS.renderer,
    tooltip: INLINE_VEGA_EMBED_OPTIONS.tooltip,
    loaderMethods: Object.keys(INLINE_VEGA_EMBED_OPTIONS.loader).sort(),
  }).toEqual({
    actions: {
      export: true,
      source: false,
      compiled: false,
      editor: false,
    },
    ast: true,
    defaultStyle: false,
    mode: "vega-lite",
    renderer: "svg",
    tooltip: { disableDefaultStyle: true },
    loaderMethods: ["file", "http", "load", "sanitize"],
  })
})
