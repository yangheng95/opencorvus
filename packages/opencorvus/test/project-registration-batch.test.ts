import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { ProjectDirectoryAdmission as Admission } from "@/project/directory-admission"
import { Project } from "@/project/project"
import { withTimeout } from "@/util/await-with-timeout"
import { tmpdir } from "./fixture/fixture"
import { resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("a cancelled batch settles its accepted registration and returns the original abort reason", async () => {
  await using root = await tmpdir()
  const controller = new AbortController(),
    started = gate(),
    finish = gate(),
    order: string[] = []
  const failure = new Error("declared registration batch cancellation")
  const batch = Admission.registrationBatch({
    concurrency: 1,
    items: [root.path],
    signal: controller.signal,
    run: (directory) =>
      Admission.runRegistration([directory], () =>
        registered(directory, async () => {
          order.push("registration entered")
          started.resolve()
          await finish.promise
          order.push("registration settled")
        }),
      ),
  }).catch((error) => error)
  await withTimeout(started.promise, 1000, "cancellable registration admission")
  controller.abort(failure)
  const outside = Admission.run(async () => {
    order.push("outside admitted")
  })
  finish.resolve()
  const reason = await batch
  await outside
  expect({ reason, order }).toEqual({
    reason: failure,
    order: ["registration entered", "registration settled", "outside admitted"],
  })
})

test("an exclusive operation inside a registration batch returns its typed error and settles the queue", async () => {
  await using root = await tmpdir()
  const result = await Admission.registrationBatch({
    concurrency: 1,
    items: [root.path],
    run: () => Admission.run(async () => "exclusive"),
  })
  const outcome = result[0]
  const failure = outcome?.status === "rejected" ? outcome.reason : undefined
  const current = await Admission.run(async () => "next exclusive complete")
  expect({
    typed: failure instanceof Admission.RegistrationBatchMutationError,
    name: failure?.name,
    message: failure?.message,
    current,
  }).toEqual({
    typed: true,
    name: "ProjectRegistrationBatchMutationError",
    message: "Exclusive directory operations must start outside the registration batch",
    current: "next exclusive complete",
  })
})

test("a fresh physical comparison observes a junction's current target after retargeting", async () => {
  await using root = await tmpdir()
  const first = path.join(root.path, "first"),
    second = path.join(root.path, "second"),
    alias = path.join(root.path, "alias")
  await Promise.all([first, second].map((directory) => fs.mkdir(directory)))
  await fs.symlink(first, alias, process.platform === "win32" ? "junction" : "dir")
  const original = await Project.sameFilesystemLocation(alias, first)
  await fs.unlink(alias)
  await fs.symlink(second, alias, process.platform === "win32" ? "junction" : "dir")
  const current = await Project.sameFilesystemLocation(alias, second)
  expect({ original, current }).toEqual({ original: true, current: true })
})

function gate() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function registered<T>(directory: string, operation: () => Promise<T>) {
  const acquired = await Admission.acquire({ directory, operationID: crypto.randomUUID(), kind: "registration" })
  if (acquired.outcome !== "acquired") throw Error("Exact registration generation required")
  try {
    Admission.assertOwnedNow(acquired.token)
    return await operation()
  } finally {
    Admission.settle(acquired.token, () => undefined)
  }
}

test("a registration batch orders the same physical namespace through aliases and ancestor paths", async () => {
  await using root = await tmpdir()
  const source = path.join(root.path, "source"),
    child = path.join(source, "child"),
    alias = path.join(root.path, "alias")
  await fs.mkdir(child, { recursive: true })
  await fs.symlink(source, alias, process.platform === "win32" ? "junction" : "dir")
  const order: string[] = []
  const result = await Admission.registrationBatch({
    concurrency: 3,
    items: [source, alias, child],
    run: (directory, index) =>
      Admission.runRegistration([directory], () =>
        registered(directory, async () => {
          order.push(`enter:${index}`)
          await Bun.sleep(20)
          await fs.writeFile(path.join(directory, `registration-${index}.txt`), String(index))
          order.push(`settled:${index}`)
          return { index, content: await fs.readFile(path.join(directory, `registration-${index}.txt`), "utf8") }
        }),
      ),
  })
  expect({ order, result }).toEqual({
    order: ["enter:0", "settled:0", "enter:1", "settled:1", "enter:2", "settled:2"],
    result: [0, 1, 2].map((index) => ({ status: "fulfilled", value: { index, content: String(index) } })),
  })
})

test("a failed registration settles its peer and preserves the original error before a later batch", async () => {
  await using root = await tmpdir()
  const directories = [path.join(root.path, "first"), path.join(root.path, "second")]
  await Promise.all(directories.map((directory) => fs.mkdir(directory)))
  const failure = new Error("declared admitted registration failure"),
    peer = gate()
  const result = await Admission.registrationBatch({
    concurrency: 2,
    items: directories,
    run: (directory, index) =>
      Admission.runRegistration([directory], () =>
        registered(directory, async () => {
          if (index === 0) {
            await withTimeout(peer.promise, 1000, "independent peer admission")
            throw failure
          }
          peer.resolve()
          await fs.writeFile(path.join(directory, "complete.txt"), "peer complete")
          return await fs.readFile(path.join(directory, "complete.txt"), "utf8")
        }),
      ),
  })
  const next = await Admission.registrationBatch({
    concurrency: 1,
    items: [directories[0]!],
    run: (directory) =>
      Admission.runRegistration([directory], () => registered(directory, async () => "next complete")),
  })
  expect({ result, next }).toEqual({
    result: [
      { status: "rejected", reason: failure },
      { status: "fulfilled", value: "peer complete" },
    ],
    next: [{ status: "fulfilled", value: "next complete" }],
  })
})

test("a retired registration context acquires the original queue after an independent current owner", async () => {
  await using root = await tmpdir()
  const resume = gate(),
    order: string[] = []
  let later!: Promise<void>
  await Admission.registrationBatch({
    concurrency: 1,
    items: [root.path],
    run: async (directory) => {
      later = resume.promise.then(() =>
        Admission.runRegistration([directory], async () => {
          order.push("late")
        }),
      )
      order.push("batch complete")
    },
  })
  await Admission.run(async () => {
    order.push("independent owner")
    resume.resolve()
    await Bun.sleep(20)
    order.push("independent settled")
  })
  await withTimeout(later, 1000, "retired registration context")
  expect(order).toEqual(["batch complete", "independent owner", "independent settled", "late"])
})

test("a batch drains an accepted registration before releasing the original cross-process queue", async () => {
  await using root = await tmpdir()
  const started = gate(),
    finish = gate(),
    order: string[] = []
  let child!: Promise<void>
  const batch = Admission.registrationBatch({
    concurrency: 1,
    items: [root.path],
    run: async (directory) => {
      child = Admission.runRegistration([directory], async () => {
        order.push("child entered")
        started.resolve()
        await finish.promise
        order.push("child settled")
      })
      order.push("body settled")
    },
  })
  await withTimeout(started.promise, 1000, "accepted registration")
  const outside = Admission.run(async () => {
    order.push("outside entered")
  })
  finish.resolve()
  await Promise.all([batch, outside])
  await child
  expect(order).toEqual(["body settled", "child entered", "child settled", "outside entered"])
})

test("a nested registration batch shares its original queue and returns its own ordered results", async () => {
  await using root = await tmpdir()
  const nested = Admission.registrationBatch({
    concurrency: 1,
    items: [root.path],
    run: (directory) =>
      Admission.registrationBatch({
        concurrency: 1,
        items: [directory],
        run: (entry) => Admission.runRegistration([entry], () => registered(entry, async () => "nested complete")),
      }),
  })
  expect(await withTimeout(nested, 1000, "nested registration batch")).toEqual([
    { status: "fulfilled", value: [{ status: "fulfilled", value: "nested complete" }] },
  ])
})

test("registration batches retain independent runtime-root queue ownership", async () => {
  await using root = await tmpdir()
  const originalData = Global.Path.data,
    otherRoot = path.join(root.path, "other-runtime")
  const result = await Admission.registrationBatch({
    concurrency: 1,
    items: [root.path],
    run: (directory) =>
      Global.provideRoot(otherRoot, () =>
        Admission.registrationBatch({
          concurrency: 1,
          items: [directory],
          run: (entry) => Admission.runRegistration([entry], async () => Global.Path.data),
        }),
      ),
  })
  expect({ result, current: Global.Path.data }).toEqual({
    result: [{ status: "fulfilled", value: [{ status: "fulfilled", value: path.join(otherRoot, "data") }] }],
    current: originalData,
  })
})
