import { cp, lstat, open, readFile, readdir, rm } from "node:fs/promises"
import path from "node:path"
import { DurablePublicationStore, digestFilesystemTree } from "@opencorvus-ai/util/durable-publication"
import { Filesystem } from "@/util/filesystem"
import { NotFoundError } from "@/storage/db"
import z from "zod"

const KIND = "preservation"
type Journal = {
  operationID: string
  target: string
  backup: string
  staging: string
  discard: string
  installationScope: string
  id: string
  databaseAuthority?: string
}
const ResourceKeys = ["target", "backup", "staging", "discard"] as const
type ResourceKey = (typeof ResourceKeys)[number]
const Observation = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("absent") }).strict(),
  z.object({ kind: z.literal("present"), treeDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
])
type Observation = z.infer<typeof Observation>
const Observations = z
  .object({ target: Observation, backup: Observation, staging: Observation, discard: Observation })
  .strict()
const Disposition = z.enum(["commit_receipt_unavailable", "committed_revision_changed"])
const Context = z
  .object({
    disposition: Disposition,
    commitReceiptIdentity: z
      .object({ taskID: z.string().min(1), artifactID: z.string().min(1) })
      .strict()
      .optional(),
    targetRevision: z
      .object({
        expectedPackageDigest: z.string().regex(/^[a-f0-9]{64}$/),
        observedPackageDigest: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.disposition === "committed_revision_changed" && (!value.commitReceiptIdentity || !value.targetRevision))
      context.addIssue({
        code: "custom",
        message: "Committed revision change requires its exact receipt and revision observations",
      })
  })
type Context = z.infer<typeof Context>
const Asset = z
  .object({
    source: z.string(),
    destination: z.string(),
    observation: Observation,
    destinationObservation: Observation,
    operation: z.enum(["retain", "copy", "move"]),
    classification: z.enum(["expected", "observed_source", "observed_destination"]),
  })
  .strict()
type Asset = z.infer<typeof Asset>
const ResourcePlan = z
  .object({
    source: z.string(),
    destination: z.string(),
    expectedObservation: Observation,
    sourceObservation: Observation,
    destinationObservation: Observation,
    additionalDestinationObservation: Observation,
    expectedObservationAvailable: z.boolean(),
    assets: z.array(Asset),
  })
  .strict()
type ResourcePlan = z.infer<typeof ResourcePlan>
const Plan = z
  .object({
    protocol: z.literal("opencorvus/expert-squad-mutation-resource-plan@2"),
    originalProtocol: z.enum([
      "opencorvus/expert-squad-mutation-preservation@1",
      "opencorvus/expert-squad-mutation-preservation@2",
    ]),
    context: Context,
    resources: z
      .object({ target: ResourcePlan, backup: ResourcePlan, staging: ResourcePlan, discard: ResourcePlan })
      .strict(),
  })
  .strict()
type Plan = z.infer<typeof Plan>
const AssetObservation = z
  .object({
    resource: z.string(),
    observation: Observation,
    currentObservation: Observation,
    classification: Asset.shape.classification,
  })
  .strict()
const ResourceObservation = z
  .object({
    protocol: z.literal("opencorvus/expert-squad-mutation-resource-observation@2"),
    resourcePlanSequence: z.number().int().positive(),
    resource: z.enum(ResourceKeys),
    previousObservationSequence: z.number().int().positive().nullable(),
    plan: ResourcePlan,
    priorAssets: z.array(AssetObservation),
  })
  .strict()
type ResourceObservation = z.infer<typeof ResourceObservation> & { sequence: number }

function sameObservation(left: Observation, right: Observation) {
  return left.kind === "absent"
    ? right.kind === "absent"
    : right.kind === "present" && left.treeDigest === right.treeDigest
}

function sameFact(left: unknown, right: unknown): boolean {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return left === right
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameFact(value, right[index]))
    )
  const a = Object.entries(left),
    b = Object.entries(right)
  return (
    a.length === b.length &&
    a.every(([key, value]) => Object.hasOwn(right, key) && sameFact(value, (right as Record<string, unknown>)[key]))
  )
}

