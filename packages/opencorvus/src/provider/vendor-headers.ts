/**
 * Vendor-specific HTTP header rules.
 *
 * Same registry pattern as provider/vendor-messages.ts: per-vendor quirks
 * live here as data-driven rules, not as branches inside ProviderLLM. Adding
 * a new vendor's header convention means appending one entry.
 */
import { Installation } from "../installation"
import type { Provider } from "./provider"

interface HeaderRule {
  tag: string
  match: (model: Provider.Model) => boolean
  apply: (headers: Record<string, string>, model: Provider.Model, stickyKey?: string) => void
}

const HEADER_RULES: HeaderRule[] = [
  {
    tag: "user-agent-except-anthropic",
    // Anthropic's SDK sets its own User-Agent; don't override.
    match: (m) => m.providerID !== "anthropic",
    apply: (h) => {
      h["User-Agent"] = `opencorvus/${Installation.VERSION}`
    },
  },
]

export function applyVendorHeaders(headers: Record<string, string>, model: Provider.Model, stickyKey?: string): void {
  for (const rule of HEADER_RULES) {
    if (rule.match(model)) rule.apply(headers, model, stickyKey)
  }
}
