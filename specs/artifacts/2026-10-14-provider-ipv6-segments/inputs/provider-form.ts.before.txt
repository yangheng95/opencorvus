export interface ProviderFormValues {
  name: string
  api: string
  env: string
  models: string
}

function sanitizeProviderId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/** Resolve the declaration key shared by the form preview, discovery and save. */
export function providerFormID(input: { existing?: string | null; id: string; name: string; api: string }): string {
  if (input.existing) return input.existing
  const explicit = sanitizeProviderId(input.id) || sanitizeProviderId(input.name)
  if (explicit) return explicit
  try {
    const url = new URL(input.api.trim())
    const host = url.hostname
    if (host.startsWith("[") && host.endsWith("]")) {
      return sanitizeProviderId(`ipv6-${host.slice(1, -1)}${url.port ? `-${url.port}` : ""}`)
    }
    if (/^\d+(?:\.\d+){3}$/.test(host) || host === "localhost" || host.endsWith(".localhost")) {
      return sanitizeProviderId(url.host)
    }
    const parts = host.split(".").filter(Boolean)
    return sanitizeProviderId(parts.length >= 2 ? parts[parts.length - 2]! : (parts[0] ?? ""))
  } catch {
    return ""
  }
}

type ProviderDefinition = Record<string, unknown>

type ProviderFormApiCode = "PROVIDER_API_REQUIRED" | "PROVIDER_API_INVALID"

export class ProviderFormApiError extends Error {
  constructor(readonly code: ProviderFormApiCode) {
    super(code === "PROVIDER_API_REQUIRED" ? "API URL is required." : "API URL must be a valid absolute HTTP(S) URL.")
    this.name = "ProviderFormApiError"
  }
}

/** Validate an explicit endpoint edit; untouched fields remain owned by the current definition. */
export function validateProviderFormApi(
  raw: string,
  initial?: string,
): { ok: true; changed: boolean; value: string } | { ok: false; changed: true; code: ProviderFormApiCode } {
  const normalize = (value: string) => value.trim().replace(/\/+$/, "")
  const value = normalize(raw)
  if (initial !== undefined && value === normalize(initial)) return { ok: true, changed: false, value }
  if (!value) return { ok: false, changed: true, code: "PROVIDER_API_REQUIRED" }
  try {
    const url = new URL(value)
    if (
      !/^https?:\/\//i.test(value) ||
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return { ok: false, changed: true, code: "PROVIDER_API_INVALID" }
    }
    return { ok: true, changed: true, value }
  } catch {
    return { ok: false, changed: true, code: "PROVIDER_API_INVALID" }
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function providerModelIDs(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ]
}

function environmentNames(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,\r\n]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ]
}

export function providerFormValues(config: ProviderDefinition): ProviderFormValues {
  return {
    name: typeof config.name === "string" ? config.name : "",
    api: typeof config.api === "string" ? config.api : "",
    env: Array.isArray(config.env) ? config.env.filter((value) => typeof value === "string").join(", ") : "",
    models: record(config.models) ? Object.keys(config.models).join("\n") : "",
  }
}

export class ProviderFormConflictError extends Error {
  constructor(readonly code: "PROVIDER_ALREADY_EXISTS" | "PROVIDER_REMOVED") {
    super(
      code === "PROVIDER_ALREADY_EXISTS"
        ? "This provider ID already exists. Choose another ID or edit the existing provider."
        : "This provider was removed while editing. Reopen the provider list before saving.",
    )
    this.name = "ProviderFormConflictError"
  }
}

/** Apply only explicit edits to the latest canonical definition read by the config writer. */
export function applyProviderForm(input: {
  id: string
  current: unknown
  initial: ProviderFormValues | null
  values: ProviderFormValues
}): ProviderDefinition {
  const { id, initial, values } = input
  const current = record(input.current) ? input.current : undefined
  if (!initial && current) throw new ProviderFormConflictError("PROVIDER_ALREADY_EXISTS")
  if (initial && !current) throw new ProviderFormConflictError("PROVIDER_REMOVED")
  const next: ProviderDefinition = structuredClone(current ?? {})
  const name = (value: string) => value.trim() || id
  if (!initial || name(values.name) !== name(initial.name)) next.name = name(values.name)
  const api = validateProviderFormApi(values.api, initial?.api)
  if (api.ok === false) throw new ProviderFormApiError(api.code)
  if (api.changed) next.api = api.value
  const env = environmentNames(values.env)
  if (!initial || JSON.stringify(env) !== JSON.stringify(environmentNames(initial.env))) next.env = env

  const initialIDs = new Set(initial ? providerModelIDs(initial.models) : [])
  const selectedIDs = new Set(providerModelIDs(values.models))
  const changedModels =
    !initial || initialIDs.size !== selectedIDs.size || [...initialIDs].some((modelID) => !selectedIDs.has(modelID))
  if (changedModels) {
    const models: Record<string, unknown> = record(next.models) ? next.models : {}
    for (const modelID of initialIDs) {
      if (!selectedIDs.has(modelID)) delete models[modelID]
    }
    for (const modelID of selectedIDs) {
      // An unchanged ID removed by a concurrent writer remains removed.
      if (!initialIDs.has(modelID) && !Object.hasOwn(models, modelID)) {
        Object.defineProperty(models, modelID, {
          value: { name: modelID, tool_call: true },
          enumerable: true,
          configurable: true,
          writable: true,
        })
      }
    }
    next.models = models
  }
  return next
}