function planResource(
  key: ResourceKey,
  journal: Journal,
  resources: string,
  expectedObservation: Observation,
  sourceObservation: Observation,
  destinationObservation: Observation,
  additionalDestinationObservation: Observation,
  observationSequence?: number,
): ResourcePlan {
  const source = journal[key],
    destination = path.join(resources, key)
  const assets: Asset[] = []
  if (destinationObservation.kind === "present")
    assets.push({
      source: destination,
      destination,
      observation: destinationObservation,
      destinationObservation,
      operation: "retain",
      classification: sameObservation(expectedObservation, destinationObservation)
        ? "expected"
        : "observed_destination",
    })
  if (sourceObservation.kind === "present") {
    // An existing exact archive wins. A changed live target is a separate
    // observation, never a replacement for the original archived tree.
    const repeatedLiveTarget = key === "target" && sameObservation(sourceObservation, destinationObservation)
    if (!repeatedLiveTarget) {
      const classification = sameObservation(expectedObservation, sourceObservation) ? "expected" : "observed_source"
      const suffix = classification === "expected" ? "expected" : "observed"
      const primary = destinationObservation.kind === "absent" && classification === "expected"
      assets.push({
        source,
        destination: primary
          ? destination
          : path.join(
              resources,
              `${key}-${suffix}${observationSequence === undefined ? "" : `-${observationSequence}`}`,
            ),
        observation: sourceObservation,
        destinationObservation: primary ? destinationObservation : additionalDestinationObservation,
        operation: key === "target" ? "copy" : "move",
        classification,
      })
    }
  }
  return {
    source,
    destination,
    expectedObservation,
    sourceObservation,
    destinationObservation,
    additionalDestinationObservation,
    expectedObservationAvailable:
      expectedObservation.kind === "absent" ||
      sameObservation(expectedObservation, sourceObservation) ||
      sameObservation(expectedObservation, destinationObservation),
    assets,
  }
}

function assetReferences(plans: ResourcePlan[]) {
  const result: Array<{ resource: string; observation: Observation; classification: Asset["classification"] }> = []
  for (const plan of plans)
    for (const asset of plan.assets)
      if (
        !result.some(
          (previous) =>
            previous.resource === asset.destination && sameObservation(previous.observation, asset.observation),
        )
      )
        result.push({
          resource: asset.destination,
          observation: asset.observation,
          classification: asset.classification,
        })
  return result
}

function evidence(plan: ResourcePlan, observations: ResourceObservation[] = []) {
  const references = assetReferences([plan, ...observations.map((item) => item.plan)])
  const latest = observations.at(-1)
  const currentPlan = latest?.plan ?? plan
  const preserved = references.filter((reference) => {
    if (
      currentPlan.assets.some(
        (asset) =>
          asset.destination === reference.resource && sameObservation(asset.observation, reference.observation),
      )
    )
      return true
    const known = latest?.priorAssets.find(
      (asset) => asset.resource === reference.resource && sameObservation(asset.observation, reference.observation),
    )
    return known ? sameObservation(known.currentObservation, reference.observation) : !latest
  })
  return {
    expectedObservation: plan.expectedObservation,
    expectedObservationAvailable:
      plan.expectedObservation.kind === "absent" ||
      preserved.some((reference) => sameObservation(reference.observation, plan.expectedObservation)),
    preserved,
    missing: references.filter((reference) => !preserved.includes(reference)),
  }
}

function retainedEvidence(plan: ResourcePlan, observations: ResourceObservation[]) {
  const { expectedObservation, expectedObservationAvailable, preserved } = evidence(plan, observations)
  return { expectedObservation, expectedObservationAvailable, preserved }
}

