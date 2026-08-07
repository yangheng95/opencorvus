import { SCREENSHOT_BROWSER_THUMBNAIL_VARIANT } from "@opencorvus-ai/transport-protocol"
import { normalizeAgentRole, type AgentRole } from "./message"
import { isBoundaryMessagePart } from "./message-part"
import type { CardNode } from "../store/card-tree"

export const SCREENSHOT_BROWSER_ITEM_LIMIT = 120

export interface ScreenshotBrowserItem {
  id: string
  role: AgentRole
  ownerKey: string
  ownerID: string
  ownerRole: AgentRole
  ownerSessionID: string
  ownerMessageID: string
  ownerTime: number
  ownerLabel: string
  src: string
  thumbnailSrc: string
  alt: string
  title: string
  detail: string
  time: number
  messageID: string
  partID: string
  source: "file" | "tool-browser-evidence" | "tool-attachment"
}

export { SCREENSHOT_BROWSER_THUMBNAIL_VARIANT }

export interface ScreenshotBrowserGroup {
  key: string
  ownerID: string
  role: AgentRole
  sessionID: string
  messageID: string
  time: number
  label: string
  items: ScreenshotBrowserItem[]
}

interface ScreenshotBrowserOwnerSeed {
  ownerID: string
  role: AgentRole
  sessionID: string
  messageID: string
  time: number
  ownerLabel: string
}

interface ScreenshotBrowserOwner extends ScreenshotBrowserOwnerSeed {
  key: string
}

interface ScreenshotBrowserCollector {
  seen: Set<string>
  items: ScreenshotBrowserItem[]
}

