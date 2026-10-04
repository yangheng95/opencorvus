export interface ProviderFormValues {
  name: string
  api: string
  env: string
  models: string
}

type ProviderDefinition = Record<string, unknown>

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
  const api = (value: string) => value.trim().replace(/\/+$/, "")
  if (!initial || name(values.name) !== name(initial.name)) next.name = name(values.name)
  if (!initial || api(values.api) !== api(initial.api)) next.api = api(values.api)
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