async function preserveAsset(asset: Asset) {
  if (
    asset.destinationObservation.kind === "present" &&
    !sameObservation(asset.destinationObservation, asset.observation)
  )
    throw new Error("Mutation preservation planned destination already contains distinct evidence")
  const destination = await observe(asset.destination)
  const source = asset.source === asset.destination ? destination : await observe(asset.source)
  if (destination.kind === "present") {
    if (!sameObservation(destination, asset.observation))
      throw new Error("Mutation preservation planned destination changed")
    if (asset.operation === "copy" && !sameObservation(source, asset.observation))
      throw new Error("Mutation preservation planned copy source changed")
    if (asset.operation === "move" && source.kind !== "absent" && !sameObservation(source, asset.observation))
      throw new Error("Mutation preservation planned moved source changed")
    return
  }
  if (asset.operation === "retain" || !sameObservation(source, asset.observation))
    throw new Error("Mutation preservation planned source is unavailable or changed")
  if (asset.operation === "copy") {
    const temporary = path.join(path.dirname(asset.destination), `.${path.basename(asset.destination)}-copy.tmp`)
    if (await exists(temporary)) await rm(temporary, { recursive: true, force: false })
    await cp(asset.source, temporary, { recursive: true, force: false, errorOnExist: true, verbatimSymlinks: true })
    if (
      !sameObservation(await observe(temporary), asset.observation) ||
      !sameObservation(await observe(asset.source), asset.observation)
    )
      throw new Error("Installed mutation target changed while preserving its planned bytes")
    await syncCopiedTree(temporary)
    await Filesystem.renameDurableNoReplace(temporary, asset.destination)
  } else await Filesystem.renameDurableNoReplace(asset.source, asset.destination)
  if (!sameObservation(await observe(asset.destination), asset.observation))
    throw new Error("Preserved mutation planned bytes changed")
}

async function plannedResourceMatches(item: ResourcePlan, priorAssets: ResourceObservation["priorAssets"] = []) {
  const source = await observe(item.source)
  if (!sameObservation(source, item.sourceObservation)) {
    const moved = item.assets.find((asset) => asset.source === item.source && asset.operation === "move")
    if (source.kind !== "absent" || !moved || !sameObservation(await observe(moved.destination), moved.observation))
      return false
  }
  const destination = await observe(item.destination)
  const published = item.assets.find((asset) => asset.destination === item.destination)
  if (
    !sameObservation(destination, item.destinationObservation) &&
    (!published || !sameObservation(destination, published.observation))
  )
    return false
  for (const asset of item.assets) {
    const current = await observe(asset.destination)
    if (!sameObservation(current, asset.destinationObservation) && !sameObservation(current, asset.observation))
      return false
  }
  for (const prior of priorAssets) {
    const current = await observe(prior.resource)
    if (sameObservation(current, prior.currentObservation)) continue
    if (
      !item.assets.some((asset) => asset.destination === prior.resource && sameObservation(current, asset.observation))
    )
      return false
  }
  return true
}

async function observeResourcePlan(
  key: ResourceKey,
  journal: Journal,
  resources: string,
  expected: Observation,
  observationSequence?: number,
) {
  const source = await observe(journal[key]),
    destination = await observe(path.join(resources, key))
  const suffix = sameObservation(expected, source) ? "expected" : "observed"
  const separate =
    source.kind === "present" &&
    !(key === "target" && sameObservation(source, destination)) &&
    (destination.kind === "present" || !sameObservation(source, expected))
  const additional = separate
    ? await observe(
        path.join(resources, `${key}-${suffix}${observationSequence === undefined ? "" : `-${observationSequence}`}`),
      )
    : { kind: "absent" as const }
  return planResource(key, journal, resources, expected, source, destination, additional, observationSequence)
}

function storeRoot(configRoot: string) {
  return path.join(configRoot, "durable-publications", "expert-squad-mutations")
}

function store(configRoot: string, id: string) {
  // Resource renames stay on the installation's volume, outside disposable staging.
  return new DurablePublicationStore(path.join(storeRoot(configRoot), id))
}

/** Exact occurrence lookup; corrupt facts remain integrity errors. */
export async function readExpertSquadMutationPreservation(input: {
  configRoot: string
  id: string
  operationID: string
}) {
  const publication = store(input.configRoot, input.id)
  if (!(await exists(path.join(publication.occurrenceDirectory(KIND, input.operationID), "intent.json"))))
    return undefined
  return publication.read(KIND, input.operationID)
}

/** Pending recovery entry points belong to this exact package's original store. */
export function listPendingExpertSquadMutationPreservations(input: { configRoot: string; id: string }) {
  return store(input.configRoot, input.id).listOpen(KIND)
}