export type ScreenshotBrowserRow =
  | {
      kind: "group"
      key: string
      ownerID: string
      role: AgentRole
      groupKey: string
      sessionID: string
      messageID: string
      time: number
      label: string
      count: number
    }
  | {
      kind: "items"
      key: string
      ownerID: string
      role: AgentRole
      groupKey: string
      sessionID: string
      messageID: string
      time: number
      items: ScreenshotBrowserItem[]
    }

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function firstPositiveNumber(...values: unknown[]): number {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

function messageTime(message: any): number {
  const time = message?.info?.time
  return firstPositiveNumber(time?.completed, time?.updated, time?.created)
}

function messageRole(message: any): AgentRole {
  if (firstString(message?.info?.role) === "user") return "user"
  return normalizeAgentRole(
    firstString(message?.info?.channel, message?.info?.resolvedRole, message?.info?.agent, message?.info?.role),
  )
}

function ownerKey(input: {
  ownerID: string
  role: AgentRole
  sessionID: string
  messageID: string
  time: number
}): string {
  const segments: string[] = [input.role === "user" ? "user" : `agent:${input.ownerID}`]
  if (input.sessionID) {
    segments.push(`session:${input.sessionID}`)
    return segments.join(":")
  }
  if (input.messageID) {
    segments.push(`message:${input.messageID}`)
    return segments.join(":")
  }
  if (input.time > 0) {
    segments.push(`time:${input.time}`)
    return segments.join(":")
  }
  throw new Error("Screenshot browser owner requires a session id, message id, or timestamp")
}

function createOwner(input: {
  ownerID: string
  role: AgentRole
  sessionID?: string
  messageID?: string
  time?: number
  ownerLabel?: string
}): ScreenshotBrowserOwner {
  const role = input.role
  const ownerID = input.ownerID.trim()
  if (!ownerID) throw new Error("Screenshot browser owner requires ownerID")
  const sessionID = firstString(input.sessionID)
  const messageID = firstString(input.messageID)
  const time = firstPositiveNumber(input.time)
  const ownerLabel = firstString(input.ownerLabel)
  return {
    key: ownerKey({ ownerID, role, sessionID, messageID, time }),
    ownerID,
    role,
    sessionID,
    messageID,
    time,
    ownerLabel,
  }
}

function messageOwnerSeed(message: any): ScreenshotBrowserOwnerSeed {
  const role = messageRole(message)
  const author = firstString(message?.info?.author)
  if (!author) throw new Error("Screenshot browser message owner requires info.author")
  const ownerID = role === "user" ? author : firstString(message?.info?.agentID)
  if (!ownerID) throw new Error("Screenshot browser agent message owner requires info.agentID")
  if (role !== "user" && author !== ownerID) {
    throw new Error(`Screenshot browser agent message author ${author} does not match agentID ${ownerID}`)
  }
  return {
    ownerID,
    role,
    sessionID: firstString(message?.info?.sessionID),
    messageID: firstString(message?.info?.id),
    time: messageTime(message),
    ownerLabel: "",
  }
}

function partEventTime(part: any): number {
  const stateTime = part?.state?.time
  const partTime = part?.time
  return firstPositiveNumber(stateTime?.end, stateTime?.compacted, stateTime?.start, partTime?.end, partTime?.created)
}

function ownerFields(owner: ScreenshotBrowserOwner) {
  return {
    ownerID: owner.ownerID,
    role: owner.role,
    ownerKey: owner.key,
    ownerRole: owner.role,
    ownerSessionID: owner.sessionID,
    ownerMessageID: owner.messageID,
    ownerTime: owner.time,
    ownerLabel: owner.ownerLabel,
  }
}

export function isStoredAttachmentUrl(url: string): boolean {
  return /^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/i.test(url)
}

export function screenshotBrowserThumbnailUrl(url: string): string {
  if (!isStoredAttachmentUrl(url)) {
    throw new Error(`Screenshot thumbnail source must be a stored attachment URL: ${url}`)
  }
  return `${url}?variant=${SCREENSHOT_BROWSER_THUMBNAIL_VARIANT}`
}

export function isScreenshotBrowserThumbnailUrl(url: string): boolean {
  const [attachmentUrl, query = ""] = url.split("?", 2)
  const params = new URLSearchParams(query)
  return (
    isStoredAttachmentUrl(attachmentUrl) &&
    params.get("variant") === SCREENSHOT_BROWSER_THUMBNAIL_VARIANT &&
    Array.from(params.keys()).length === 1
  )
}

function isStoredImageReference(input: { url?: unknown; mime?: unknown; mediaType?: unknown }): boolean {
  const mime = firstString(input.mime, input.mediaType).toLowerCase()
  const url = firstString(input.url)
  if (!isStoredAttachmentUrl(url)) return false
  if (mime.startsWith("image/")) return true
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)(\?|$)/i.test(url)
}

export function screenshotBrowserItemKey(item: ScreenshotBrowserItem): string {
  return `${item.ownerKey}:${item.src}:${item.messageID}:${item.partID}:${item.source}`
}

function insertBoundedNewestFirst(items: ScreenshotBrowserItem[], item: ScreenshotBrowserItem): void {
  const insertAt = items.findIndex((current) => item.time > current.time)
  if (insertAt === -1) {
    if (items.length < SCREENSHOT_BROWSER_ITEM_LIMIT) items.push(item)
    return
  }
  items.splice(insertAt, 0, item)
  if (items.length > SCREENSHOT_BROWSER_ITEM_LIMIT) items.length = SCREENSHOT_BROWSER_ITEM_LIMIT
}

function pushUnique(collector: ScreenshotBrowserCollector, item: ScreenshotBrowserItem): void {
  if (!item.src) return
  const key = screenshotBrowserItemKey(item)
  if (collector.seen.has(key)) return
  collector.seen.add(key)
  insertBoundedNewestFirst(collector.items, item)
}

function sourceMessageID(message: any, part: any): string {
  return firstString(part?.messageID, message.info?.id)
}

