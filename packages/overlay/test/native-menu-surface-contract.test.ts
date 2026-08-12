import { describe, expect, test } from "bun:test"
import {
  NativeMenuSurfaceReadinessError,
  waitForNativeMenuSurfaceReady,
} from "../src/services/native-menu-surface-contract"

describe("native menu surface readiness", () => {
  test("resolves the child-surface readiness signal before the deadline", async () => {
    await expect(waitForNativeMenuSurfaceReady(Promise.resolve("ready"), 50)).resolves.toBe("ready")
  })

  test("reports the stable timeout error contract when readiness never settles", async () => {
    const pending = new Promise<never>(() => undefined)

    await expect(waitForNativeMenuSurfaceReady(pending, 1)).rejects.toEqual(
      new NativeMenuSurfaceReadinessError(1),
    )
  })
})
