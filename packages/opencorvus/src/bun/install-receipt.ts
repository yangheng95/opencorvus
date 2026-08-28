import path from "node:path"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import z from "zod"
import { DurablePublicationStore } from "@opencorvus-ai/util/durable-publication"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { cachedRuntimeProcessOccurrenceObserver, currentRuntimeProcessOccurrence } from "../runtime/process-occurrence"

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
      preparationRoot: z.string().min(1).optional(),
      owner: z
        .object({
          pid: z.number().int().positive(),
          processInstanceID: z.string().min(1),
          occurrenceID: z.string().min(1),
        })
        .strict()
        .optional(),
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
  export async function begin(input: {
    root: string
    package: string
    requestedVersion: string
    preparationRoot?: string
  }): Promise<string> {
    const preparationRoot = input.preparationRoot
      ? preparationBinding(input.root, input.preparationRoot).preparationRoot
      : undefined
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
          ...(preparationRoot
            ? {
                preparationRoot,
                owner: currentRuntimeProcessOccurrence(),
              }
            : {}),
        }),
        timeCreated: Date.now(),
      })
    })
    return id
  }

  function isInside(root: string, candidate: string): boolean {
    const relative = path.relative(path.resolve(root), path.resolve(candidate))
    return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)
  }

  const GENERATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  function samePath(left: string, right: string): boolean {
    const a = path.resolve(left)
    const b = path.resolve(right)
    return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b
  }

  function preparationBinding(cacheRoot: string, preparationRoot: string) {
    const finalRoot = path.resolve(cacheRoot)
    const preparation = path.resolve(preparationRoot)
    const generationID = path.basename(preparation)
    const packageRoot = path.dirname(path.dirname(path.dirname(finalRoot)))
    const stagingRoot = path.join(packageRoot, "staging")
    const valid =
      GENERATION_ID.test(generationID) &&
      path.basename(finalRoot).toLowerCase() === generationID.toLowerCase() &&
      samePath(path.dirname(preparation), stagingRoot)
    if (!valid) {
      throw new Error(
        "Package installation preparation must be the direct staging child bound to the final generation identity",
      )
    }
    return { packageRoot, preparationRoot: preparation }
  }

  /**
   * Reclaim preparation trees only when their durable owner is terminal or
   * its exact OS process occurrence is proven dead. A compromised lock can
   * admit a second live installer, so lock ownership alone is never evidence
   * that another generation is abandoned.
   */
  export async function recoverAbandonedPreparations(input: { packageRoot: string; package: string }): Promise<void> {
    const stagingRoot = path.join(input.packageRoot, "staging")
    const preparations = new Map<string, Awaited<ReturnType<DurablePublicationStore["list"]>>>()
    for (const occurrence of await store().list(KIND)) {
      const intent = IntentPayload.safeParse(occurrence.intent.payload)
      if (!intent.success || intent.data.package !== input.package || !intent.data.preparationRoot) continue
      const binding = preparationBinding(intent.data.cacheRoot, intent.data.preparationRoot)
      if (!samePath(binding.packageRoot, input.packageRoot) || !isInside(stagingRoot, binding.preparationRoot)) {
        throw new Error(
          `Package installation preparation path is outside its package staging root: ${intent.data.preparationRoot}`,
        )
      }
      const groupKey = process.platform === "win32" ? binding.preparationRoot.toLowerCase() : binding.preparationRoot
      const matches = preparations.get(groupKey) ?? []
      matches.push(occurrence)
      preparations.set(groupKey, matches)
    }
    const observe = cachedRuntimeProcessOccurrenceObserver()
    for (const [preparationRoot, occurrences] of preparations) {
      const live = occurrences.some((occurrence) => {
        if (occurrence.terminal) return false
        const intent = IntentPayload.parse(occurrence.intent.payload)
        return !intent.owner || observe(intent.owner) !== "dead_or_reused"
      })
      if (live) continue
      for (const occurrence of occurrences) {
        if (!occurrence.terminal) {
          await rollback(occurrence.intent.occurrenceID, "preparation owner process is no longer live")
        }
      }
      await fs.rm(preparationRoot, { recursive: true, force: true })
    }
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
  function dependencyPath(dependency: string): string[] {
    const parts = dependency.split("/")
    const valid =
      (parts.length === 1 && !dependency.startsWith("@")) ||
      (parts.length === 2 && parts[0]?.startsWith("@") && parts[0].length > 1)
    if (!valid || parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) {
      throw new Error(`Installed dependency has an invalid package identity: ${dependency}`)
    }
    return parts
  }

  function expectedManifestIdentity(dependency: string, spec: string | undefined): string {
    if (!spec?.startsWith("npm:")) return dependency
    const match = /^npm:((?:@[^/@]+\/)?[^/@]+)(?:@.+)?$/.exec(spec)
    if (!match?.[1]) throw new Error(`Installed dependency ${dependency} has an invalid npm alias specifier`)
    return match[1]
  }

  async function resolveReadableManifest(
    root: string,
    moduleDirectory: string,
    dependency: string,
    spec: string | undefined,
  ): Promise<
    | { directory: string; manifest: { name: string; version: string; dependencies?: Record<string, string> } }
    | undefined
  > {
    const cacheRoot = path.resolve(root)
    let directory = path.resolve(moduleDirectory)
    const expectedName = expectedManifestIdentity(dependency, spec)
    const segments = dependencyPath(dependency)
    for (;;) {
      const candidateDirectory = path.join(directory, "node_modules", ...segments)
      const candidateStat = await fs.stat(candidateDirectory).then(
        (stat) => stat,
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return undefined
          throw error
        },
      )
      if (candidateStat && !candidateStat.isDirectory()) {
        throw new Error(`Installed dependency ${dependency} resolves first to a non-directory package entry`)
      }
      if (candidateStat) {
        const candidate = path.join(candidateDirectory, "package.json")
        const manifest = z
          .object({
            name: z.literal(expectedName),
            version: z.string().min(1),
            dependencies: z.record(z.string(), z.string()).optional(),
          })
          .passthrough()
          .safeParse(await Filesystem.readJson<unknown>(candidate).catch(() => undefined))
        if (!manifest.success) {
          throw new Error(
            `Installed dependency ${dependency} resolves first to a package with an unreadable or mismatched manifest`,
          )
        }
        return { directory: candidateDirectory, manifest: manifest.data }
      }
      if (directory === cacheRoot) return undefined
      const parent = path.dirname(directory)
      if (parent === directory) return undefined
      // Never walk above the cache this installation owns.
      if (!path.resolve(parent).startsWith(cacheRoot) && path.resolve(parent) !== cacheRoot) return undefined
      directory = parent
    }
  }

  export async function verifyTree(input: {
    root: string
    package: string
    resolvedVersion: string
    moduleDirectory: string
    additionalDependencies?: readonly string[]
  }): Promise<readonly string[]> {
    const manifest = z
      .object({
        name: z.literal(input.package),
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
    const pending = [
      ...Object.entries(manifest.dependencies ?? {}).map(([dependency, spec]) => ({
        dependency,
        spec,
        from: input.moduleDirectory,
      })),
      ...(input.additionalDependencies ?? []).map((dependency) => ({
        dependency,
        spec: undefined,
        from: input.moduleDirectory,
      })),
    ]
    const dependencies: string[] = []
    const visited = new Set<string>()
    const missing: string[] = []
    while (pending.length > 0) {
      const next = pending.shift()!
      const resolved = await resolveReadableManifest(input.root, next.from, next.dependency, next.spec)
      if (!resolved) {
        missing.push(next.dependency)
        continue
      }
      const identity = path.resolve(resolved.directory)
      if (visited.has(identity)) continue
      visited.add(identity)
      dependencies.push(next.dependency)
      pending.push(
        ...Object.entries(resolved.manifest.dependencies ?? {}).map(([dependency, spec]) => ({
          dependency,
          spec,
          from: resolved.directory,
        })),
      )
    }
    if (missing.length > 0) {
      throw new Error(
        `Installed ${input.package}@${input.resolvedVersion} is incomplete: unresolved ${missing.join(", ")}`,
      )
    }
    return dependencies.sort()
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
    const dependencies = await verifyTree(input)
    await store().appendPhase(KIND, {
      occurrenceID: input.occurrenceID,
      sequence: 1,
      name: "verified",
      payload: VerifiedPayload.parse({ resolvedVersion: input.resolvedVersion, dependencies }),
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
      let resolvedID: string | undefined
      try {
        resolvedID = await begin({
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
      } catch (error) {
        if (resolvedID) await rollback(resolvedID, error instanceof Error ? error.message : String(error))
        throw error
      }
    }
    await store().settle(KIND, {
      occurrenceID: input.occurrenceID,
      outcome: "committed",
      payload: { resolvedVersion: input.resolvedVersion },
      timeCreated: Date.now(),
    })
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
