import type { EmbedOptions } from "vega-embed"
import "./vega-embed.css"

const rejectExternalVegaResource = async (uri: string): Promise<never> => {
  throw new Error(`External Vega resources are disabled: ${uri}`)
}

const inlineOnlyVegaLoader = Object.freeze({
  load: rejectExternalVegaResource,
  sanitize: rejectExternalVegaResource,
  http: rejectExternalVegaResource,
  file: rejectExternalVegaResource,
}) satisfies NonNullable<EmbedOptions["loader"]>

const localVegaActions = Object.freeze({
  export: true,
  source: false,
  compiled: false,
  editor: false,
})

const localVegaTooltip = Object.freeze({
  disableDefaultStyle: true,
})

export const INLINE_VEGA_EMBED_OPTIONS = Object.freeze({
  actions: localVegaActions,
  ast: true,
  defaultStyle: false,
  mode: "vega-lite",
  renderer: "svg",
  tooltip: localVegaTooltip,
  loader: inlineOnlyVegaLoader,
}) satisfies EmbedOptions
