import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { landingCopy, type LandingCopy } from "../src/content/landing-copy"
import { platformFacts } from "../src/content/platform-facts"
import { FEATURED_COMPOSITION_ID, squadCompositions } from "../src/content/squad-compositions"
import { generatedSquadCompositions } from "../src/content/squad-compositions.generated"

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
 *
 * `totalBody` was raised once, deliberately, when the page took on the long-horizon and evolution
 * sections: three new failure/mechanism cards, a composition section, and two paths of squad
 * revision. That is more page, not looser prose — the per-string limits below did not move, so each
 * individual sentence is held to exactly what it was before.
 */

const BUDGET = {
  "zh-cn": { unit: "characters", totalBody: 1750, title: 12, lead: 40, cardBody: 60, heroLine: 12, heroDescription: 45, faqQuestion: 30, faqAnswer: 140 },
  root: { unit: "words", totalBody: 780, title: 6, lead: 16, cardBody: 20, heroLine: 6, heroDescription: 20, faqQuestion: 10, faqAnswer: 60 },
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
    copy.demo.lead,
    copy.horizon.lead,
    ...copy.horizon.breaks.map((entry) => entry.body),
    copy.compose.lead,
    copy.evolve.lead,
    ...copy.evolve.paths.map((path) => path.body),
    copy.evolve.boundary,
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
  return [
    copy.demo.title,
    copy.horizon.title,
    copy.compose.title,
    copy.evolve.title,
    copy.why.title,
    copy.start.title,
    copy.faq.title,
    copy.join.title,
  ]
}

function leads(copy: LandingCopy): string[] {
  return [
    copy.demo.lead,
    copy.horizon.lead,
    copy.compose.lead,
    copy.evolve.lead,
    copy.why.lead,
    copy.squads.lead,
    copy.start.lead,
    copy.faq.lead,
    copy.join.lead,
  ]
}

