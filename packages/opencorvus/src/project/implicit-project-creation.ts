import path from "node:path"
import type { Dirent } from "node:fs"
import * as fs from "node:fs/promises"
import { DurablePublicationStore, type DurablePublicationOccurrence } from "@opencorvus-ai/util/durable-publication"
import {
  currentRuntimeProcessOccurrence,
  cachedRuntimeProcessOccurrenceObserver,
  type RuntimeProcessOccurrenceInfo,
  type RuntimeProcessOccurrenceObserver,
} from "@/runtime/process-occurrence"
import { Global } from "@/global"
import { ProjectDirectoryAdmission } from "./directory-admission"
import type { Database } from "@/storage/db"

/**
 * The durable creation occurrence of one anonymous Project directory.
 *
 * `ImplicitProject.create` publishes a directory to the filesystem before the
 * Project row that owns it exists: `mkdir` runs, then `git init`, then the row
 * is committed. A process killed anywhere in that window leaves a directory
 * under the anonymous root that no durable fact refers to, and the `catch`
 * that removes it dies with the process. Physical existence was the only
 * record that a creation had started.
 *
 * This journal records the intended directory before it exists, advances
 * through `directory_created` and `git_initialized`, and settles `committed`
 * only once the Project row is durable. `converge` reclaims what a dead
 * process left behind.
 */
export namespace ImplicitProjectCreation {
  const KIND = "implicit-project-creation"

  function store(): DurablePublicationStore {
    return new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
  }

  type Payload = {
    directory: string
    owner: RuntimeProcessOccurrenceInfo
  }

  function payloadOf(occurrence: DurablePublicationOccurrence): Payload | undefined {
    const payload = occurrence.intent.payload as Partial<Payload> | undefined
    const directory = payload?.directory
    const owner = payload?.owner
    if (typeof directory !== "string" || !directory) return undefined
    if (!owner || typeof owner.pid !== "number" || typeof owner.processInstanceID !== "string") return undefined
    if (typeof owner.occurrenceID !== "string") return undefined
    return { directory, owner }
  }

  function ownerPayload(directory: string, owner: RuntimeProcessOccurrenceInfo) {
    return {
      directory,
      owner: {
        pid: owner.pid,
        processInstanceID: owner.processInstanceID,
        occurrenceID: owner.occurrenceID,
      },
    }
  }

  /** Record the intent before the directory exists. */
  export async function begin(directory: string): Promise<string> {
    const occurrence = await store().create({
      occurrenceID: path.basename(directory),
      kind: KIND,
      subject: `implicit-project:${directory}`,
      payload: ownerPayload(directory, currentRuntimeProcessOccurrence()),
      timeCreated: Date.now(),
    })
    return occurrence.intent.occurrenceID
  }

  async function appendPhase(id: string, sequence: number, name: string): Promise<void> {
    const occurrence = await store().read(KIND, id)
    if (occurrence.phases.some((phase) => phase.sequence === sequence)) return
    await store().appendPhase(KIND, { occurrenceID: id, sequence, name, payload: {}, timeCreated: Date.now() })
  }

  export async function markDirectoryCreated(id: string): Promise<void> {
    await appendPhase(id, 1, "directory_created")
  }

  export async function markGitInitialized(id: string): Promise<void> {
    await appendPhase(id, 2, "git_initialized")
  }

  /**
   * Settle an occurrence and forget it.
   *
   * Two backends sweeping the same dead owner reach this concurrently: the
   * loser's occurrence is already settled and its directory already removed by
   * the time it writes. Settling something that is already gone is the
   * expected outcome of that race, not a failure — so a missing occurrence is
   * tolerated while any other write error still propagates to the caller's
   * failure channel.
   */
  async function settleAndForget(id: string, terminal: { outcome: "committed" | "rolled_back"; payload: object }) {
    try {
      const subject = (await store().read(KIND, id)).intent.subject
      // The terminal check and the terminal write must be one step. Deciding
      // "there is no terminal yet" outside the subject lock lets both sweepers
      // decide it, and the loser's `settle` then fails the immutable-fact
      // comparison on `timeCreated` — an error that is not a missing
      // occurrence and would escape this tolerance.
      await store().withSubjectLock(KIND, subject, async () => {
        if (!(await store().read(KIND, id)).terminal) {
          await store().settle(KIND, {
            occurrenceID: id,
            outcome: terminal.outcome,
            payload: terminal.payload as Record<string, never>,
            timeCreated: Date.now(),
          })
        }
        // Removal is part of the same tolerance: the winner may remove the
        // occurrence before this runs. A crash between the terminal and the
        // removal instead leaves an occurrence `listOpen` filters out, which
        // is what `sweepSettled` exists to find.
        await store().removeSettled(KIND, id)
      })
    } catch (error) {
      if (!isMissingOccurrence(error)) throw error
    }
  }

