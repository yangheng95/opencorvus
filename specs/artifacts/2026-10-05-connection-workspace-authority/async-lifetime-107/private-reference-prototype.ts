import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { setImmediate } from "node:timers/promises"
import { withConversationCapabilityReferenceMutation as conversationWrite, withConversationCapabilityReferenceRead as conversationRead } from "../packages/opencorvus/src/conversation/capability-transaction"
import { withSkillCatalogMutation as skillWrite, withSkillCatalogReferenceRead as skillRead } from "../packages/opencorvus/src/skill/reference-lock"
import { memoryProject } from "../packages/opencorvus/test/fixture/memory"

const evidence = path.resolve(import.meta.dir, "../specs/artifacts/2026-10-05-connection-workspace-authority/async-lifetime-107")
const cases = [
  { name: "conversation-write", first: conversationWrite, second: conversationWrite },
  { name: "conversation-read", first: conversationRead, second: conversationWrite },
  { name: "skill-write", first: skillWrite, second: skillWrite },
  { name: "skill-read", first: skillRead, second: skillWrite },
] as const

for (const entry of cases) test(`${entry.name} real callback returns before the next global owner observes the committed resource`, async () => {
  const projectA = await memoryProject()
  const projectB = await memoryProject()
  const file = path.join(projectA.path, "owned-reference-state.txt")
  await fs.writeFile(file, "initial")
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const abort = AbortSignal.timeout(15000)
  const order: string[] = []
  const operations: Promise<unknown>[] = []
  const bounded = async <T>(promise: Promise<T>, signal: AbortSignal = abort): Promise<T> => {
    let listener!: () => void
    try { return await Promise.race([promise, new Promise<never>((_, reject) => { listener = () => reject(signal.reason); signal.addEventListener("abort", listener, { once: true }); if(signal.aborted) listener() })]) }
    finally { signal.removeEventListener("abort", listener) }
  }
  try {
    const first = entry.first(async () => {
      order.push("first-entered")
      started.resolve()
      await bounded(release.promise)
      await fs.writeFile(file, "first-committed")
      order.push("first-completed")
      return "first-committed"
    })
    operations.push(first)
    await bounded(Promise.race([started.promise, first.then(() => { throw new Error("First callback settled before entry receipt") })]))
    const second = entry.second(async () => {
      const observed = await fs.readFile(file, "utf8")
      order.push(`second-observed:${observed}`)
      await fs.writeFile(path.join(projectB.path, "owned-reference-observation.txt"), observed)
      return observed
    })
    operations.push(second)
    await setImmediate()
    release.resolve()
    const results = await bounded(Promise.allSettled(operations))
    const state = await fs.readFile(file, "utf8")
    const observation = await fs.readFile(path.join(projectB.path, "owned-reference-observation.txt"), "utf8")
    const facts = { case: entry.name, projectA: projectA.path, projectB: projectB.path, order, results, state, observation, owner: entry.name.startsWith("skill") ? "original durable catalog owner retained" : "original global conversation reference key", timingQualification: "one real event-loop turn after second operation submission; no production hook/spawner override" }
    await fs.writeFile(path.join(evidence, `${entry.name}-${crypto.randomUUID()}.json`), JSON.stringify(facts, null, 2), { flag: "wx" })
    console.log(JSON.stringify(facts))
    expect(state).toBe("first-committed")
    expect(order).toEqual(["first-entered", "first-completed", "second-observed:first-committed"])
    expect(observation).toBe("first-committed")
  } finally {
    release.resolve()
    const joined = await bounded(Promise.allSettled(operations), AbortSignal.timeout(15000))
    console.log(JSON.stringify({ case: entry.name, joined: joined.map(value => value.status) }))
    await projectB[Symbol.asyncDispose]()
    await projectA[Symbol.asyncDispose]()
  }
}, 30000)

for (const owner of [{ name: "conversation", read: conversationRead, write: conversationWrite }, { name: "skill", read: skillRead, write: skillWrite }]) test(`${owner.name} nested owner and real read-to-write rejection retain their current contracts`, async () => {
  const results = await owner.write(async () => owner.write(async () => ({ accepted: "same inherited mutation" })))
  let rejected: unknown
  try { await owner.read(async () => owner.write(async () => "mutation")) } catch(error) { rejected = error }
  console.log(JSON.stringify({ owner: owner.name, results, rejected: rejected instanceof Error ? { name: rejected.name, message: rejected.message } : rejected }))
  expect(results).toEqual({ accepted: "same inherited mutation" })
  expect(rejected).toMatchObject({ name: "Error", message: owner.name === "conversation" ? "Cannot mutate native conversation capability references while holding a reference read." : "Cannot mutate the Skill catalog while holding a catalog reference read." })
}, 30000)