function boundaryOwnersByMessage(
  parts: readonly any[],
  baseOwner: ScreenshotBrowserOwnerSeed,
): Map<string, ScreenshotBrowserOwner> {
  const owners = new Map<string, ScreenshotBrowserOwner>()
  for (const part of parts) {
    if (!isRecord(part) || !isBoundaryMessagePart(part)) continue
    const messageID = firstString(part.messageID)
    if (!messageID) continue
    owners.set(
      messageID,
      createOwner({
        ownerID: baseOwner.ownerID,
        role: normalizeAgentRole(firstString(part.role, baseOwner.role)),
        sessionID: firstString(part.sessionID, baseOwner.sessionID),
        messageID,
        time: firstPositiveNumber(part.time, baseOwner.time),
        ownerLabel: firstString(part.ownerLabel, baseOwner.ownerLabel),
      }),
    )
  }
  return owners
}

function ownerForPart(input: {
  message: any
  part: any
  baseOwner: ScreenshotBrowserOwnerSeed
  boundaries: ReadonlyMap<string, ScreenshotBrowserOwner>
}): ScreenshotBrowserOwner {
  const messageID = sourceMessageID(input.message, input.part)
  const boundary = messageID ? input.boundaries.get(messageID) : undefined
  return createOwner({
    ownerID: boundary?.ownerID ?? input.baseOwner.ownerID,
    role: boundary?.role ?? input.baseOwner.role,
    sessionID: firstString(input.part?.sessionID, boundary?.sessionID, input.baseOwner.sessionID),
    messageID: firstString(messageID, boundary?.messageID, input.baseOwner.messageID),
    time: firstPositiveNumber(boundary?.time, input.baseOwner.time),
    ownerLabel: firstString(input.part?.ownerLabel, boundary?.ownerLabel, input.baseOwner.ownerLabel),
  })
}

function browserEvidenceContext(part: any): { browser: Record<string, any> | undefined; src: string } {
  const metadata = isRecord(part?.state?.metadata) ? part.state.metadata : {}
  const browser = isRecord(metadata.browser) ? metadata.browser : undefined
  const screenshot = isRecord(browser?.screenshot) ? browser.screenshot : undefined
  return { browser, src: firstString(screenshot?.attachmentUrl) }
}

function toolAttachments(part: any): any[] {
  return Array.isArray(part?.state?.attachments)
    ? part.state.attachments
    : Array.isArray(part?.attachments)
      ? part.attachments
      : []
}

function hasToolScreenshotCandidate(part: any): boolean {
  const context = browserEvidenceContext(part)
  if (isStoredAttachmentUrl(context.src)) return true
  return toolAttachments(part).some((attachment) => isStoredImageReference(attachment))
}

function browserEvidenceItem(input: {
  message: any
  part: any
  owner: ScreenshotBrowserOwner
  index: number
}): ScreenshotBrowserItem | undefined {
  const { browser, src } = browserEvidenceContext(input.part)
  if (!isStoredAttachmentUrl(src)) return undefined
  const title = firstString(browser?.title, browser?.url, input.part?.tool, "Browser screenshot")
  const messageID = sourceMessageID(input.message, input.part)
  const partID = firstString(input.part?.id) || String(input.index)
  const viewport = isRecord(browser?.viewport) ? browser.viewport : {}
  const viewportText =
    typeof viewport.width === "number" && typeof viewport.height === "number"
      ? `${viewport.width}x${viewport.height}`
      : ""
  return {
    id: `tool-browser:${messageID}:${partID}`,
    ...ownerFields(input.owner),
    src,
    thumbnailSrc: screenshotBrowserThumbnailUrl(src),
    alt: title,
    title,
    detail: [firstString(browser?.url), viewportText].filter(Boolean).join(" · "),
    time: firstPositiveNumber(partEventTime(input.part), input.owner.time),
    messageID,
    partID,
    source: "tool-browser-evidence",
  }
}

