import { visibleMentionDirectiveRanges, type VisibleMentionDirectiveRange } from "@opencorvus-ai/transport-protocol"

export type ComposerMentionKind = "skill" | "mission-skill" | "squad"

export interface ComposerMentionEntity {
  kind: ComposerMentionKind
  id: string
  label: string
  description?: string
  disabled?: boolean
}

export interface ComposerMentionCategory {
  kind: ComposerMentionKind
  label: string
  description: string
  disabled?: boolean
}

export interface ComposerMentionQuery {
  start: number
  end: number
  stage: "category" | "entity"
  kind?: ComposerMentionKind
  query: string
}

export interface ComposerMentionOption {
  type: "entity"
  key: string
  kind: ComposerMentionKind
  id: string
  label: string
  description?: string
  searchText: string
  disabled: boolean
}

export interface ComposerMentionCatalog {
  categories: readonly ComposerMentionCategory[]
  skills: readonly ComposerMentionEntity[]
  missionSkills: readonly ComposerMentionEntity[]
  squads: readonly ComposerMentionEntity[]
}

export interface ComposerMentionDirectives {
  skillNames: string[]
  missionSkillNames: string[]
  squadIDs: string[]
}

export type ComposerMentionDirectiveRange = VisibleMentionDirectiveRange

export interface ComposerMentionAtomicEdit {
  text: string
  caret: number
}

export interface ComposerMentionAtomicSelection {
  start: number
  end: number
}

export interface ComposerMentionPresentationSegment {
  text: string
  kind?: ComposerMentionKind
}

export type ComposerMentionDirectiveErrorCode =
  | "unknown_skill"
  | "unknown_mission_skill"
  | "unknown_squad"
  | "malformed_reference"

export class ComposerMentionDirectiveError extends Error {
  constructor(
    readonly code: ComposerMentionDirectiveErrorCode,
    readonly entity: string,
  ) {
    super(`${code}: ${entity}`)
    this.name = "ComposerMentionDirectiveError"
  }
}

const MENTION_KINDS: readonly ComposerMentionKind[] = ["skill", "mission-skill", "squad"]
const COMPOSER_MENTION_SYNTAX: Readonly<Record<ComposerMentionKind, string>> = {
  skill: "skill",
  "mission-skill": "mission",
  squad: "squad",
}

function mentionKindForSyntax(syntax: string): ComposerMentionKind | undefined {
  return MENTION_KINDS.find((kind) => COMPOSER_MENTION_SYNTAX[kind] === syntax)
}

