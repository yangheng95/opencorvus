import path from "node:path"
import z from "zod"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { withSharedJsonFactLock } from "@/util/process-lock"
import { ExpertSquadIDSchema } from "./id"
import { ExpertSquadNamespaceSchema } from "./id"
import { ExpertSquadPackageLocations } from "./locations"
import type { ExpertSquadConfiguration } from "./protocol-schema"

const ConfigurationValueSchema = z.union([z.string().min(1), z.boolean()])
const StoredConfigurationSchema = z.record(
  z.string().min(1),
  z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), ConfigurationValueSchema),
)

export const ExpertSquadConfigurationIdentitySchema = z
  .object({
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
    projectID: z.string().min(1).nullable(),
    namespace: ExpertSquadNamespaceSchema,
    id: ExpertSquadIDSchema,
  })
  .strict()
  .superRefine((identity, context) => {
    if (identity.installationScope === "project" && identity.projectID === null) {
      context.addIssue({ code: "custom", path: ["projectID"], message: "project configuration requires projectID" })
    }
    if (identity.installationScope === "global" && identity.projectID !== null) {
      context.addIssue({ code: "custom", path: ["projectID"], message: "global configuration cannot use projectID" })
    }
  })
export type ExpertSquadConfigurationIdentity = z.output<typeof ExpertSquadConfigurationIdentitySchema>

export const ExpertSquadConfigurationUpdateSchema = z
  .object({
    id: ExpertSquadIDSchema,
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
    updates: z.record(z.string(), z.union([z.string(), z.boolean(), z.null()])),
  })
  .strict()

export const ExpertSquadConfigurationFieldStateSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    description: z.string().optional(),
    type: z.enum(["boolean", "text", "secret"]),
    required: z.boolean(),
    placeholder: z.string().optional(),
    configured: z.boolean(),
    value: z.union([z.string(), z.boolean()]).optional(),
  })
  .strict()

export const ExpertSquadConfigurationResponseSchema = z
  .object({
    id: ExpertSquadIDSchema,
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
    namespace: ExpertSquadNamespaceSchema,
    fields: z.array(ExpertSquadConfigurationFieldStateSchema),
  })
  .strict()

type StoredConfiguration = z.output<typeof StoredConfigurationSchema>
type ConfigurationValue = z.output<typeof ConfigurationValueSchema>

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: unknown }).code) === "ENOENT"
  )
}

export namespace ExpertSquadConfigurationStore {
  const filename = "expert-squad-configuration.json"
  const writeLocks = new Map<string, Promise<unknown>>()

  function filepath(): string {
    return path.join(Global.Path.data, filename)
  }

  async function read(): Promise<StoredConfiguration> {
    try {
      return StoredConfigurationSchema.parse(await Filesystem.readJson(filepath()))
    } catch (error) {
      if (isEnoent(error)) return {}
      throw new Error(
        `Failed to read expert squad configuration ${filepath()}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
  }

  async function write(value: StoredConfiguration): Promise<void> {
    await Filesystem.writeAtomic(
      filepath(),
      `${JSON.stringify(StoredConfigurationSchema.parse(value), null, 2)}\n`,
      0o600,
    )
  }

  /**
   * Read, change and replace the Expert Squad configuration under one
   * cross-process lock. A module-level promise chain only ordered writers
   * inside one process, so a second backend on the same data root could drop
   * an assignment it never read.
   */
  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    return withSharedJsonFactLock({
      locks: writeLocks,
      filepath: filepath(),
      empty: "{}\n",
      mode: 0o600,
      run: operation,
    })
  }

  function fieldMap(configuration: ExpertSquadConfiguration) {
    return new Map(configuration.fields.map((field) => [field.key, field]))
  }

  function storageKey(identity: ExpertSquadConfigurationIdentity): string {
    const parsed = ExpertSquadConfigurationIdentitySchema.parse(identity)
    return [parsed.installationScope, parsed.projectID ?? "global", parsed.namespace, parsed.id].join("/")
  }

  function validateUpdate(field: ExpertSquadConfiguration["fields"][number], value: unknown): ConfigurationValue {
    if (field.type === "boolean") {
      if (typeof value !== "boolean") throw new Error(`Expert squad configuration ${field.key} requires a boolean`)
      return value
    }
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Expert squad configuration ${field.key} requires a non-empty string`)
    }
    return value
  }

  export async function inspect(input: {
    identity: ExpertSquadConfigurationIdentity
    configuration: ExpertSquadConfiguration
  }) {
    const identity = ExpertSquadConfigurationIdentitySchema.parse(input.identity)
    const values = (await read())[storageKey(identity)] ?? {}
    return ExpertSquadConfigurationResponseSchema.parse({
      id: identity.id,
      installationScope: identity.installationScope,
      namespace: identity.namespace,
      fields: input.configuration.fields.map((field) => {
        const value = values[field.key]
        return {
          ...field,
          configured: value !== undefined,
          ...(field.type !== "secret" && value !== undefined ? { value } : {}),
        }
      }),
    })
  }

  export async function update(input: {
    identity: ExpertSquadConfigurationIdentity
    configuration: ExpertSquadConfiguration
    updates: Record<string, string | boolean | null>
  }) {
    const identity = ExpertSquadConfigurationIdentitySchema.parse(input.identity)
    const id = identity.id
    const key = storageKey(identity)
    const fields = fieldMap(input.configuration)
    for (const key of Object.keys(input.updates)) {
      if (!fields.has(key)) throw new Error(`Expert squad ${id} does not declare configuration field ${key}`)
    }
    return serialized(async () => {
      const stored = await read()
      const current = { ...(stored[key] ?? {}) }
      for (const [key, next] of Object.entries(input.updates)) {
        if (next === null) delete current[key]
        else current[key] = validateUpdate(fields.get(key)!, next)
      }
      const next = { ...stored }
      if (Object.keys(current).length === 0) delete next[key]
      else next[key] = current
      await write(next)
      return inspect({ identity, configuration: input.configuration })
    })
  }

  export async function values(input: {
    identity: ExpertSquadConfigurationIdentity
    configuration?: ExpertSquadConfiguration
  }) {
    if (!input.configuration) return {}
    const identity = ExpertSquadConfigurationIdentitySchema.parse(input.identity)
    const stored = (await read())[storageKey(identity)] ?? {}
    const values: Record<string, ConfigurationValue> = {}
    for (const field of input.configuration.fields) {
      const value = stored[field.key]
      if (value === undefined) continue
      values[field.key] = value
    }
    return Object.freeze(values)
  }
}
