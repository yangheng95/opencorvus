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

  /** One occurrence per cache root and exact package revision. */
  function occurrenceID(pkg: string, version: string): string {
    return createHash("sha256").update(`${Global.Path.cache}\0${pkg}\0${version}`).digest("hex").slice(0, 40)
  }

  export async function isPublished(pkg: string, version: string): Promise<boolean> {
    try {
      const occurrence = await store().read(KIND, occurrenceID(pkg, version))
      return occurrence.terminal?.outcome === "committed"
    } catch {
      return false
    }
  }

  /**
   * Open the occurrence for an install attempt. A previous unsettled attempt
   * for the same revision is rolled back and replaced: its tree is exactly
   * what this attempt is about to complete.
   */
  export async function begin(input: { package: string; requestedVersion: string }): Promise<string> {
    const id = occurrenceID(input.package, input.requestedVersion)
    try {
      const existing = await store().read(KIND, id)
      if (!existing.terminal) {
        await store().settle(KIND, {
          occurrenceID: id,
          outcome: "rolled_back",
          payload: { reason: "superseded by a new install attempt of the same revision" },
          timeCreated: Date.now(),
        })
      }
      await store().removeSettled(KIND, id)
    } catch {
      // No prior occurrence for this revision.
    }
    await store().create({
      occurrenceID: id,
      kind: KIND,
      subject: `package:${Global.Path.cache}:${input.package}`,
      payload: IntentPayload.parse({
        package: input.package,
        requestedVersion: input.requestedVersion,
        cacheRoot: Global.Path.cache,
      }),
      timeCreated: Date.now(),
    })
    return id
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
    package: string
    requestedVersion: string
    resolvedVersion: string
    moduleDirectory: string
  }): Promise<void> {
    const manifest = z
      .object({
        version: z.string().min(1),
        dependencies: z.record(z.string(), z.string()).optional(),
      })
      .passthrough()
      .parse(await Filesystem.readJson(path.join(input.moduleDirectory, "package.json")))
    if (manifest.version !== input.resolvedVersion) {
      throw new Error(
        `Installed ${input.package} reports version ${manifest.version}, expected ${input.resolvedVersion}`,
      )
    }
    const dependencies = Object.keys(manifest.dependencies ?? {})
    const missing: string[] = []
    for (const dependency of dependencies) {
      const resolved = path.join(Global.Path.cache, "node_modules", dependency, "package.json")
      if (!(await Filesystem.exists(resolved))) missing.push(dependency)
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
    // The requested selector and the resolved revision are both entry points
    // for the next reader; publish the resolved one too when they differ.
    if (input.requestedVersion !== input.resolvedVersion) {
      if (await isPublished(input.package, input.resolvedVersion)) return
      const resolvedID = await begin({ package: input.package, requestedVersion: input.resolvedVersion })
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
