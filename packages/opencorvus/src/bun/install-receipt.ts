import path from "node:path"
import { createHash } from "node:crypto"
import z from "zod"
import { DurablePublicationStore } from "@opencorvus-ai/util/durable-publication"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"

/**
 * The completeness receipt of one installed package revision in the shared
 * cache.
 *
 * A killed `bun add` leaves a `node_modules` tree and a readable package
 * manifest behind. Every consumer that treated those as proof of installation
 * then failed persistently against an incomplete tree instead of completing
 * it. Installation readiness is therefore a durable receipt for one exact
 * `package@version`, written only after the resolved tree has been verified —
 * physical existence never means Ready.
 */
export namespace PackageInstallReceipt {
  const KIND = "package-install"

  const IntentPayload = z
    .object({
      package: z.string().min(1),
      requestedVersion: z.string().min(1),
      /** The tree this revision is installed into. The shared registry cache
       *  and each per-config dependency directory are different trees, and a
       *  receipt is only ever about the one it names. */
      cacheRoot: z.string().min(1),
    })
    .strict()

  const VerifiedPayload = z
    .object({
      resolvedVersion: z.string().min(1),
      dependencies: z.array(z.string()),
    })
    .strict()

  function store(): DurablePublicationStore {
    return new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
  }

  /** One occurrence per tree and exact package revision. */
  function occurrenceID(root: string, pkg: string, version: string): string {
    return createHash("sha256")
      .update(`${path.resolve(root)}\0${pkg}\0${version}`)
      .digest("hex")
      .slice(0, 40)
  }

  export async function isPublished(input: { root: string; package: string; version: string }): Promise<boolean> {
    return (
      (await readOccurrence(occurrenceID(input.root, input.package, input.version)))?.terminal?.outcome === "committed"
    )
  }

  /**
   * Open the occurrence for an install attempt. A previous unsettled attempt
   * for the same revision is rolled back and replaced: its tree is exactly
   * what this attempt is about to complete.
   */
  export async function begin(input: { root: string; package: string; requestedVersion: string }): Promise<string> {
    const id = occurrenceID(input.root, input.package, input.requestedVersion)
    const subject = `package:${path.resolve(input.root)}:${input.package}`
    // Reading the prior occurrence, superseding it, removing it and opening
    // the new one is ONE mutation of this subject. Split across the lock, a
    // second backend could replace the occurrence a first was installing
    // under, and the first would then commit its receipt into the second's
    // occurrence while that install was still rewriting the tree.
    await store().withSubjectLock(KIND, subject, async () => {
      const existing = await readOccurrence(id)
      if (existing) {
        if (!existing.terminal) {
          await store().settle(KIND, {
            occurrenceID: id,
            outcome: "rolled_back",
            payload: { reason: "superseded by a new install attempt of the same revision" },
            timeCreated: Date.now(),
          })
        }
        await store().removeSettled(KIND, id)
      }
      await store().create({
        occurrenceID: id,
        kind: KIND,
        subject,
        payload: IntentPayload.parse({
          package: input.package,
          requestedVersion: input.requestedVersion,
          cacheRoot: path.resolve(input.root),
        }),
        timeCreated: Date.now(),
      })
    })
    return id
  }

  /** The occurrence for this revision, or undefined when there is none. Any
   *  other failure is a real failure and surfaces. */
  async function readOccurrence(id: string) {
    try {
      return await store().read(KIND, id)
    } catch (error) {
      if (error instanceof Error && error.message.includes("intent is missing")) return undefined
      throw error
    }
  }

  /**
   * Whether one declared dependency resolves to a manifest this runtime can
   * actually read.
   *
   * Resolution follows Node's own order — the dependent package's private
   * `node_modules` first, then each ancestor up to the cache root — because a
   * version conflict with something already in the shared cache is resolved by
   * nesting, and reading only the hoisted flat path reported a correct install
   * as incomplete forever. The manifest is PARSED, not merely stat-ed: a
   * zero-byte or truncated `package.json` is exactly what a killed install
   * leaves behind, so treating its path's existence as proof would reproduce
   * the defect this receipt exists to remove.
   */
  async function resolvesToAReadableManifest(
    root: string,
    moduleDirectory: string,
    dependency: string,
  ): Promise<boolean> {
    const cacheRoot = path.resolve(root)
    let directory = path.resolve(moduleDirectory)
    for (;;) {
      const candidate = path.join(directory, "node_modules", dependency, "package.json")
      const manifest = await Filesystem.readJson<unknown>(candidate).catch(() => undefined)
      if (manifest && typeof manifest === "object" && typeof (manifest as { name?: unknown }).name === "string") {
        return true
      }
      if (directory === cacheRoot) return false
      const parent = path.dirname(directory)
      if (parent === directory) return false
      // Never walk above the cache this installation owns.
      if (!path.resolve(parent).startsWith(cacheRoot) && path.resolve(parent) !== cacheRoot) return false
      directory = parent
    }
  }