export function composerMentionSyntax(kind: ComposerMentionKind): string {
  return COMPOSER_MENTION_SYNTAX[kind]
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function mentionBoundaryAllows(text: string, index: number): boolean {
  if (index === 0) return true
  return !/[\p{L}\p{N}_]/u.test(text[index - 1] ?? "")
}

export function findComposerMentionQuery(text: string, caret: number): ComposerMentionQuery | null {
  const end = Math.max(0, Math.min(caret, text.length))
  const start = text.lastIndexOf("@", Math.max(0, end - 1))
  if (start < 0 || start >= end || !mentionBoundaryAllows(text, start)) return null
  const fragment = text.slice(start + 1, end)
  if (fragment.includes("\n") || fragment.includes("\r") || fragment.includes(")")) return null

  const categoryQuery = normalizeSearchText(fragment)
  if (/^[A-Za-z0-9._-]*$/.test(categoryQuery)) {
    const exactKind = mentionKindForSyntax(categoryQuery)
    if (exactKind) return { start, end, stage: "entity", kind: exactKind, query: "" }
    return { start, end, stage: "category", query: categoryQuery }
  }

  for (const kind of MENTION_KINDS) {
    const prefix = `${COMPOSER_MENTION_SYNTAX[kind]} `
    if (fragment.toLocaleLowerCase().startsWith(prefix)) {
      return {
        start,
        end,
        stage: "entity",
        kind,
        query: fragment.slice(prefix.length).trimStart(),
      }
    }
  }
  return null
}

export function composerMentionQueryKey(query: ComposerMentionQuery): string {
  return [query.start, query.end, query.stage, query.kind ?? "", query.query].join(":")
}

function rankedOptionScore(option: ComposerMentionOption, query: string): number | null {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return 0
  const normalizedLabel = normalizeSearchText(option.label)
  const normalizedID = normalizeSearchText(option.id)
  const normalizedSyntax = normalizeSearchText(composerMentionSyntax(option.kind))
  const normalizedDescription = normalizeSearchText(option.description ?? "")
  if (normalizedID === normalizedQuery || normalizedLabel === normalizedQuery || normalizedSyntax === normalizedQuery) {
    return 0
  }
  if (
    normalizedID.startsWith(normalizedQuery) ||
    normalizedLabel.startsWith(normalizedQuery) ||
    normalizedSyntax.startsWith(normalizedQuery)
  ) {
    return 1
  }
  if (
    normalizedID.includes(normalizedQuery) ||
    normalizedLabel.includes(normalizedQuery) ||
    normalizedSyntax.includes(normalizedQuery)
  ) {
    return 2
  }
  if (normalizedDescription.includes(normalizedQuery)) return 3
  return null
}

function entityOptions(entities: readonly ComposerMentionEntity[]): ComposerMentionOption[] {
  return entities.map((entity) => ({
    type: "entity",
    key: `${entity.kind}:${entity.id}`,
    kind: entity.kind,
    id: entity.id,
    label: entity.label,
    description: entity.description,
    searchText: [entity.id, entity.label, entity.description ?? ""].join(" "),
    disabled: entity.disabled === true,
  }))
}

export function composerMentionOptions(
  query: ComposerMentionQuery,
  catalog: ComposerMentionCatalog,
): ComposerMentionOption[] {
  const candidates =
    query.stage === "category"
      ? entityOptions([...catalog.skills, ...catalog.missionSkills, ...catalog.squads])
      : entityOptions(
          query.kind === "skill"
            ? catalog.skills
            : query.kind === "mission-skill"
              ? catalog.missionSkills
              : catalog.squads,
        )

  return candidates
    .map((option, index) => ({ option, index, score: rankedOptionScore(option, query.query) }))
    .filter((entry): entry is typeof entry & { score: number } => entry.score !== null)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((entry) => entry.option)
}

export function applyComposerMentionOption(
  text: string,
  query: ComposerMentionQuery,
  option: ComposerMentionOption,
): { text: string; caret: number } {
  const before = text.slice(0, query.start)
  const after = text.slice(query.end)
  const syntax = composerMentionSyntax(option.kind)
  const replacement = `@${syntax}(${JSON.stringify(option.id)})`
  const trailingSpace = /^\s/.test(after) ? "" : " "
  const inserted = `${replacement}${trailingSpace}`
  return {
    text: `${before}${inserted}${after}`,
    caret: before.length + inserted.length,
  }
}

export function setComposerMentionDirectiveSelected(
  text: string,
  kind: ComposerMentionKind,
  id: string,
  selected: boolean,
): string {
  const value = id.trim()
  if (!value) throw new Error("Composer mention directive ID must be non-empty")
  const matching = composerMentionDirectiveRanges(text).filter(
    (directive) => directive.kind === kind && directive.value === value,
  )
  if (selected) {
    if (matching.length > 0) return text
    const directive = `@${composerMentionSyntax(kind)}(${JSON.stringify(value)})`
    return text ? `${directive} ${text}` : `${directive} `
  }
  let next = text
  for (const directive of [...matching].reverse()) {
    let start = directive.start
    let end = directive.end
    if (next[end] === " ") end += 1
    else if (start > 0 && next[start - 1] === " ") start -= 1
    next = `${next.slice(0, start)}${next.slice(end)}`
  }
  return next
}

export function composerMentionDirectiveRanges(text: string): ComposerMentionDirectiveRange[] {
  return visibleMentionDirectiveRanges(text)
}

export function composerMentionPresentationSegments(text: string): ComposerMentionPresentationSegment[] {
  const ranges = composerMentionDirectiveRanges(text)
  if (ranges.length === 0) return text ? [{ text }] : []

  const segments: ComposerMentionPresentationSegment[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start) })
    segments.push({ text: text.slice(range.start, range.end), kind: range.kind })
    cursor = range.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) })
  return segments
}

export function composerMentionAtomicCaret(
  text: string,
  caret: number,
  direction: "nearest" | "left" | "right",
): number {
  const boundedCaret = Math.max(0, Math.min(caret, text.length))
  const range = composerMentionDirectiveRanges(text).find(
    (candidate) => candidate.start < boundedCaret && boundedCaret < candidate.end,
  )
  if (!range) return boundedCaret
  if (direction === "left") return range.start
  if (direction === "right") return range.end
  return boundedCaret - range.start <= range.end - boundedCaret ? range.start : range.end
}

export function composerMentionAtomicNavigation(
  text: string,
  caret: number,
  direction: "left" | "right",
): number | null {
  const range = composerMentionDirectiveRanges(text).find((candidate) =>
    direction === "left"
      ? candidate.start < caret && caret <= candidate.end
      : candidate.start <= caret && caret < candidate.end,
  )
  return range ? (direction === "left" ? range.start : range.end) : null
}

