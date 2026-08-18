import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { landingCopy, type LandingCopy } from "../src/content/landing-copy"
import { platformFacts } from "../src/content/platform-facts"

/**
 * Landing copy budget.
 *
 * The previous public site spread one message across eight surfaces and nobody read past the first.
 * Collapsing to a single page only helps if the page stays short, and "stays short" is not a thing
 * prose review reliably catches — a paragraph grows by one sentence at a time. So it is a test.
 *
 * Counting rule: Chinese is measured in characters, English in words. A 40-character Chinese lead
 * and a 40-word English lead are very different amounts of reading, so the two locales get separate
 * limits rather than one number that is wrong for both.
 *
 * Current headroom is deliberate — the limits are set where the copy would start to feel long, not
 * snug against today's text, so ordinary edits do not fail the suite.
 */

const BUDGET = {
  "zh-cn": { unit: "characters", totalBody: 1400, title: 12, lead: 40, cardBody: 60, heroLine: 12, heroDescription: 45, faqQuestion: 30, faqAnswer: 140 },
  root: { unit: "words", totalBody: 560, title: 6, lead: 16, cardBody: 20, heroLine: 6, heroDescription: 20, faqQuestion: 10, faqAnswer: 60 },
} as const

const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length
const countChars = (value: string) => [...value.replace(/\s+/g, "")].length

function measurer(locale: keyof typeof BUDGET) {
  return locale === "zh-cn" ? countChars : countWords
}

/** Every string that a reader actually has to read, excluding labels, alt text and metadata. */
function bodyStrings(copy: LandingCopy): string[] {
  return [
    copy.hero.description,
    copy.why.lead,
    ...copy.why.pillars.map((pillar) => pillar.body),
    copy.why.compare.lead,
    copy.why.compare.fairness,
    copy.squads.lead,
    copy.start.lead,
    copy.start.cliBody,
    copy.start.desktopBody,
    ...copy.start.trust.map((item) => item.body),
    copy.join.lead,
    copy.faq.lead,
    ...copy.faq.items.map((item) => item.a),
  ]
}

function sectionTitles(copy: LandingCopy): string[] {
  return [copy.why.title, copy.start.title, copy.faq.title, copy.join.title]
}

function leads(copy: LandingCopy): string[] {
  return [
    copy.why.lead,
    copy.squads.lead,
    copy.start.lead,
    copy.faq.lead,
    copy.join.lead,
  ]
}

function cardBodies(copy: LandingCopy): string[] {
  return [
    ...copy.why.pillars.map((pillar) => pillar.body),
    ...copy.start.trust.map((item) => item.body),
  ]
}

for (const locale of ["zh-cn", "root"] as const) {
  const copy = landingCopy[locale]
  const budget = BUDGET[locale]
  const measure = measurer(locale)

  describe(`landing copy budget · ${locale} (${budget.unit})`, () => {
    test("total body copy is within budget", () => {
      const total = bodyStrings(copy).reduce((sum, value) => sum + measure(value), 0)
      expect(total).toBeLessThanOrEqual(budget.totalBody)
    })

    test("section titles are within budget", () => {
      const over = sectionTitles(copy).filter((value) => measure(value) > budget.title)
      expect(over).toEqual([])
    })

    test("section leads are within budget", () => {
      const over = leads(copy).filter((value) => measure(value) > budget.lead)
      expect(over).toEqual([])
    })

    test("card bodies are within budget", () => {
      const over = cardBodies(copy).filter((value) => measure(value) > budget.cardBody)
      expect(over).toEqual([])
    })

    test("FAQ entries are within budget", () => {
      // Answers are longer than card bodies on purpose — an accordion is where a real explanation
      // belongs — but "longer" still has a ceiling, or the section becomes the documentation.
      for (const item of copy.faq.items) {
        expect(measure(item.q), item.q).toBeLessThanOrEqual(budget.faqQuestion)
        expect(measure(item.a), item.q).toBeLessThanOrEqual(budget.faqAnswer)
      }
    })

    test("hero lines and description are within budget", () => {
      for (const line of copy.hero.titleLines) expect(measure(line)).toBeLessThanOrEqual(budget.heroLine)
      expect(measure(copy.hero.description)).toBeLessThanOrEqual(budget.heroDescription)
    })
  })
}