function cardBodies(copy: LandingCopy): string[] {
  return [
    ...copy.horizon.breaks.map((entry) => entry.body),
    ...copy.evolve.paths.map((path) => path.body),
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
      horizonBreaks: copy.horizon.breaks.map((entry) => entry.id),
      evolvePaths: copy.evolve.paths.map((path) => path.id),
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

  test("composition totals are resolved from the catalog, not typed into copy", () => {
    // "Six squads, thirty-three roles" is the shape of claim that outlives the squad that gained a
    // role. `squad-compositions.ts` declares the chain and no numbers; the generator resolves the
    // counts from the same records the market is built from. These assertions hold the internal
    // shape of that seam — see the next test for whether the numbers are still true.
    for (const composition of squadCompositions) {
      const generated = generatedSquadCompositions[composition.id]
      expect(generated, composition.id).toBeDefined()
      expect(generated.squads.map((squad) => `${squad.namespace}/${squad.id}`)).toEqual(
        composition.steps.map((step) => step.squadId),
      )
      expect(generated.squadCount).toBe(composition.steps.length)
      expect(generated.roleCount).toBe(generated.squads.reduce((sum, squad) => sum + squad.agentCount, 0))
      expect(generated.roleCount).toBeGreaterThan(generated.squadCount)

      const extraIDs = composition.extras?.squadIds ?? []
      expect(generated.extras.map((squad) => `${squad.namespace}/${squad.id}`)).toEqual([...extraIDs])
      expect(generated.withExtrasSquadCount).toBe(generated.squadCount + extraIDs.length)
      expect(generated.withExtrasRoleCount).toBe(
        generated.roleCount + generated.extras.reduce((sum, squad) => sum + squad.agentCount, 0),
      )
    }
  })

  test("the featured composition is one of the declared ones", () => {
    expect(squadCompositions.map((composition) => composition.id)).toContain(FEATURED_COMPOSITION_ID)
  })

  test("generated role counts still match the shipped packages", () => {
    // The test above compares the generated file to itself, which passes happily while the file is
    // stale — the exact failure `platform-facts.test.ts` exists to prevent for platform numbers. So
    // re-derive from the authority the generator read: `capability_projection.agents` in each
    // shipped manifest. Embedded squads live under the runtime package, the rest under
    // `expert-squads/builtin/`; both roots are the ones `generate-public-market.ts` loads.
    const repoRoot = fileURLToPath(new URL("../../..", import.meta.url))

    const declaredAgentCount = (id: string) => {
      const roots = [
        `${repoRoot}/expert-squads/builtin/${id}/expert-squad.jsonc`,
        `${repoRoot}/packages/opencorvus/src/expert-squad/builtin/${id}/expert-squad.jsonc`,
      ]
      const manifestPath = roots.find((candidate) => existsSync(candidate))
      expect(manifestPath, `no shipped manifest for ${id}`).toBeDefined()
      const manifest = JSON.parse(readFileSync(manifestPath as string, "utf8"))
      return Object.keys(manifest.capability_projection.agents ?? {}).length
    }

    for (const [compositionID, generated] of Object.entries(generatedSquadCompositions)) {
      for (const squad of [...generated.squads, ...generated.extras]) {
        expect(squad.agentCount, `${compositionID} / ${squad.id}`).toBe(declaredAgentCount(squad.id))
      }
    }
  })

  test("the README composition figures match the generated facts", () => {
    // Both READMEs re-type the totals as markdown, because a README cannot import a module. That is
    // the same shape as the "42 built-in tools" drift this section was written to end, so the
    // numbers are checked against the generator rather than reviewed by eye.
    //
    // Every assertion below is anchored to the sentence or the table row that carries the figure. A
    // bare `toContain("6")` against a 25 KB README passes on any two-digit accident, and the first
    // draft of this test did exactly that; the escaping in the cell pattern is why it is written as
    // a String.raw template rather than a plain one.
    const featured = generatedSquadCompositions[FEATURED_COMPOSITION_ID]

    /** A markdown table cell holding this number and nothing else. */
    const cell = (value: number) => new RegExp(String.raw`\|\s*${value}\s*\|`)

    const readmes = [
      {
        relative: "../../../README.md",
        locale: "root" as const,
        totals: [
          `**${featured.squadCount} Expert Squads · ${featured.roleCount} named roles**`,
          `**${featured.withExtrasSquadCount} squads · ${featured.withExtrasRoleCount} named roles**`,
        ],
      },
      {
        relative: "../../../README.zh-CN.md",
        locale: "zh-cn" as const,
        totals: [
          `**${featured.squadCount} 支专家团 · ${featured.roleCount} 个具名角色**`,
          `**${featured.withExtrasSquadCount} 支专家团 · ${featured.withExtrasRoleCount} 个具名角色**`,
        ],
      },
    ]

    for (const { relative, locale, totals } of readmes) {
      const text = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")
      const lines = text.split(/\r?\n/)

      for (const total of totals) expect(text, `${relative}: ${total}`).toContain(total)

      // Each case-table row, located by the squad's own market link so the row cannot be confused
      // with another, must carry that squad's role count as a cell of its own. Only the part of the
      // row after the link is searched: the stage index is a bare-number cell too, and it is only
      // the zero padding that keeps `01`–`06` from colliding with a role count today.
      for (const squad of featured.squads) {
        const link = `/market/builtin/${squad.id}/`
        const row = lines.find((line) => line.startsWith("|") && line.includes(link))
        expect(row, `${relative}: no case-table row for ${squad.id}`).toBeDefined()
        const afterLink = (row as string).slice((row as string).indexOf(link))
        expect(afterLink, `${relative} / ${squad.id} role count`).toMatch(cell(squad.agentCount))
      }

      // The optional extensions are prose rather than a table, and each carries its own role count
      // in parentheses. Checking only their sum lets two compensating errors through — swapping the
      // prior-art and browser figures keeps the total at 44 and would otherwise pass.
      for (const squad of featured.extras) {
        expect(text, `${relative} / ${squad.id} extension role count`).toMatch(
          new RegExp(String.raw`/market/builtin/${squad.id}/\)\s*[(（]${squad.agentCount}[)）]`),
        )
      }

      // And the shorter chains, located by the label of the squad that opens each one.
      for (const [compositionID, generated] of Object.entries(generatedSquadCompositions)) {
        if (compositionID === FEATURED_COMPOSITION_ID) continue
        const opener = generated.squads[0].displayLabel[locale]
        const row = lines.find((line) => line.startsWith("|") && line.includes(opener))
        expect(row, `${relative}: no row for ${compositionID} (opening squad ${opener})`).toBeDefined()
        expect(row, `${relative} / ${compositionID} role total`).toMatch(cell(generated.roleCount))
      }
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
      expect(readme).toContain(copy.start.serveCommand)

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
