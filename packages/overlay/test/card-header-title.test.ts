import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const CARD_CSS = readFileSync(join(OVERLAY_ROOT, "src/styles/surfaces/card.css"), "utf8")
const CARD_HEADER_TSX = readFileSync(join(OVERLAY_ROOT, "src/components/CardHeader.tsx"), "utf8")

test("card header renders literal tool titles without i18n lookup", () => {
  expect(CARD_HEADER_TSX).toContain("function cardTitleText")
  expect(CARD_HEADER_TSX).toContain("/^[\\w-]+(?:\\.[\\w-]+)+$/.test(title) ? t(title) : title")
  expect(CARD_HEADER_TSX).toContain("{cardTitleText(props.node.title)}")
  expect(CARD_HEADER_TSX).not.toContain("{t(props.node.title)}")
})

test("structured agent card titles reuse the conversation Goal badge without labeling tool cards", () => {
  expect(CARD_HEADER_TSX).toContain('import { ConversationGoalBadge } from "./ConversationGoalBadge"')
  expect(CARD_HEADER_TSX).toMatch(
    /class="card__title"[\s\S]*<Show when=\{props\.node\.kind === "agent"\}>[\s\S]*<ConversationGoalBadge goalID=\{props\.node\.goalID\} \/>/,
  )
})

test("tool headers keep the parameter summary in the title row and ellipsize it", () => {
  expect(CARD_CSS).toMatch(
    /\.card\[data-kind="tool"\] \.card__title-row\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*align-items:\s*center;/s,
  )
  expect(CARD_CSS).toMatch(
    /\.card\[data-kind="tool"\] \.card__title\s*\{[^}]*flex:\s*0 0 auto;[^}]*font-size:\s*var\(--card-sub-size\);[^}]*line-height:\s*1\.46;[^}]*white-space:\s*nowrap;/s,
  )
  expect(CARD_CSS).toMatch(
    /\.card\[data-kind="tool"\] \.card__subtitle\s*\{[^}]*flex:\s*1 1 auto;[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*font-size:\s*var\(--card-sub-size\);[^}]*line-height:\s*1\.46;/s,
  )
  expect(CARD_CSS).toMatch(
    /\.card\[data-kind="tool"\]\.card--expanded \.card__subtitle\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/s,
  )
})