  function isMissingOccurrence(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    return /intent is missing|ENOENT|no such file/i.test(message)
  }

  /**
   * The receipt: the Project row that owns this directory is durable.
   *
   * Unlike a worktree's readiness receipt, this one has no later reader — once
   * the row exists it IS the durable fact about the directory — so the settled
   * occurrence is removed rather than retained, and the journal holds only
   * creations that have not reached their row.
   */
  export async function commit(id: string, projectID: string): Promise<void> {
    await settleAndForget(id, { outcome: "committed", payload: { projectID } })
  }

  export async function rollback(id: string, reason: string): Promise<void> {
    await settleAndForget(id, { outcome: "rolled_back", payload: { reason } })
  }

  export type ConvergeResult = {
    reclaimed: string[]
    retained: {
      occurrenceID: string
      directory: string
      reason: "owner_live" | "owner_unknown" | "not_owned" | "project_exists" | "project_overlap" | "unreadable"
    }[]
    /** One entry per occurrence this sweep could not settle, and why. */
    failures: string[]
  }

  export type PreparedProjectOwnership = {
    findOwner: (
      transaction: Database.TxOrDb,
    ) => { projectID: string; relation: "worktree_exact" | "overlap" } | undefined
    revalidatePhysical: () => Promise<void>
  }

