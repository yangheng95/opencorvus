import { describe, expect, test } from "bun:test"
import {
  onProviderMutation,
  providerMutationScope,
  publishProviderMutation,
  type ProviderMutation,
} from "../src/services/provider-mutation"

describe("accepted Provider mutation metadata", () => {
  test("an already dispatched write reaches the subscriber mounted before its acceptance", async () => {
    const accepted = Promise.withResolvers<ProviderMutation>()
    const dispatched = accepted.promise.then(publishProviderMutation)
    const closeInitiator = onProviderMutation(() => {})
    closeInitiator()
    const received: ProviderMutation[] = []
    const closeCurrent = onProviderMutation((value) => received.push(value))
    const outcome: ProviderMutation = {
      authority: { revision: 6 },
      scope: { kind: "global" },
      providerIDs: ["owned-provider"],
    }
    try {
      accepted.resolve(outcome)
      await dispatched
      expect(received).toEqual([outcome])
    } finally {
      closeCurrent()
    }
  })

  test("one accepted credential outcome reaches both current subscribers with its captured authority", () => {
    const mutation: ProviderMutation = {
      authority: { revision: 7 },
      scope: { kind: "global" },
      providerIDs: ["owned-provider"],
    }
    const first: ProviderMutation[] = [],
      second: ProviderMutation[] = []
    const closeFirst = onProviderMutation((value) => first.push(value))
    const closeSecond = onProviderMutation((value) => second.push(value))
    try {
      publishProviderMutation(mutation)
      expect(first).toEqual([mutation])
      expect(second).toEqual([mutation])
      expect(first[0]).toBe(mutation)
      expect(second[0]).toBe(mutation)
    } finally {
      closeFirst()
      closeSecond()
    }
  })

  test("project configuration carries its exact trimmed directory and affected identity", () => {
    const received: ProviderMutation[] = []
    const close = onProviderMutation((value) => received.push(value))
    try {
      publishProviderMutation({
        authority: { revision: 8 },
        scope: providerMutationScope("  D:/owned/project-A  "),
        providerIDs: ["owned-provider"],
      })
      expect(received).toEqual([
        {
          authority: { revision: 8 },
          scope: { kind: "project", directory: "D:/owned/project-A" },
          providerIDs: ["owned-provider"],
        },
      ])
    } finally {
      close()
    }
  })

  test("an accepted shared registry outcome explicitly addresses the whole observation set", () => {
    const received: ProviderMutation[] = []
    const close = onProviderMutation((value) => received.push(value))
    try {
      publishProviderMutation({ authority: { revision: 9 }, scope: providerMutationScope(" "), providerIDs: "all" })
      expect(received).toEqual([{ authority: { revision: 9 }, scope: { kind: "global" }, providerIDs: "all" }])
    } finally {
      close()
    }
  })
})