  /**
   * Verify the installed tree and publish its receipt.
   *
   * The check is what "installed" has to mean for this flat cache: the
   * package's own manifest reports the resolved version, and every dependency
   * it declares resolves to a readable manifest in the same cache. An
   * incomplete tree fails here and stays unpublished, so the next load
   * reinstalls instead of failing forever against it.
   */
  export async function verifyAndPublish(input: {
    occurrenceID: string
    root: string
    package: string
    requestedVersion: string
    resolvedVersion: string
    moduleDirectory: string
    /**
     * The dependency set this receipt certifies, when the install covers more
     * than the named package's own closure.
     *
     * A per-config `bun install` installs everything that config's manifest
     * declares, so certifying only the named package's dependencies would
     * publish a receipt for a tree whose other declared dependencies were
     * never completed — the same defect one level out.
     */
    additionalDependencies?: readonly string[]
  }): Promise<void> {
    const manifest = z
      .object({
        version: z.string().min(1),
        dependencies: z.record(z.string(), z.string()).optional(),
      })
      .passthrough()
      .parse(await Filesystem.readJson(path.join(input.moduleDirectory, "package.json")))
    // Both callers read this same manifest to derive `resolvedVersion`, so
    // this compares one read against another: it catches a tree rewritten
    // between them, not a wrong version. Keeping it is cheap; calling it a
    // version guarantee would not be true.
    if (manifest.version !== input.resolvedVersion) {
      throw new Error(
        `Installed ${input.package} reports version ${manifest.version}, expected ${input.resolvedVersion}`,
      )
    }
    const dependencies = [
      ...new Set([...Object.keys(manifest.dependencies ?? {}), ...(input.additionalDependencies ?? [])]),
    ]
    const missing: string[] = []
    for (const dependency of dependencies) {
      if (!(await resolvesToAReadableManifest(input.root, input.moduleDirectory, dependency))) missing.push(dependency)
    }
    if (missing.length > 0) {
      throw new Error(
        `Installed ${input.package}@${input.resolvedVersion} is incomplete: unresolved ${missing.join(", ")}`,
      )
    }
    await store().appendPhase(KIND, {
      occurrenceID: input.occurrenceID,
      sequence: 1,
      name: "verified",
      payload: VerifiedPayload.parse({ resolvedVersion: input.resolvedVersion, dependencies }),
      timeCreated: Date.now(),
    })
    await store().settle(KIND, {
      occurrenceID: input.occurrenceID,
      outcome: "committed",
      payload: { resolvedVersion: input.resolvedVersion },
      timeCreated: Date.now(),
    })
    // Two facts with two roles. The occurrence just settled is keyed by the
    // SELECTOR the caller asked for, because that is all that is known before
    // the install resolves — it is the in-flight intent. Readiness is asked
    // about the RESOLVED revision, because that is what a reader has in hand
    // afterwards: the shared cache records the resolved version in its own
    // manifest and asks under it even for a `latest` install. So the resolved
    // receipt is published whenever the selector was not already that version.
    if (input.requestedVersion !== input.resolvedVersion) {
      if (await isPublished({ root: input.root, package: input.package, version: input.resolvedVersion })) return
      const resolvedID = await begin({
        root: input.root,
        package: input.package,
        requestedVersion: input.resolvedVersion,
      })
      await store().appendPhase(KIND, {
        occurrenceID: resolvedID,
        sequence: 1,
        name: "verified",
        payload: VerifiedPayload.parse({ resolvedVersion: input.resolvedVersion, dependencies }),
        timeCreated: Date.now(),
      })
      await store().settle(KIND, {
        occurrenceID: resolvedID,
        outcome: "committed",
        payload: { resolvedVersion: input.resolvedVersion },
        timeCreated: Date.now(),
      })
    }
  }

  export async function rollback(occurrenceID: string, reason: string): Promise<void> {
    try {
      const occurrence = await store().read(KIND, occurrenceID)
      if (occurrence.terminal) return
    } catch {
      return
    }
    await store().settle(KIND, {
      occurrenceID,
      outcome: "rolled_back",
      payload: { reason },
      timeCreated: Date.now(),
    })
  }
}