function fileItem(input: {
  message: any
  part: any
  owner: ScreenshotBrowserOwner
  index: number
}): ScreenshotBrowserItem | undefined {
  if (!isStoredImageReference(input.part)) return undefined
  const src = firstString(input.part?.url)
  if (!src) return undefined
  const title = firstString(input.part?.filename, input.part?.name, src)
  const messageID = sourceMessageID(input.message, input.part)
  const partID = firstString(input.part?.id) || String(input.index)
  return {
    id: `file:${messageID}:${partID}`,
    ...ownerFields(input.owner),
    src,
    thumbnailSrc: screenshotBrowserThumbnailUrl(src),
    alt: title,
    title,
    detail: firstString(input.part?.mime, input.part?.mediaType),
    time: firstPositiveNumber(partEventTime(input.part), input.owner.time),
    messageID,
    partID,
    source: "file",
  }
}

function toolAttachmentItems(input: {
  message: any
  part: any
  owner: ScreenshotBrowserOwner
  index: number
  excludedUrls?: ReadonlySet<string>
}): ScreenshotBrowserItem[] {
  const attachments = toolAttachments(input.part)
  const messageID = sourceMessageID(input.message, input.part)
  const partID = firstString(input.part?.id) || String(input.index)
  return attachments
    .filter((attachment: any) => {
      const src = firstString(attachment?.url)
      return !input.excludedUrls?.has(src) && isStoredImageReference(attachment)
    })
    .map((attachment: any, attachmentIndex: number) => {
      const src = firstString(attachment?.url)
      const title = firstString(attachment?.filename, attachment?.name, input.part?.tool, src)
      return {
        id: `tool-attachment:${messageID}:${partID}:${attachmentIndex}`,
        ...ownerFields(input.owner),
        src,
        thumbnailSrc: screenshotBrowserThumbnailUrl(src),
        alt: title,
        title,
        detail: firstString(attachment?.mime, attachment?.mediaType, input.part?.tool),
        time: firstPositiveNumber(partEventTime(input.part), input.owner.time),
        messageID,
        partID,
        source: "tool-attachment" as const,
      }
    })
    .filter((item) => !!item.src)
}

function createScreenshotBrowserCollector(): ScreenshotBrowserCollector {
  return { seen: new Set<string>(), items: [] }
}

export function mergeScreenshotBrowserItemSets(
  itemSets: Iterable<readonly ScreenshotBrowserItem[]>,
): ScreenshotBrowserItem[] {
  const collector = createScreenshotBrowserCollector()
  for (const items of itemSets) {
    for (const item of items) pushUnique(collector, item)
  }
  return collector.items
}

function collectScreenshotBrowserMessage(collector: ScreenshotBrowserCollector, message: any): void {
  const parts = Array.isArray(message?.parts) ? message.parts : []
  const hasScreenshotCandidate = parts.some(
    (part) =>
      isRecord(part) &&
      ((part.type === "file" && isStoredImageReference(part)) ||
        (part.type === "tool" && hasToolScreenshotCandidate(part))),
  )
  if (!hasScreenshotCandidate) return
  const baseOwner = messageOwnerSeed(message)
  const boundaries = boundaryOwnersByMessage(parts, baseOwner)
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    if (!isRecord(part)) continue
    if (isBoundaryMessagePart(part)) continue
    if (part.type === "file") {
      if (!isStoredImageReference(part)) continue
      const owner = ownerForPart({ message, part, baseOwner, boundaries })
      const item = fileItem({ message, part, owner, index })
      if (item) pushUnique(collector, item)
      continue
    }
    if (part.type === "tool") {
      if (!hasToolScreenshotCandidate(part)) continue
      const owner = ownerForPart({ message, part, baseOwner, boundaries })
      const browser = browserEvidenceItem({ message, part, owner, index })
      if (browser) pushUnique(collector, browser)
      const excludedUrls = browser ? new Set([browser.src]) : undefined
      for (const attachment of toolAttachmentItems({ message, part, owner, index, excludedUrls })) {
        pushUnique(collector, attachment)
      }
    }
  }
}