export async function listPendingExpertSquadMutationPreservationSubjects(input: {
  configRoot: string
  onError?: (id: string, error: unknown) => void
}): Promise<string[]> {
  const entries = await readdir(storeRoot(input.configRoot), { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return []
      throw error
    },
  )
  const subjects: string[] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      if (!entry.isDirectory() || entry.isSymbolicLink())
        throw new Error("Mutation preservation package partition is not a directory")
      const pending = await listPendingExpertSquadMutationPreservations({
        configRoot: input.configRoot,
        id: entry.name,
      })
      if (pending.some((item) => item.intent.subject !== entry.name))
        throw new Error("Mutation preservation package partition differs from its subjects")
      if (pending.length) subjects.push(entry.name)
    } catch (error) {
      if (!input.onError) throw error
      input.onError(entry.name, error)
    }
  }
  return subjects
}

async function exists(file: string) {
  return lstat(file).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false
      throw error
    },
  )
}

async function observe(file: string): Promise<Observation> {
  return (await exists(file)) ? { kind: "present", treeDigest: await digestFilesystemTree(file) } : { kind: "absent" }
}

async function syncCopiedTree(root: string): Promise<void> {
  const state = await lstat(root)
  if (state.isDirectory()) {
    for (const entry of await readdir(root)) await syncCopiedTree(path.join(root, entry))
    await Filesystem.syncDirectoryMetadata(root)
  } else if (state.isFile()) {
    const handle = await open(root, "r+")
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  }
}

async function retainJournalBytes(file: string, bytes: string) {
  await Filesystem.writeDurableAtomicIfAbsent(file, bytes, 0o600)
  if ((await readFile(file, "utf8")) !== bytes) throw new Error("Preserved mutation journal bytes conflict")
}

