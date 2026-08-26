import path from "node:path"
import z from "zod"
import {
  digestFilesystemTree,
  DurablePublicationStore,
  type DurablePublicationOccurrence,
} from "@opencorvus-ai/util/durable-publication"
import { Global } from "../global"

const KIND = "project-promotion"

export const PromotionDatabaseSnapshot = z
  .object({
    project: z.object({
      worktree: z.string(),
      name: z.string().nullable(),
      sandboxes: z.array(z.string()),
      generation: z.string().uuid(),
      timeUpdated: z.number().int().nonnegative(),
    }),
    sessions: z.array(
      z.object({
        id: z.string(),
        directory: z.string(),
        metadata: z.record(z.string(), z.json()).nullable(),
        timeUpdated: z.number().int().nonnegative(),
      }),
    ),
  })
  .strict()
export type PromotionDatabaseSnapshot = z.infer<typeof PromotionDatabaseSnapshot>

const IntentPayload = z
  .object({
    projectID: z.string().min(1),
    projectGeneration: z.string().uuid(),
    source: z.string().min(1),
    physicalSource: z.string().min(1),
    quarantine: z.string().min(1),
    staging: z.string().min(1),
    destination: z.string().min(1),
    name: z.string().min(1),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    database: PromotionDatabaseSnapshot,
  })
  .strict()

const PreparedPayload = z.object({ destinationDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict()

export namespace PromotionJournal {
  export const Entry = IntentPayload.extend({
    operationID: z.string().uuid(),
    time_created: z.number().int().nonnegative(),
    destinationDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    published: z.boolean(),
  })
  export type Entry = z.infer<typeof Entry>

  function store(): DurablePublicationStore {
    return new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
  }

  function intentPayload(entry: Entry): z.infer<typeof IntentPayload> {
    return IntentPayload.parse({
      projectID: entry.projectID,
      projectGeneration: entry.projectGeneration,
      source: entry.source,
      physicalSource: entry.physicalSource,
      quarantine: entry.quarantine,
      staging: entry.staging,
      destination: entry.destination,
      name: entry.name,
      sourceDigest: entry.sourceDigest,
      database: entry.database,
    })
  }

  function fromOccurrence(occurrence: DurablePublicationOccurrence): Entry {
    const payload = IntentPayload.parse(occurrence.intent.payload)
    const prepared = occurrence.phases.find((phase) => phase.name === "prepared")
    const published = occurrence.phases.find((phase) => phase.name === "published")
    if (occurrence.phases.some((phase) => phase.name !== "prepared" && phase.name !== "published")) {
      throw new Error(`Project promotion ${occurrence.intent.occurrenceID} has an unknown phase`)
    }
    if (published && !prepared) {
      throw new Error(`Project promotion ${occurrence.intent.occurrenceID} published without a prepared digest`)
    }
    const preparedPayload = prepared ? PreparedPayload.parse(prepared.payload) : undefined
    return Entry.parse({
      ...payload,
      operationID: occurrence.intent.occurrenceID,
      time_created: occurrence.intent.timeCreated,
      destinationDigest: preparedPayload?.destinationDigest,
      published: Boolean(published),
    })
  }

  async function exactOpen(projectID: string): Promise<Entry | undefined> {
    const matches = (await store().listOpen(KIND)).map(fromOccurrence).filter((entry) => entry.projectID === projectID)
    if (matches.length > 1) throw new Error(`Project ${projectID} has multiple open promotion occurrences`)
    return matches[0]
  }

  function subject(projectID: string): string {
    return `project:${projectID}`
  }

  export function withProjectOwner<T>(projectID: string, run: () => Promise<T>): Promise<T> {
    return store().withSubjectLock(KIND, subject(projectID), run)
  }

  export async function all(): Promise<Entry[]> {
    return (await store().listOpen(KIND)).map(fromOccurrence)
  }

  export async function get(projectID: string): Promise<Entry | undefined> {
    return exactOpen(projectID)
  }

  export async function record(input: Omit<Entry, "destinationDigest" | "published">): Promise<void> {
    const entry = Entry.parse({ ...input, published: false })
    await withProjectOwner(entry.projectID, async () => {
      const existing = await exactOpen(entry.projectID)
      if (existing) {
        throw new Error(`Project ${entry.projectID} already has unconverged promotion ${existing.operationID}`)
      }
      await store().create({
        occurrenceID: entry.operationID,
        kind: KIND,
        subject: subject(entry.projectID),
        payload: intentPayload(entry),
        timeCreated: entry.time_created,
      })
    })
  }

  export async function markPrepared(operationID: string, destinationDigest: string): Promise<void> {
    await store().appendPhase(KIND, {
      occurrenceID: operationID,
      sequence: 1,
      name: "prepared",
      payload: PreparedPayload.parse({ destinationDigest }),
      timeCreated: Date.now(),
    })
  }

  export async function markPublished(operationID: string): Promise<void> {
    await store().appendPhase(KIND, {
      occurrenceID: operationID,
      sequence: 2,
      name: "published",
      payload: {},
      timeCreated: Date.now(),
    })
  }

  export async function settle(
    operationID: string,
    outcome: "committed" | "rolled_back",
    payload: Record<string, string> = {},
  ): Promise<void> {
    await store().settle(KIND, {
      occurrenceID: operationID,
      outcome,
      payload,
      timeCreated: Date.now(),
    })
  }

  export async function terminal(operationID: string) {
    return (await store().read(KIND, operationID)).terminal
  }

  export async function digestDirectory(root: string): Promise<string> {
    return digestFilesystemTree(root)
  }
}
