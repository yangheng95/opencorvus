import { describe, expect, test } from "bun:test"
import { computeNextVersion } from "../src/version"

/**
 * audit-2026-04-29 W2-V20. Lock the strict-semver guard so a future
 * refactor that replaces the regex with the old
 * `split(".").map((x) => Number(x) || 0)` pattern (which produced
 * silent garbage on prereleases) trips this test instead of
 * shipping a botched release.
 */

describe("computeNextVersion (audit W2-V20)", () => {
  test("default bump is patch", () => {
    expect(computeNextVersion("1.2.3")).toBe("1.2.4")
  })

  test("BUMP=minor bumps Y, resets Z", () => {
    expect(computeNextVersion("1.2.3", "minor")).toBe("1.3.0")
  })

  test("BUMP=major bumps X, resets Y and Z", () => {
    expect(computeNextVersion("1.2.3", "major")).toBe("2.0.0")
  })

  test("bump argument is case-insensitive", () => {
    expect(computeNextVersion("1.2.3", "MAJOR")).toBe("2.0.0")
    expect(computeNextVersion("1.2.3", "Minor")).toBe("1.3.0")
    expect(computeNextVersion("1.2.3", "PATCH")).toBe("1.2.4")
  })

  test("zero version → patch bump produces 0.0.1", () => {
    expect(computeNextVersion("0.0.0")).toBe("0.0.1")
  })

  test("multi-digit components don't overflow", () => {
    expect(computeNextVersion("12.34.56")).toBe("12.34.57")
    expect(computeNextVersion("12.34.56", "minor")).toBe("12.35.0")
  })

  // ── The regression boundary ──────────────────────────────────

  test("rejects prerelease tag — `1.0.0-rc.1` is NOT bumpable (operator error)", () => {
    // Pre-fix this returned `1.0.1` (lost the prerelease metadata
    // entirely; would 409 on npm publish). Post-fix throws so
    // the build aborts and the operator can fix the npm dist-tag.
    expect(() => computeNextVersion("1.0.0-rc.1")).toThrow(/clean X\.Y\.Z/)
  })

  test("rejects build metadata — `1.0.0+build.5`", () => {
    expect(() => computeNextVersion("1.0.0+build.5")).toThrow(/clean X\.Y\.Z/)
  })

  test("rejects v-prefix — `v1.0.0`", () => {
    expect(() => computeNextVersion("v1.0.0")).toThrow(/clean X\.Y\.Z/)
  })

  test("rejects empty string", () => {
    expect(() => computeNextVersion("")).toThrow(/clean X\.Y\.Z/)
  })

  test("rejects garbage that happens to contain dots", () => {
    expect(() => computeNextVersion("a.b.c")).toThrow(/clean X\.Y\.Z/)
    expect(() => computeNextVersion("1.2")).toThrow(/clean X\.Y\.Z/)
    expect(() => computeNextVersion("1.2.3.4")).toThrow(/clean X\.Y\.Z/)
  })

  test("error message names the offending value so logs surface it", () => {
    try {
      computeNextVersion("1.0.0-beta.2")
    } catch (err) {
      expect(err instanceof Error).toBe(true)
      expect((err as Error).message).toContain("1.0.0-beta.2")
      return
    }
    throw new Error("expected throw, got resolve")
  })
})