export function collectScreenshotBrowserItems(messages: readonly any[]): ScreenshotBrowserItem[] {
  const collector = createScreenshotBrowserCollector()
  for (const message of messages) collectScreenshotBrowserMessage(collector, message)
  return collector.items
}

function cardMessage(card: CardNode): any {
  const role = firstString(card.stage, card.role)
  const normalizedRole = normalizeAgentRole(role)
  const author = normalizedRole === "user" ? "user" : firstString(card.agentID)
  const time = Number(card.time)
  const completed = Number(card.timeCompleted)
  return {
    info: {
      id: firstString(card.messageID, card.id),
      sessionID: firstString(card.sessionID),
      role: normalizedRole === "user" ? "user" : "assistant",
      ...(author ? { author } : {}),
      ...(author ? { agentID: author } : {}),
      resolvedRole: author,
      channel: role,
      agent: firstString(card.stage, role),
      time: {
        created: Number.isFinite(time) && time > 0 ? time : 0,
        completed: Number.isFinite(completed) && completed > 0 ? completed : undefined,
      },
    },
    parts: Array.isArray(card.parts) ? card.parts : [],
  }
}

export function collectScreenshotBrowserItemsFromCard(card: CardNode): ScreenshotBrowserItem[] {
  return collectScreenshotBrowserItems([cardMessage(card)])
}

export function collectScreenshotBrowserItemsFromCardTree(
  order: readonly string[],
  cards: Readonly<Record<string, CardNode | undefined>>,
): ScreenshotBrowserItem[] {
  const collector = createScreenshotBrowserCollector()
  const visited = new Set<string>()
  for (const id of order) {
    if (visited.has(id)) continue
    visited.add(id)
    const card = cards[id]
    if (!card) throw new Error(`screenshot browser card tree order references missing card ${id}`)
    const cached = card.subtreeScreenshotItems
    if (!Array.isArray(cached)) {
      throw new Error(`screenshot browser card ${id} is missing subtreeScreenshotItems cache`)
    }
    for (const item of cached) pushUnique(collector, item)
  }
  return collector.items
}

export function groupScreenshotBrowserItems(items: readonly ScreenshotBrowserItem[]): ScreenshotBrowserGroup[] {
  const groups = new Map<string, ScreenshotBrowserGroup>()
  for (const item of items) {
    let group = groups.get(item.ownerKey)
    if (!group) {
      group = {
        key: item.ownerKey,
        ownerID: item.ownerID,
        role: item.ownerRole,
        sessionID: item.ownerSessionID,
        messageID: item.ownerMessageID,
        time: item.ownerTime,
        label: item.ownerLabel,
        items: [],
      }
      groups.set(item.ownerKey, group)
    }
    group.items.push(item)
    const itemTime = firstPositiveNumber(item.time, item.ownerTime)
    if (itemTime > group.time) group.time = itemTime
    if (!group.label && item.ownerLabel) group.label = item.ownerLabel
  }
  return [...groups.values()]
}

export function buildScreenshotBrowserRows(
  groups: readonly ScreenshotBrowserGroup[],
  columnCount: number,
): ScreenshotBrowserRow[] {
  const columns = Number.isFinite(columnCount) ? Math.max(1, Math.floor(columnCount)) : 1
  const rows: ScreenshotBrowserRow[] = []
  for (const group of groups) {
    rows.push({
      kind: "group",
      key: `group:${group.key}`,
      ownerID: group.ownerID,
      role: group.role,
      groupKey: group.key,
      sessionID: group.sessionID,
      messageID: group.messageID,
      time: group.time,
      label: group.label,
      count: group.items.length,
    })
    for (let index = 0; index < group.items.length; index += columns) {
      rows.push({
        kind: "items",
        key: `items:${group.key}:${index}`,
        ownerID: group.ownerID,
        role: group.role,
        groupKey: group.key,
        sessionID: group.sessionID,
        messageID: group.messageID,
        time: group.time,
        items: group.items.slice(index, index + columns),
      })
    }
  }
  return rows
}