  /**
   * Read every occurrence of this kind, one failure boundary per entry.
   *
   * `DurablePublicationStore.list` reads the whole kind directory and throws on
   * the first entry it cannot parse. A backend killed inside `removeSettled`'s
   * recursive delete can leave a directory whose `intent.json` is already
   * unlinked but whose `phases/` is not, and that entry makes the shared
   * listing throw — which, on the startup sweep, is a listener that never
   * binds and a backend that cannot be booted again without hand-deleting the
   * journal. Enumerating here keeps one bad entry from hiding every other one.
   *
   * An occurrence directory with no readable intent is provably an interrupted
   * removal, never an interrupted creation: `create` publishes by renaming a
   * staging directory that already contains `intent.json` into place, so the
   * intent is present from the occurrence's first instant. Finishing that
   * removal is therefore safe, and it is the only thing that stops the residue
   * from being re-reported on every later sweep.
   */
  async function listOccurrences(failures: string[]): Promise<DurablePublicationOccurrence[]> {
    const kindDirectory = path.join(store().root, KIND)
    let entries: Dirent[]
    try {
      entries = await fs.readdir(kindDirectory, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      failures.push(`${KIND}: ${error instanceof Error ? error.message : String(error)}`)
      return []
    }
    const occurrences: DurablePublicationOccurrence[] = []
    for (const dirent of entries) {
      // An occurrence is a directory. The shared listing skips everything else,
      // and so must this one: a stray `.DS_Store` would otherwise fail the
      // store's identity-segment check and become a permanent failure entry
      // re-logged on every boot with nothing able to clear it.
      if (!dirent.isDirectory()) continue
      const entry = dirent.name
      try {
        occurrences.push(await store().read(KIND, entry))
      } catch (error) {
        if (isMissingOccurrence(error)) {
          await fs
            .rm(path.join(kindDirectory, entry), { recursive: true, force: true })
            .catch((removeError: unknown) =>
              failures.push(`${entry}: ${removeError instanceof Error ? removeError.message : String(removeError)}`),
            )
          continue
        }
        failures.push(`${entry}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return occurrences
  }

  /**
   * Remove occurrences that reached a terminal but were never forgotten.
   *
   * A process killed between the terminal write and its removal leaves an
   * occurrence `listOpen` filters out — so `converge` would never revisit it —
   * while every later sweep still reads and parses it. Nothing else would ever
   * reclaim it.
   */
  async function sweepSettled(occurrences: DurablePublicationOccurrence[], failures: string[]): Promise<void> {
    for (const occurrence of occurrences) {
      if (!occurrence.terminal) continue
      try {
        await store().removeSettled(KIND, occurrence.intent.occurrenceID)
      } catch (error) {
        if (isMissingOccurrence(error)) continue
        failures.push(`${occurrence.intent.occurrenceID}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /**
   * Settle every creation occurrence whose owner process is provably gone.
   *
   * Reclamation is deliberately narrow. A live owner, an owner whose liveness
   * cannot be decided, a path this journal cannot prove it owns, or a
   * directory that already has its Project row are all retained untouched —
   * an ambiguous observation must never delete another backend's in-flight
   * creation.
   *
   * One occurrence can never starve the rest: each is settled inside its own
   * failure boundary and reported, exactly as `recoverPromotions` does, so an
   * undeletable directory cannot stop the sweep from reaching the others.
   */
  export async function converge(input: {
    isAnonymousDirectory: (directory: string) => boolean
    prepareProjectFor: (directory: string) => Promise<PreparedProjectOwnership>
    observe?: RuntimeProcessOccurrenceObserver
  }): Promise<ConvergeResult> {
    const observe = cachedRuntimeProcessOccurrenceObserver(input.observe)
    const result: ConvergeResult = { reclaimed: [], retained: [], failures: [] }
    const occurrences = await listOccurrences(result.failures)
    for (const occurrence of occurrences) {
      if (occurrence.terminal) continue
      try {
        await convergeOne(occurrence, observe, input, result)
      } catch (error) {
        result.failures.push(
          `${occurrence.intent.occurrenceID}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    await sweepSettled(occurrences, result.failures)
    return result
  }

  async function convergeOne(
    occurrence: DurablePublicationOccurrence,
    observe: RuntimeProcessOccurrenceObserver,
    input: {
      isAnonymousDirectory: (directory: string) => boolean
      prepareProjectFor: (directory: string) => Promise<PreparedProjectOwnership>
    },
    result: ConvergeResult,
  ): Promise<void> {
    const occurrenceID = occurrence.intent.occurrenceID
    const payload = payloadOf(occurrence)
    if (!payload) {
      // An intent this journal cannot interpret is a refusal, not a failure.
      // It cannot drive any decision, so it is reported and left exactly as it
      // is: settling it would forget a record that may belong to a writer this
      // build does not understand, and reporting it as a failure would be a
      // boot-time error with no remediation any code path could reach.
      result.retained.push({ occurrenceID, directory: "", reason: "unreadable" })
      return
    }
    const { directory, owner } = payload
    const observation = observe(owner)
    if (observation === "exact_live") {
      result.retained.push({ occurrenceID, directory, reason: "owner_live" })
      return
    }
    if (observation === "unknown_live") {
      result.retained.push({ occurrenceID, directory, reason: "owner_unknown" })
      return
    }
    // The occurrence ID is the directory's own name, so a payload naming a
    // path this journal did not derive cannot be reclaimed through it.
    if (!input.isAnonymousDirectory(directory) || path.basename(directory) !== occurrenceID) {
      result.retained.push({ occurrenceID, directory, reason: "not_owned" })
      return
    }
    await ProjectDirectoryAdmission.run(async () => {
      const ownership = await input.prepareProjectFor(directory)
      // Re-read the durable registry only after owning the same admission lock
      // as Project.fromDirectory. Registration either commits first and this
      // keeps the directory, or reclamation removes first and a waiting
      // registration re-validates the directory before it can commit.
      const decision = await ProjectDirectoryAdmission.acquire({
        directory,
        operationID: occurrenceID,
        kind: "reclamation",
        findOwner: ownership.findOwner,
      })
      if (decision.outcome === "owned") {
        await ownership.revalidatePhysical()
        if (decision.owner.relation === "worktree_exact") {
          // The creation actually completed; only its receipt is missing.
          await commit(occurrenceID, decision.owner.projectID)
          result.retained.push({ occurrenceID, directory, reason: "project_exists" })
        } else {
          // An ancestor/descendant registration is sufficient to forbid a
          // recursive delete, but it is not evidence that this creation
          // committed its own canonical Project row. Keep the occurrence open.
          result.retained.push({ occurrenceID, directory, reason: "project_overlap" })
        }
        return
      }
      // Rollback is a receipt for a completed physical removal. If removal
      // cannot be decided or completed, the occurrence stays open so another
      // backend can recover it later.
      try {
        await ownership.revalidatePhysical()
      } catch (cause) {
        try {
          ProjectDirectoryAdmission.settle(decision.token, () => undefined)
        } catch (cleanupError) {
          throw new AggregateError([cause, cleanupError], "Project reclamation admission cleanup failed", {
            cause,
          })
        }
        throw cause
      }
      ProjectDirectoryAdmission.assertOwnedNow(decision.token)
      await fs.rm(directory, { recursive: true, force: true })
      ProjectDirectoryAdmission.assertOwnedNow(decision.token)
      ProjectDirectoryAdmission.settle(decision.token, () => undefined)
      await rollback(occurrenceID, "owner process is gone and no Project row was committed")
      result.reclaimed.push(directory)
    })
  }
}
