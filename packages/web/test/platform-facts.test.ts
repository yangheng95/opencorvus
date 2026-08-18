import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { platformFacts, isFeaturable, type PlatformFact } from "../src/content/platform-facts"
import { generatedPlatformFacts } from "../src/content/platform-facts.generated"
import { derivePlatformFacts } from "../script/generate-platform-facts"

/**
 * Provenance discipline for published numbers.
 *
 * Four of these counts used to be string literals in the landing copy with no generator and no
 * test, which is how "87 providers" survives a change that makes it 91. These tests hold two
 * separate lines: every fact must be generated, and the generated file must still agree with the
 * registries it claims to come from. The second matters because a committed `.generated.ts` looks
 * authoritative long after the registry moved on.
 *
 * @see docs/website-restyle-plan.md 数字出处标记
 */

const factEntries = Object.entries(platformFacts) as Array<[string, PlatformFact]>

describe("fact provenance", () => {
  test("there is something to check", () => {
    // Guards the assertions below against an empty or renamed export silently passing.
    expect(factEntries.length).toBeGreaterThanOrEqual(7)
  })

  test("no fact is left marked manual", () => {
    const manual = factEntries.filter(([, fact]) => fact.source !== "generated").map(([name]) => name)
    expect(manual).toEqual([])
  })

  test("every fact is therefore featurable", () => {
    const unfeaturable = factEntries.filter(([, fact]) => !isFeaturable(fact)).map(([name]) => name)
    expect(unfeaturable).toEqual([])
  })

  test("no fact renders as an empty string, zero, or NaN", () => {
    for (const [name, fact] of factEntries) {
      expect(fact.value, name).toMatch(/^[0-9][0-9,]*$/)
      expect(fact.value, name).not.toBe("0")
      expect(Number(fact.value.replaceAll(",", "")), name).toBeGreaterThan(0)
    }
  })

  test("the manual helper is gone, so a hand-typed number cannot slip back in quietly", () => {
    // Re-adding it is allowed, but it must be a visible edit that trips the assertions above.
    const source = readFileSync(fileURLToPath(new URL("../src/content/platform-facts.ts", import.meta.url)), "utf8")
    expect(source).not.toMatch(/^\s*const manual\s*=/m)
  })
})

describe("generated facts match their registries", () => {
  test("the committed generated file is not stale", async () => {
    // Re-derives from the live registries and compares. Fails when someone adds a channel adapter
    // or a tool and does not re-run the generator.
    const fresh = await derivePlatformFacts()
    expect(fresh).toEqual({ ...generatedPlatformFacts })
  })

  test("counts are within a sane order of magnitude", async () => {
    const fresh = await derivePlatformFacts()
    expect(fresh.modelProviders).toBeGreaterThan(50)
    expect(fresh.models).toBeGreaterThan(fresh.modelProviders)
    expect(fresh.chatChannels).toBeGreaterThan(5)
    expect(fresh.builtInTools).toBeGreaterThan(20)
  })
})

describe("presentation", () => {
  test("the model total carries thousands separators and the small counts do not", () => {
    expect(platformFacts.models.value).toBe(
      generatedPlatformFacts.models.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
    )
    expect(platformFacts.models.value).toContain(",")
    expect(platformFacts.chatChannels.value).not.toContain(",")
    expect(platformFacts.builtInTools.value).not.toContain(",")
  })

  test("each platform fact carries the value the generator produced", () => {
    expect(platformFacts.modelProviders.value).toBe(String(generatedPlatformFacts.modelProviders))
    expect(platformFacts.chatChannels.value).toBe(String(generatedPlatformFacts.chatChannels))
    expect(platformFacts.builtInTools.value).toBe(String(generatedPlatformFacts.builtInTools))
  })
})
