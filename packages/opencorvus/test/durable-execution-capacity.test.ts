import { describe, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { DurableExecutionCapacity } from "@/runtime/durable-execution-capacity"
import { sha256Text } from "@/util/canonical-digest"
import { memoryProject } from "./fixture/memory"

describe.serial("durable physical execution capacity", () => {
  test("honors a reduced limit before admitting the next exact slot owner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const resourceKey = sha256Text("opencorvus.test.execution-capacity.v1", "capacity-shrink-fixture")
        const first = await DurableExecutionCapacity.acquire({ resourceKey, limit: 2 })
        const second = await DurableExecutionCapacity.acquire({ resourceKey, limit: 2 })
        let admitted = false
        const next = DurableExecutionCapacity.acquire({ resourceKey, limit: 1 }).then((lease) => {
          admitted = true
          return lease
        })

        first.release()
        await Bun.sleep(50)
        expect({ admitted, active: DurableExecutionCapacity.TestHooks.snapshot(resourceKey).filter((row) => row.expires_at > Date.now()).length }).toEqual({ admitted: false, active: 1 })

        second.release()
        const third = await next
        expect({ admitted, slot: third.slot, active: DurableExecutionCapacity.TestHooks.snapshot(resourceKey).filter((row) => row.expires_at > Date.now()).length }).toEqual({ admitted: true, slot: 0, active: 1 })
        third.release()
      },
    })
  })

  test("settles an aborted saturated waiter with the caller's exact reason", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const resourceKey = sha256Text("opencorvus.test.execution-capacity.v1", "capacity-abort-fixture")
        const owner = await DurableExecutionCapacity.acquire({ resourceKey, limit: 1 })
        const controller = new AbortController()
        const reason = new DOMException("capacity caller stopped", "AbortError")
        const waiting = DurableExecutionCapacity.acquire({ resourceKey, limit: 1, signal: controller.signal })
        controller.abort(reason)
        expect(await waiting.catch((error) => error)).toBe(reason)
        owner.release()
      },
    })
  })
})
