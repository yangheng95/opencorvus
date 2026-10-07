import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { setImmediate } from "node:timers/promises"
import {
  withConversationCapabilityReferenceMutation as conversationWrite,
  withConversationCapabilityReferenceRead as conversationRead,
} from "../src/conversation/capability-transaction"
import {
  withSkillCatalogMutation as skillWrite,
  withSkillCatalogReferenceRead as skillRead,
} from "../src/skill/reference-lock"
import { memoryProject } from "./fixture/memory"

const cases = [
  { name: "conversation-write", first: conversationWrite, second: conversationWrite },
  { name: "conversation-read", first: conversationRead, second: conversationWrite },
  { name: "conversation-write-read", first: conversationWrite, second: conversationRead },
  { name: "skill-write", first: skillWrite, second: skillWrite },
  { name: "skill-read", first: skillRead, second: skillWrite },
  { name: "skill-write-read", first: skillWrite, second: skillRead },
] as const

for (const entry of cases)
  test(`${entry.name} real callback returns before the next global owner observes the committed resource`, async () => {
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
      try {
        return await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            listener = () => reject(signal.reason)
            signal.addEventListener("abort", listener, { once: true })
            if (signal.aborted) listener()
          }),
        ])
      } finally {
        signal.removeEventListener("abort", listener)
      }
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
      await bounded(
        Promise.race([
          started.promise,
          first.then(() => {
            throw new Error("First callback settled before entry receipt")
          }),
        ]),
      )
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
      const facts = {
        case: entry.name,
        projectA: projectA.path,
        projectB: projectB.path,
        order,
        results,
        state,
        observation,
        owner: entry.name.startsWith("skill")
          ? "original durable catalog owner retained"
          : "original global conversation reference key",
        timingQualification:
          "one real event-loop turn after second operation submission; no production hook/spawner override",
      }
      console.log(JSON.stringify(facts))
      expect(state).toBe("first-committed")
      expect(order).toEqual(["first-entered", "first-completed", "second-observed:first-committed"])
      expect(observation).toBe("first-committed")
    } finally {
      release.resolve()
      const joined = await bounded(Promise.allSettled(operations), AbortSignal.timeout(15000))
      console.log(JSON.stringify({ case: entry.name, joined: joined.map((value) => value.status) }))
      await projectB[Symbol.asyncDispose]()
      await projectA[Symbol.asyncDispose]()
    }
  }, 30000)

for (const owner of [
  { name: "conversation", read: conversationRead, write: conversationWrite },
  { name: "skill", read: skillRead, write: skillWrite },
])
  test(`${owner.name} nested owner and real read-to-write rejection retain their current contracts`, async () => {
    const results = await owner.write(async () => owner.write(async () => ({ accepted: "same inherited mutation" })))
    let rejected: unknown
    try {
      await owner.read(async () => owner.write(async () => "mutation"))
    } catch (error) {
      rejected = error
    }
    console.log(
      JSON.stringify({
        owner: owner.name,
        results,
        rejected: rejected instanceof Error ? { name: rejected.name, message: rejected.message } : rejected,
      }),
    )
    expect(results).toEqual({ accepted: "same inherited mutation" })
    expect(rejected).toMatchObject({
      name: "Error",
      message:
        owner.name === "conversation"
          ? "Cannot mutate native conversation capability references while holding a reference read."
          : "Cannot mutate the Skill catalog while holding a catalog reference read.",
    })
  }, 30000)

for (const owner of [
  { name: "conversation", write: conversationWrite },
  { name: "skill", write: skillWrite },
])
  test(`${owner.name} rejected real callback preserves its error and admits the next legal resource write`, async () => {
    const project = await memoryProject()
    const file = path.join(project.path, "rejected-owner.txt")
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const signal = AbortSignal.timeout(15000)
    const original = new Error("Owned reference callback failure")
    const order: string[] = []
    const bounded = async <T>(promise: Promise<T>, abort = signal): Promise<T> => {
      let listener!: () => void
      try {
        return await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            listener = () => reject(abort.reason)
            abort.addEventListener("abort", listener, { once: true })
            if (abort.aborted) listener()
          }),
        ])
      } finally {
        abort.removeEventListener("abort", listener)
      }
    }
    const first = owner.write(async () => {
      await fs.writeFile(file, "prepared-before-rejection")
      entered.resolve()
      await bounded(release.promise)
      order.push("first-rejected")
      throw original
    })
    const firstObserved = first.then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, error }),
    )
    let second: Promise<string> | undefined
    try {
      await bounded(
        Promise.race([
          entered.promise,
          firstObserved.then(() => {
            throw new Error("Rejected callback settled before its entry")
          }),
        ]),
      )
      second = owner.write(async () => {
        const value = await fs.readFile(file, "utf8")
        order.push("second-read")
        await fs.writeFile(file, "next-committed")
        return value
      })
      await setImmediate()
      release.resolve()
      const [failed, next] = await bounded(Promise.all([firstObserved, second]))
      const state = await fs.readFile(file, "utf8")
      console.log(JSON.stringify({ owner: owner.name, order, next, state, failure: failed.status }))
      expect(failed.status).toBe("rejected")
      if (failed.status !== "rejected") throw new Error("Expected actual rejected owner callback")
      expect(failed.error).toBe(original)
      expect({ order, next, state }).toEqual({
        order: ["first-rejected", "second-read"],
        next: "prepared-before-rejection",
        state: "next-committed",
      })
    } finally {
      release.resolve()
      await bounded(Promise.allSettled([firstObserved, ...(second ? [second] : [])]), AbortSignal.timeout(15000))
      await project[Symbol.asyncDispose]()
    }
  }, 30000)