export async function preserveExpertSquadMutationEvidence(input: {
  configRoot: string
  id: string
  journalPath: string
  journalText: string
  journal: Journal
  databaseAuthority: string
  disposition?: Context["disposition"]
  commitReceiptIdentity?: Context["commitReceiptIdentity"]
  targetRevision?: Context["targetRevision"]
  retireCurrentJournal?: boolean
}) {
  const publication = store(input.configRoot, input.id)
  const journal = input.journal
  const directory = publication.occurrenceDirectory(KIND, journal.operationID)
  return publication.withSubjectLock(KIND, input.id, async () => {
    const intentExists = await exists(path.join(directory, "intent.json"))
    let occurrence = intentExists ? await publication.read(KIND, journal.operationID) : undefined
    if (!occurrence) {
      const context = Context.parse({
        disposition: input.disposition ?? "commit_receipt_unavailable",
        ...(input.commitReceiptIdentity ? { commitReceiptIdentity: input.commitReceiptIdentity } : {}),
        ...(input.targetRevision ? { targetRevision: input.targetRevision } : {}),
      })
      const observations = Object.fromEntries(
        await Promise.all(ResourceKeys.map(async (key) => [key, await observe(journal[key])])),
      )
      occurrence = await publication.create({
        occurrenceID: journal.operationID,
        kind: KIND,
        subject: input.id,
        timeCreated: Date.now(),
        payload: {
          protocol: "opencorvus/expert-squad-mutation-preservation@2",
          ...context,
          journal: JSON.parse(input.journalText),
          journalText: input.journalText,
          journalPath: input.journalPath,
          databaseAuthority: input.databaseAuthority,
          reason:
            context.disposition === "committed_revision_changed"
              ? "committed_revision_changed"
              : journal.databaseAuthority === undefined
                ? "legacy_journal"
                : journal.databaseAuthority !== input.databaseAuthority
                  ? "database_authority_mismatch"
                  : "receipt_absent",
          observations,
        },
      })
    }
    if (
      occurrence.intent.subject !== input.id ||
      occurrence.intent.payload.journalText !== input.journalText ||
      occurrence.intent.payload.journalPath !== input.journalPath ||
      !sameFact(occurrence.intent.payload.journal, JSON.parse(input.journalText))
    )
      throw new Error("Mutation preservation occurrence has another original journal")
    const resources = path.join(directory, "resources")
    const observations = Observations.parse(occurrence.intent.payload.observations)
    const protocol = z
      .enum(["opencorvus/expert-squad-mutation-preservation@1", "opencorvus/expert-squad-mutation-preservation@2"])
      .parse(occurrence.intent.payload.protocol)
    const historicalComplete =
      protocol.endsWith("@1") &&
      !!occurrence.terminal &&
      !occurrence.phases.some((phase) => phase.name === "upgrade-v2" || phase.name === "resource-plan-v2")
    let disposition = Disposition.parse(occurrence.intent.payload.disposition)
    if (historicalComplete) {
      if (
        occurrence.terminal!.outcome !== "committed" ||
        !sameFact(occurrence.terminal!.payload, {
          disposition,
          resources,
          target: journal.target,
          observation: observations.target,
        })
      )
        throw new Error("Historical mutation preservation terminal differs")
      if ((await readFile(path.join(resources, "original-journal.json"), "utf8")) !== input.journalText)
        throw new Error("Historical mutation preservation original journal differs")
    } else {
      await Filesystem.mkdirDurable(resources)
      await retainJournalBytes(path.join(resources, "original-journal.json"), input.journalText)
    }
    if (!historicalComplete) {
      const append = async (name: string, payload: unknown) => {
        occurrence = await publication.appendPhase(KIND, {
          occurrenceID: journal.operationID,
          sequence: (occurrence!.phases.at(-1)?.sequence ?? 0) + 1,
          name,
          timeCreated: Date.now(),
          payload: z.record(z.string(), z.json()).parse(payload),
        })
      }
      let context: Context
      if (protocol.endsWith("@1")) {
        const upgrades = occurrence.phases.filter((phase) => phase.name === "upgrade-v2")
        if (upgrades.length > 1) throw new Error("Mutation preservation has multiple upgrades")
        if (upgrades.length === 0) {
          const upgradeContext = Context.parse({
            disposition: input.disposition ?? disposition,
            ...(input.commitReceiptIdentity ? { commitReceiptIdentity: input.commitReceiptIdentity } : {}),
            ...(input.targetRevision ? { targetRevision: input.targetRevision } : {}),
          })
          await append("upgrade-v2", {
            protocol: "opencorvus/expert-squad-mutation-preservation-upgrade@2",
            originalProtocol: protocol,
            context: upgradeContext,
          })
        }
        const upgrade = occurrence.phases.find((phase) => phase.name === "upgrade-v2")!
        if (
          upgrade.payload.protocol !== "opencorvus/expert-squad-mutation-preservation-upgrade@2" ||
          upgrade.payload.originalProtocol !== protocol
        )
          throw new Error("Mutation preservation upgrade identity differs")
        context = Context.parse(upgrade.payload.context)
      } else
        context = Context.parse({
          disposition,
          ...(occurrence.intent.payload.commitReceiptIdentity
            ? { commitReceiptIdentity: occurrence.intent.payload.commitReceiptIdentity }
            : {}),
          ...(occurrence.intent.payload.targetRevision
            ? { targetRevision: occurrence.intent.payload.targetRevision }
            : {}),
        })
      disposition = context.disposition
      const plans = occurrence.phases.filter((phase) => phase.name === "resource-plan-v2")
      if (plans.length > 1) throw new Error("Mutation preservation has multiple resource plans")
      if (plans.length === 0) {
        const planned = {} as Record<ResourceKey, ResourcePlan>
        for (const key of ResourceKeys)
          planned[key] = await observeResourcePlan(key, journal, resources, observations[key])
        await append("resource-plan-v2", {
          protocol: "opencorvus/expert-squad-mutation-resource-plan@2",
          originalProtocol: protocol,
          context,
          resources: planned,
        })
      }
      const planPhase = occurrence.phases.find((phase) => phase.name === "resource-plan-v2")!
      const plan = Plan.parse(planPhase.payload)
      if (plan.originalProtocol !== protocol || !sameFact(plan.context, context))
        throw new Error("Mutation preservation resource plan identity differs")
      for (const key of ResourceKeys) {
        const item = plan.resources[key]
        if (
          !sameFact(
            item,
            planResource(
              key,
              journal,
              resources,
              observations[key],
              item.sourceObservation,
              item.destinationObservation,
              item.additionalDestinationObservation,
            ),
          )
        )
          throw new Error("Mutation preservation resource plan paths or observations differ")
      }
      for (const phase of occurrence.phases)
        if (
          ![
            "upgrade-v2",
            "resource-plan-v2",
            "resource-observation-v2",
            "retained-journal",
            ...ResourceKeys.map((key) => `retained-${key}`),
          ].includes(phase.name)
        )
          throw new Error("Mutation preservation has an unknown phase")
      const resourceObservations: Record<ResourceKey, ResourceObservation[]> = {
        target: [],
        backup: [],
        staging: [],
        discard: [],
      }
      for (const phase of occurrence.phases.filter((phase) => phase.name === "resource-observation-v2")) {
        const observation = ResourceObservation.parse(phase.payload)
        const prior = resourceObservations[observation.resource]
        const original = plan.resources[observation.resource]
        const item = observation.plan
        if (
          observation.resourcePlanSequence !== planPhase.sequence ||
          phase.sequence <= planPhase.sequence ||
          observation.previousObservationSequence !== (prior.at(-1)?.sequence ?? null) ||
          !sameFact(
            item,
            planResource(
              observation.resource,
              journal,
              resources,
              original.expectedObservation,
              item.sourceObservation,
              item.destinationObservation,
              item.additionalDestinationObservation,
              phase.sequence,
            ),
          )
        )
          throw new Error("Mutation preservation resource observation identity differs")
        const references = assetReferences([original, ...prior.map((item) => item.plan)])
        if (
          observation.priorAssets.length !== references.length ||
          observation.priorAssets.some(
            (asset, index) =>
              !sameFact(
                { resource: asset.resource, observation: asset.observation, classification: asset.classification },
                references[index],
              ),
          )
        )
          throw new Error("Mutation preservation prior resource observations differ")
        prior.push({ ...observation, sequence: phase.sequence })
      }
      const retainedKeys = ["journal", ...ResourceKeys] as const
      for (const key of retainedKeys) {
        const retained = occurrence.phases.filter((phase) => phase.name === `retained-${key}`)
        if (retained.length > 1) throw new Error(`Mutation preservation has multiple retained ${key} facts`)
        const destination = path.join(resources, key === "journal" ? "original-journal.json" : key)
        const projection =
          key === "journal"
            ? { resource: destination, observation: { kind: "original_bytes" } }
            : { resource: destination, observation: observations[key] }
        if (retained.length) {
          const fact = retained[0]
          if (fact.sequence < planPhase.sequence && protocol.endsWith("@1")) {
            if (!sameFact(fact.payload, projection) || fact.sequence !== retainedKeys.indexOf(key) + 1)
              throw new Error("Historical mutation preservation retained fact differs")
          } else {
            const previous =
              key === "journal" ? [] : resourceObservations[key].filter((item) => item.sequence < fact.sequence)
            const expected = {
              ...projection,
              protocol: "opencorvus/expert-squad-mutation-retained-resource@2",
              resourcePlanSequence: planPhase.sequence,
              ...(key === "journal" ? {} : { evidence: retainedEvidence(plan.resources[key], previous) }),
            }
            if (!sameFact(fact.payload, expected))
              throw new Error("Mutation preservation retained resource fact differs from its plan")
          }
        }
        if (key !== "journal" && !occurrence.terminal) {
          const prior = resourceObservations[key]
          const latest = prior.at(-1)
          let current = latest?.plan ?? plan.resources[key]
          if (!(await plannedResourceMatches(current, latest?.priorAssets))) {
            // A real backup restore can change availability after the original
            // plan. Append that new observation before touching resources; the
            // original plan and retained facts remain immutable history.
            const sequence = occurrence.phases.at(-1)!.sequence + 1
            const next = await observeResourcePlan(key, journal, resources, observations[key], sequence)
            const priorAssets = [] as ResourceObservation["priorAssets"]
            for (const reference of assetReferences([plan.resources[key], ...prior.map((item) => item.plan)]))
              priorAssets.push({ ...reference, currentObservation: await observe(reference.resource) })
            const observation: Omit<ResourceObservation, "sequence"> = {
              protocol: "opencorvus/expert-squad-mutation-resource-observation@2",
              resourcePlanSequence: planPhase.sequence,
              resource: key,
              previousObservationSequence: latest?.sequence ?? null,
              plan: next,
              priorAssets,
            }
            await append("resource-observation-v2", observation)
            prior.push({ ...observation, sequence })
            current = next
          }
          for (const asset of current.assets) await preserveAsset(asset)
        }
        if (!retained.length) {
          if (occurrence.terminal) throw new Error("Completed mutation preservation is missing a retained fact")
          await append(`retained-${key}`, {
            ...projection,
            protocol: "opencorvus/expert-squad-mutation-retained-resource@2",
            resourcePlanSequence: planPhase.sequence,
            ...(key === "journal"
              ? {}
              : { evidence: retainedEvidence(plan.resources[key], resourceObservations[key]) }),
          })
        }
      }
      const resourceEvidence = Object.fromEntries(
        ResourceKeys.map((key) => [key, evidence(plan.resources[key], resourceObservations[key])]),
      )
      for (const item of Object.values(resourceEvidence))
        for (const asset of item.preserved)
          if (!sameObservation(await observe(asset.resource), asset.observation))
            throw new Error("Mutation preservation retained resource changed before terminal")
      const terminal = {
        ...context,
        resources,
        target: journal.target,
        observation: observations.target,
        resourcePlanSequence: planPhase.sequence,
        resourceEvidence,
        targetEvidence: "observed_at_preservation",
        originalMutationAfter: "unverified",
      }
      if (occurrence.terminal) {
        if (occurrence.terminal.outcome !== "committed" || !sameFact(occurrence.terminal.payload, terminal))
          throw new Error("Mutation preservation terminal differs from its resource plan")
      } else
        occurrence = await publication.settle(KIND, {
          occurrenceID: journal.operationID,
          outcome: "committed",
          timeCreated: Date.now(),
          payload: terminal,
        })
    }
    // The current journal remains the only recovery entry until preservation is
    // durable. A crash here re-enters the same terminal and exact-byte cleanup.
    if (input.retireCurrentJournal !== false && (await exists(input.journalPath))) {
      if ((await readFile(input.journalPath, "utf8")) !== input.journalText)
        throw new Error("Current mutation journal changed before preservation cleanup")
      await rm(input.journalPath)
      await Filesystem.syncDirectoryMetadata(path.dirname(input.journalPath))
    }
    return { disposition, occurrenceID: journal.operationID }
  })
}

