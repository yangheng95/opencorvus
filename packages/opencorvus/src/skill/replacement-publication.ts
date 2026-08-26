import path from "node:path"
import { createHash } from "node:crypto"
import z from "zod"
import {
  digestFilesystemTree,
  DurablePublicationStore,
  type DurablePublicationOccurrence,
} from "@opencorvus-ai/util/durable-publication"
import { Global } from "@/global"

const KIND = "skill-catalog-replacement"
const SUBJECT = "catalog"

export const SkillCatalogConfigurationEffect = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z
    .object({
      kind: z.literal("market_install"),
      target: z.string().min(1),
      names: z.array(z.string().min(1)).min(1),
      policy: z.enum(["allow", "deny"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("policy"),
      names: z.array(z.string().min(1)).min(1),
      policy: z.enum(["allow", "deny"]),
    })
    .strict(),
])
export type SkillCatalogConfigurationEffect = z.infer<typeof SkillCatalogConfigurationEffect>

const Target = z
  .object({
    name: z.string().min(1),
    target: z.string().min(1),
    staging: z.string().min(1),
    backup: z.string().min(1),
    beforeDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    afterDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

const Intent = z
  .object({
    targets: z.array(Target).min(1),
    requireExisting: z.boolean(),
    configuration: SkillCatalogConfigurationEffect,
    globalConfigBeforeRevision: z.string().min(1),
  })
  .strict()

const Published = z.object({ targetCount: z.number().int().positive() }).strict()
const Configured = z.object({ globalConfigAfterRevision: z.string().min(1) }).strict()

export namespace SkillReplacementPublication {
  export const Entry = Intent.extend({
    operationID: z.string().uuid(),
    timeCreated: z.number().int().nonnegative(),
    published: z.boolean(),
    configuredRevision: z.string().optional(),
    terminal: z.enum(["committed", "rolled_back"]).optional(),
  })
  export type Entry = z.infer<typeof Entry>
  export type Target = z.infer<typeof Target>

  function store() {
    return new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
  }

  function fromOccurrence(occurrence: DurablePublicationOccurrence): Entry {
    const intent = Intent.parse(occurrence.intent.payload)
    const published = occurrence.phases.find((phase) => phase.name === "published")
    const configured = occurrence.phases.find((phase) => phase.name === "configured")
    if (occurrence.phases.some((phase) => phase.name !== "published" && phase.name !== "configured")) {
      throw new Error(`Skill replacement ${occurrence.intent.occurrenceID} has an unknown phase`)
    }
    if (configured && !published) {
      throw new Error(`Skill replacement ${occurrence.intent.occurrenceID} configured before directory publication`)
    }
    if (published && Published.parse(published.payload).targetCount !== intent.targets.length) {
      throw new Error(`Skill replacement ${occurrence.intent.occurrenceID} published an incomplete target set`)
    }
    return Entry.parse({
      ...intent,
      operationID: occurrence.intent.occurrenceID,
      timeCreated: occurrence.intent.timeCreated,
      published: Boolean(published),
      configuredRevision: configured ? Configured.parse(configured.payload).globalConfigAfterRevision : undefined,
      terminal: occurrence.terminal?.outcome,
    })
  }

  export function withCatalogOwner<T>(run: () => Promise<T>): Promise<T> {
    return store().withSubjectLock(KIND, SUBJECT, run)
  }

  export async function open(): Promise<Entry | undefined> {
    const entries = (await store().listOpen(KIND)).map(fromOccurrence)
    if (entries.length > 1) throw new Error("Skill catalog has multiple open replacement occurrences")
    return entries[0]
  }

  export async function all(): Promise<Entry[]> {
    return (await store().list(KIND))
      .map(fromOccurrence)
      .sort((left, right) => left.timeCreated - right.timeCreated || left.operationID.localeCompare(right.operationID))
  }

  export async function record(input: Omit<Entry, "published" | "configuredRevision" | "terminal">): Promise<void> {
    const entry = Entry.parse({ ...input, published: false })
    await withCatalogOwner(async () => {
      const existing = await open()
      if (existing) throw new Error(`Skill catalog already has open replacement ${existing.operationID}`)
      await store().create({
        occurrenceID: entry.operationID,
        kind: KIND,
        subject: SUBJECT,
        payload: Intent.parse({
          targets: entry.targets,
          requireExisting: entry.requireExisting,
          configuration: entry.configuration,
          globalConfigBeforeRevision: entry.globalConfigBeforeRevision,
        }),
        timeCreated: entry.timeCreated,
      })
    })
  }

  export async function markPublished(operationID: string, targetCount: number): Promise<void> {
    await store().appendPhase(KIND, {
      occurrenceID: operationID,
      sequence: 1,
      name: "published",
      payload: Published.parse({ targetCount }),
      timeCreated: Date.now(),
    })
  }

  export async function markConfigured(operationID: string, globalConfigAfterRevision: string): Promise<void> {
    await store().appendPhase(KIND, {
      occurrenceID: operationID,
      sequence: 2,
      name: "configured",
      payload: Configured.parse({ globalConfigAfterRevision }),
      timeCreated: Date.now(),
    })
  }

  export async function settle(operationID: string, outcome: "committed" | "rolled_back"): Promise<void> {
    await store().settle(KIND, {
      occurrenceID: operationID,
      outcome,
      payload: {},
      timeCreated: Date.now(),
    })
  }

  export async function revision(): Promise<string> {
    const entries = await all()
    const terminals = entries
      .filter((entry): entry is Entry & { terminal: "committed" | "rolled_back" } => Boolean(entry.terminal))
      .map((entry) => `${entry.operationID}:${entry.terminal}`)
      .sort()
    if (terminals.length === 0) return "empty"
    return createHash("sha256").update(terminals.join("\n")).digest("hex")
  }

  export function digest(directory: string): Promise<string> {
    return digestFilesystemTree(directory)
  }
}
