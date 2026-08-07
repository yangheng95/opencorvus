import { afterEach, describe, expect, test } from "bun:test"
import {
  occludeNativeSurfaces,
  registerNativeSurfaceOcclusionHooks,
  revealNativeSurfaces,
} from "../src/services/native-surface-occlusion"

const OWNERS = ["config-dialog-test", "app-dialog-test"] as const

afterEach(async () => {
  for (const owner of OWNERS) await revealNativeSurfaces(owner).catch(() => undefined)
})

describe("native surface occlusion ownership", () => {
  test("overlapping Settings and app-dialog owners hide once and restore after the final owner", async () => {
    let hideCount = 0
    let restoreCount = 0
    const unregister = registerNativeSurfaceOcclusionHooks({
      hide: async () => {
        hideCount++
      },
      restore: async () => {
        restoreCount++
      },
    })

    try {
      await occludeNativeSurfaces("config-dialog-test")
      await occludeNativeSurfaces("app-dialog-test")
      expect(hideCount).toBe(1)
      expect(restoreCount).toBe(0)

      await revealNativeSurfaces("config-dialog-test")
      expect(restoreCount).toBe(0)

      await revealNativeSurfaces("app-dialog-test")
      expect(restoreCount).toBe(1)
    } finally {
      unregister()
    }
  })

  test("duplicate acquisition by one owner is idempotent", async () => {
    let hideCount = 0
    let restoreCount = 0
    const unregister = registerNativeSurfaceOcclusionHooks({
      hide: async () => {
        hideCount++
      },
      restore: async () => {
        restoreCount++
      },
    })

    try {
      await occludeNativeSurfaces("config-dialog-test")
      await occludeNativeSurfaces("config-dialog-test")
      await revealNativeSurfaces("config-dialog-test")
      expect(hideCount).toBe(1)
      expect(restoreCount).toBe(1)
    } finally {
      unregister()
    }
  })
})