/** Transport is bounded; enumeration costs O(history) for this exact package. */
export async function inspectExpertSquadMutationPreservation(input: {
  configRoot: string
  id: string
  occurrenceID?: string
  cursor?: string
  byteOffset?: number
}) {
  const publication = store(input.configRoot, input.id)
  if (input.occurrenceID) {
    if (!(await exists(path.join(publication.occurrenceDirectory(KIND, input.occurrenceID), "intent.json"))))
      throw new NotFoundError({ message: `Expert squad mutation preservation not found: ${input.occurrenceID}` })
    const occurrence = await publication.read(KIND, input.occurrenceID)
    const bytes = Buffer.from(JSON.stringify(occurrence), "utf8")
    const offset = input.byteOffset ?? 0
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid preservation byte offset")
    const end = Math.min(bytes.length, offset + 4096)
    return {
      occurrenceID: input.occurrenceID,
      totalBytes: bytes.length,
      byteOffset: offset,
      dataBase64: bytes.subarray(offset, end).toString("base64"),
      nextByteOffset: end < bytes.length ? end : null,
    }
  }
  const all = (await publication.list(KIND)).sort((left, right) =>
    left.intent.occurrenceID < right.intent.occurrenceID
      ? -1
      : left.intent.occurrenceID > right.intent.occurrenceID
        ? 1
        : 0,
  )
  const selected = all.filter((item) => !input.cursor || item.intent.occurrenceID > input.cursor).slice(0, 17)
  const entries = selected.slice(0, 16).map((item) => {
    const plan = item.phases.find((phase) => phase.name === "resource-plan-v2")
    return {
      occurrenceID: item.intent.occurrenceID,
      disposition: Disposition.parse(
        item.terminal?.payload.disposition ??
          (plan ? Context.parse(plan.payload.context).disposition : item.intent.payload.disposition),
      ),
      preservation: item.terminal ? "complete" : "pending",
      timeCreated: item.intent.timeCreated,
      targetEvidence: "observed_at_preservation" as const,
      originalMutationAfter: "unverified" as const,
    }
  })
  return { entries, nextCursor: selected.length > 16 ? entries.at(-1)!.occurrenceID : null }
}