export function composerMentionAtomicSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): ComposerMentionAtomicSelection {
  const start = Math.max(0, Math.min(selectionStart, selectionEnd, text.length))
  const end = Math.max(start, Math.min(Math.max(selectionStart, selectionEnd), text.length))
  if (start === end) return { start, end }
  const intersecting = composerMentionDirectiveRanges(text).filter((range) => range.start < end && range.end > start)
  if (intersecting.length === 0) return { start, end }
  return {
    start: Math.min(start, ...intersecting.map((range) => range.start)),
    end: Math.max(end, ...intersecting.map((range) => range.end)),
  }
}

export function composerMentionAtomicEdit(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  key: "Backspace" | "Delete",
): ComposerMentionAtomicEdit | null {
  const selection = composerMentionAtomicSelection(text, selectionStart, selectionEnd)
  const { start, end } = selection
  const ranges = composerMentionDirectiveRanges(text)

  if (start !== end) {
    const selectionIntersectsRange = ranges.some((range) => range.start < end && range.end > start)
    if (!selectionIntersectsRange) return null
    return { text: `${text.slice(0, start)}${text.slice(end)}`, caret: start }
  }

  if (key === "Backspace") {
    const rangeBeforeInsertedSpace = ranges.find(
      (candidate) => candidate.end + 1 === start && text[candidate.end] === " ",
    )
    if (rangeBeforeInsertedSpace) {
      return {
        text: `${text.slice(0, rangeBeforeInsertedSpace.start)}${text.slice(start)}`,
        caret: rangeBeforeInsertedSpace.start,
      }
    }
  }

  const range = ranges.find((candidate) =>
    key === "Backspace"
      ? candidate.start < start && start <= candidate.end
      : candidate.start <= start && start < candidate.end,
  )
  if (!range) return null
  const deletionEnd = text[range.end] === " " ? range.end + 1 : range.end
  return { text: `${text.slice(0, range.start)}${text.slice(deletionEnd)}`, caret: range.start }
}

export function resolveComposerMentionDirectives(
  text: string,
  catalog: Pick<ComposerMentionCatalog, "skills" | "missionSkills" | "squads">,
): ComposerMentionDirectives {
  const directiveRanges = composerMentionDirectiveRanges(text)
  const parsedStarts = new Set(directiveRanges.map((directive) => directive.start))
  for (const match of text.matchAll(/@(skill|mission|squad)\(/g)) {
    const start = match.index ?? -1
    if (start < 0 || !mentionBoundaryAllows(text, start) || parsedStarts.has(start)) continue
    throw new ComposerMentionDirectiveError(
      "malformed_reference",
      `@${match[1]} reference must use paired ASCII or typographic double quotes`,
    )
  }
  const skillNames = new Set(catalog.skills.map((skill) => skill.id))
  const missionSkillNames = new Set(catalog.missionSkills.map((skill) => skill.id))
  const squadIDs = new Set(catalog.squads.map((squad) => squad.id))
  const selectedSkills: string[] = []
  const selectedSkillSet = new Set<string>()
  const selectedMissionSkills: string[] = []
  const selectedMissionSkillSet = new Set<string>()
  const selectedSquads: string[] = []
  const selectedSquadSet = new Set<string>()

  for (const directive of directiveRanges) {
    if (directive.kind === "skill") {
      if (!skillNames.has(directive.value)) {
        throw new ComposerMentionDirectiveError("unknown_skill", directive.value)
      }
      if (!selectedSkillSet.has(directive.value)) {
        selectedSkillSet.add(directive.value)
        selectedSkills.push(directive.value)
      }
      continue
    }
    if (directive.kind === "mission-skill") {
      if (!missionSkillNames.has(directive.value)) {
        throw new ComposerMentionDirectiveError("unknown_mission_skill", directive.value)
      }
      if (!selectedMissionSkillSet.has(directive.value)) {
        selectedMissionSkillSet.add(directive.value)
        selectedMissionSkills.push(directive.value)
      }
      continue
    }
    if (!squadIDs.has(directive.value)) {
      throw new ComposerMentionDirectiveError("unknown_squad", directive.value)
    }
    if (!selectedSquadSet.has(directive.value)) {
      selectedSquadSet.add(directive.value)
      selectedSquads.push(directive.value)
    }
  }

  return {
    skillNames: selectedSkills,
    missionSkillNames: selectedMissionSkills,
    squadIDs: selectedSquads,
  }
}