describe("landing copy integrity", () => {
  test("both locales expose the same shape", () => {
    const shapeOf = (copy: LandingCopy) => ({
      ctas: copy.hero.ctas.length,
      terminals: copy.hero.terminals.map((terminal) => terminal.id),
      pillars: copy.why.pillars.map((pillar) => pillar.id),
      compareColumns: copy.why.compare.columns.map((column) => column.label),
      compareRows: copy.why.compare.rows.map((row) => row.axis).length,
      trust: copy.start.trust.length,
      faq: copy.faq.items.length,
      joinCtas: copy.join.ctas.length,
    })
    expect(shapeOf(landingCopy["zh-cn"])).toEqual(shapeOf(landingCopy.root))
  })

  test("squad counts in copy come from the generated fact, not a typed literal", () => {
    // Catches the failure mode where a number is updated in one locale and not the other, or drifts
    // from the catalog entirely.
    const total = platformFacts.squadTotal.value
    for (const locale of ["zh-cn", "root"] as const) {
      const copy = landingCopy[locale]
      expect(copy.squads.title).toContain(total)
      expect(copy.squads.cta).toContain(total)
      const customPillar = copy.why.pillars.find((pillar) => pillar.id === "custom")
      expect(customPillar?.evidenceValue).toBe(total)
    }
  })

  test("every landing CTA points somewhere resolvable", () => {
    for (const locale of ["zh-cn", "root"] as const) {
      const copy = landingCopy[locale]
      for (const cta of [...copy.hero.ctas, ...copy.join.ctas]) {
        // Site-local paths get run through publicPath at render time, so they must be rooted;
        // anything else must be an absolute URL or a same-page anchor.
        expect(cta.href).toMatch(/^(https?:\/\/|\/|#)/)
        expect(cta.label.length).toBeGreaterThan(0)
      }
    }
  })

  test("advertised install paths exist in README.md", () => {
    // An earlier draft of this page advertised `npx opencorvus@latest`, which the project does not
    // publish. A landing page that tells people to run a command that does not work is worse than
    // one that says less, so the commands are checked against the README rather than reviewed by
    // eye. If an install path genuinely changes, change README.md first.
    const readme = readFileSync(fileURLToPath(new URL("../../../README.md", import.meta.url)), "utf8")

    for (const locale of ["zh-cn", "root"] as const) {
      const copy = landingCopy[locale]
      expect(readme).toContain(copy.start.cliCommand)

      const commands = copy.hero.terminals
        .flatMap((terminal) => terminal.lines)
        .filter((line) => line.startsWith("$ "))
        .map((line) => line.slice(2))

      for (const command of commands) {
        // Only the verbs are checked: paths like /path/to/your/repo are illustrative by design.
        const verb = command.split(" ").slice(0, 2).join(" ")
        if (verb.startsWith("cd ")) continue
        expect(readme, `${verb} is not an install path README.md documents`).toContain(verb)
      }
    }
  })

  test("no unpublished package manager invocations in our own copy", () => {
    /*
     * The project ships no npm package, so any of these describing OpenCorvus is a fabricated
     * install path. The comparison block is excluded because it states how *other* products are
     * installed — "npx 一行拉起 Web UI" is a true fact about DeepSeek Harness, and a guard that
     * cannot tell the two apart would force the comparison to be vague to stay green.
     */
    const ownCopy = (["zh-cn", "root"] as const).map((locale) => {
      const { why, ...rest } = landingCopy[locale]
      const { compare, ...whyWithoutCompare } = why
      return JSON.stringify({ ...rest, why: whyWithoutCompare })
    })

    for (const serialized of ownCopy) {
      for (const invocation of ["npx ", "npm install -g", "npm i -g", "yarn dlx", "pnpm dlx", "brew install"]) {
        expect(serialized).not.toContain(invocation)
      }
    }
  })

  test("the comparison states only checkable facts, with sources", () => {
    // A comparison is only worth printing if a reader can go and verify it, so every rival column
    // carries a link, our own column is marked rather than merely last, and the fairness note is
    // mandatory — the table must say somewhere that we are not ahead on every axis.
    for (const locale of ["zh-cn", "root"] as const) {
      const compare = landingCopy[locale].why.compare
      const rivals = compare.columns.filter((column) => !column.self)
      const self = compare.columns.filter((column) => column.self)

      expect(rivals.length).toBeGreaterThanOrEqual(2)
      expect(self).toHaveLength(1)
      for (const rival of rivals) expect(rival.href, `${rival.label} has no source link`).toMatch(/^https:\/\//)
      for (const row of compare.rows) expect(row.cells).toHaveLength(compare.columns.length)
      expect(compare.fairness.length).toBeGreaterThan(20)
    }
  })

  test("headings read as titles, not as sentences", () => {
    /*
     * House rule: a heading is a noun phrase. Sentences, second-person address and spoken-register
     * endings belong in the lead underneath, where there is room for a voice.
     *
     * This started as a page whose h1 was 先看它能完成什么，再决定要不要把团队带进任务。 — a
     * twenty-two character sentence set at 44px, which is a lead wearing a title's clothes.
     */
    const sentenceEnders = ["。", "？", "！", ".", "?", "!"]
    const colloquial = ["你说了算", "长这样", "就能用", "做得更好", "问清楚", "先看", "再决定"]

    const headings = [
      ...sectionTitles(landingCopy["zh-cn"]),
      ...sectionTitles(landingCopy.root),
      landingCopy["zh-cn"].squads.title,
      landingCopy.root.squads.title,
    ]

    for (const heading of headings) {
      for (const ender of sentenceEnders) {
        expect(heading.endsWith(ender), `heading ends like a sentence: ${heading}`).toBe(false)
      }
      for (const phrase of colloquial) {
        expect(heading.includes(phrase), `heading is colloquial: ${heading}`).toBe(false)
      }
      // "你" as address; 你的 inside the slogan is deliberate and lives in hero.titleLines, which
      // is not covered here.
      expect(heading.includes("你"), `heading addresses the reader: ${heading}`).toBe(false)
    }
  })

  test("no placeholder text survives", () => {
    const serialized = JSON.stringify(landingCopy)
    for (const smell of ["TODO", "FIXME", "Lorem", "lorem", "TBD", "XXX"]) {
      expect(serialized).not.toContain(smell)
    }
  })
})
