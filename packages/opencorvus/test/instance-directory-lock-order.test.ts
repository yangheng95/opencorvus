import { afterEach, expect, test } from "bun:test"
import { AsyncLocalStorage } from "node:async_hooks"
import { Instance, InstanceProcessAdmissionClosedError } from "@/project/instance"
import { Project } from "@/project/project"
import { ProjectDirectoryAdmission } from "@/project/directory-admission"
import { withTimeout } from "@/util/await-with-timeout"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("an independent instance request and a held registration batch settle the same exact Project", async () => {
  await using directory = await memoryProject()
  const registered = await Project.fromDirectory(directory.path)
  const caller = new AsyncLocalStorage<string>()
  let publishHeld!: () => void
  const held = new Promise<void>((resolve) => { publishHeld = resolve })
  let publishIndependentAdmission!: () => void
  const independentAdmission = new Promise<void>((resolve) => { publishIndependentAdmission = resolve })
  using _hook = ProjectDirectoryAdmission.TestHooks.installBeforeAcquire(() => {
    if (caller.getStore() === "independent") publishIndependentAdmission()
  })
  const outside = held.then(() => caller.run("independent", () => Instance.provideProjectIdentity({
    directory: directory.path,
    fn: () => ({ id: Instance.project.id, generation: Instance.projectGeneration }),
  })))
  let outcomes
  let independent
  try {
    outcomes = await ProjectDirectoryAdmission.registrationBatch({
      items: [directory.path], concurrency: 1,
      run: async (target) => {
        publishHeld()
        await withTimeout(independentAdmission, 2_000, "independent directory queue admission")
        return await withTimeout(Instance.provideProjectIdentity({
          directory: target,
          fn: () => ({ id: Instance.project.id, generation: Instance.projectGeneration }),
        }), 2_000, "held registration batch identity")
      },
    })
  } finally {
    publishHeld()
    independent = await withTimeout(outside, 10_000, "independent identity physical settlement")
  }
  const identity = { id: registered.project.id, generation: registered.generation }
  expect({ outcomes, independent }).toEqual({ outcomes: [{ status: "fulfilled", value: identity }], independent: identity })
}, 30_000)

test("queued discovery returns the current process admission error after settlement closes entry", async () => {
  await using directory = await memoryProject()
  const caller = new AsyncLocalStorage<string>()
  let publishHeld!: () => void
  const held = new Promise<void>((resolve) => { publishHeld = resolve })
  let publishAdmission!: () => void
  const admitted = new Promise<void>((resolve) => { publishAdmission = resolve })
  using _hook = ProjectDirectoryAdmission.TestHooks.installBeforeAcquire(() => {
    if (caller.getStore() === "independent") publishAdmission()
  })
  const outside = held.then(() => caller.run("independent", () => Instance.provideProjectIdentity({
    directory: directory.path, fn: () => Instance.project.id,
  }))).catch((error) => error)
  let gate: ReturnType<typeof Instance.acquireProcessSettlementGate> | undefined
  try {
    await ProjectDirectoryAdmission.registrationBatch({
      items: [directory.path], concurrency: 1,
      run: async () => {
        publishHeld()
        await withTimeout(admitted, 2_000, "queued discovery admission")
        gate = Instance.acquireProcessSettlementGate()
      },
    })
    expect(await withTimeout(outside, 10_000, "closed process discovery settlement")).toBeInstanceOf(InstanceProcessAdmissionClosedError)
  } finally {
    publishHeld()
    await withTimeout(outside, 10_000, "queued discovery cleanup")
    gate?.[Symbol.dispose]()
  }
}, 30_000)

test("an exact durable registration discovers its Project while another batch owns the queue", async () => {
  await using directory = await memoryProject()
  const registered = await Project.fromDirectory(directory.path)
  const acquisition = await ProjectDirectoryAdmission.acquire({
    directory: directory.path, operationID: "inherited-instance-registration", kind: "registration",
    occurrence: await ProjectDirectoryAdmission.observeDirectory(directory.path),
  })
  if (acquisition.outcome !== "acquired") throw new Error("Exact test registration required")
  let publishHeld!: () => void
  const held = new Promise<void>((resolve) => { publishHeld = resolve })
  const inherited = held.then(() => ProjectDirectoryAdmission.provide(acquisition.token, () => Instance.provideProjectIdentity({
    directory: directory.path, fn: () => ({ id: Instance.project.id, generation: Instance.projectGeneration }),
  })))
  try {
    const outcomes = await ProjectDirectoryAdmission.registrationBatch({
      items: [directory.path], concurrency: 1,
      run: async () => {
        publishHeld()
        return await withTimeout(inherited, 2_000, "exact inherited directory identity")
      },
    })
    expect(outcomes).toEqual([{ status: "fulfilled", value: { id: registered.project.id, generation: registered.generation } }])
  } finally {
    publishHeld()
    await withTimeout(inherited, 10_000, "inherited identity settlement")
    ProjectDirectoryAdmission.settle(acquisition.token, () => undefined)
  }
}, 30_000)
