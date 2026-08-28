import { createHash } from "node:crypto"
import path from "node:path"
import { DurablePublicationStore, type DurablePublicationOccurrence } from "@opencorvus-ai/util/durable-publication"
import { Global } from "../global"

/**
 * The durable readiness occurrence of one managed worktree directory.
 *
 * Git linkage is registration, not readiness: a worktree added with
 * `--no-checkout` whose population (checkout, submodules, start scripts) was
 * killed still passes `isValid`. This journal records the occurrence before
 * the `git worktree add`, advances through `created` and `populated`, and
 * settles `committed` — the READY receipt reuse requires. An occurrence
 * without that receipt is an incomplete tree whose reuse path must resume
 * population; a removed worktree forgets its occurrence.
 */
export namespace WorktreeReadiness {
  const KIND = "worktree-readiness"

  function store(): DurablePublicationStore {
    return new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
  }

  /** One occurrence per directory: the receipt's lifetime is the tree's. */
  function occurrenceID(directory: string): string {
    return createHash("sha256").update(path.resolve(directory)).digest("hex").slice(0, 40)
  }

  async function read(directory: string): Promise<DurablePublicationOccurrence | undefined> {
    try {
      return await store().read(KIND, occurrenceID(directory))
    } catch {
      return undefined
    }
  }

  export async function isReady(directory: string): Promise<boolean> {
    return (await read(directory))?.terminal?.outcome === "committed"
  }

  /**
   * Open the occurrence for a creation. Any previous occurrence for the same
   * directory is superseded: a crashed create rolls back, a stale receipt for
   * a tree the caller is re-creating is removed.
   */
  export async function begin(input: {
    projectID: string
    directory: string
    branch: string
    name: string
    primaryBranch: string
  }): Promise<string> {
    const id = occurrenceID(input.directory)
    const existing = await read(input.directory)
    if (existing) {
      if (!existing.terminal) {
        await store().settle(KIND, {
          occurrenceID: id,
          outcome: "rolled_back",
          payload: { reason: "superseded by a new creation of the same directory" },
          timeCreated: Date.now(),
        })
      }
      await store().removeSettled(KIND, id)
    }
    await store().create({
      occurrenceID: id,
      kind: KIND,
      subject: `worktree:${input.directory}`,
      payload: {
        projectID: input.projectID,
        directory: input.directory,
        branch: input.branch,
        name: input.name,
        primaryBranch: input.primaryBranch,
      },
      timeCreated: Date.now(),
    })
    return id
  }

  /**
   * Open (or adopt) the occurrence for a population resume of a registered
   * tree that has no ready receipt — a create killed mid-population, or a
   * tree that predates the journal. The physical registration exists, so the
   * occurrence starts at `created`.
   */
  export async function resume(input: {
    projectID: string
    directory: string
    branch: string
    name: string
    primaryBranch: string
  }): Promise<string> {
    const existing = await read(input.directory)
    if (existing && !existing.terminal) return existing.intent.occurrenceID
    const id = await begin(input)
    await markCreated(id)
    return id
  }

  export async function markCreated(id: string): Promise<void> {
    const occurrence = await store().read(KIND, id)
    if (occurrence.phases.some((phase) => phase.sequence === 1)) return
    await store().appendPhase(KIND, {
      occurrenceID: id,
      sequence: 1,
      name: "created",
      payload: {},
      timeCreated: Date.now(),
    })
  }

  export async function markPopulated(id: string): Promise<void> {
    const occurrence = await store().read(KIND, id)
    if (occurrence.phases.some((phase) => phase.sequence === 2)) return
    await store().appendPhase(KIND, {
      occurrenceID: id,
      sequence: 2,
      name: "populated",
      payload: {},
      timeCreated: Date.now(),
    })
  }

  /** The READY receipt: reuse requires exactly this. */
  export async function commitReady(id: string): Promise<void> {
    await store().settle(KIND, { occurrenceID: id, outcome: "committed", payload: {}, timeCreated: Date.now() })
  }

  export async function rollback(id: string, reason: string): Promise<void> {
    try {
      const occurrence = await store().read(KIND, id)
      if (occurrence.terminal) return
    } catch {
      return
    }
    await store().settle(KIND, {
      occurrenceID: id,
      outcome: "rolled_back",
      payload: { reason },
      timeCreated: Date.now(),
    })
  }

  /** A removed worktree has no readiness: settle anything open and forget. */
  export async function forget(directory: string): Promise<void> {
    const existing = await read(directory)
    if (!existing) return
    const id = existing.intent.occurrenceID
    if (!existing.terminal) {
      await store().settle(KIND, {
        occurrenceID: id,
        outcome: "rolled_back",
        payload: { reason: "worktree removed" },
        timeCreated: Date.now(),
      })
    }
    await store().removeSettled(KIND, id)
  }
}
