import {
  CompiledWebpageStructureSchema,
  type CompiledWebpageBounds,
  type CompiledWebpageLayout,
  type CompiledWebpageNode,
  type CompiledWebpageStructure,
} from "@opencorvus-ai/plugin"

export interface CompiledWebpageExtractedLayoutElement {
  selector?: string
  tag: string
  role?: string
  bounds?: CompiledWebpageBounds
  styles?: Record<string, string | undefined>
  text?: string
  imageSrc?: string
  imageAlt?: string
  href?: string
  aria?: Record<string, string>
  attrs?: Record<string, string>
  classes?: string[]
  children?: CompiledWebpageExtractedLayoutElement[]
}

export interface CompiledWebpageExtractedLayout {
  tree?: CompiledWebpageExtractedLayoutElement[]
}

interface CloneElementCandidate {
  node: CompiledWebpageNode
  order: number
  attrs: Map<string, string>
  classTokens: Set<string>
  text: string
}

interface ExtractedLayoutCandidate {
  element: CompiledWebpageExtractedLayoutElement
  order: number
}

export function mergeExtractedLayoutIntoCompiledWebpage(
  pageIr: CompiledWebpageStructure,
  extractedPage: CompiledWebpageExtractedLayout,
): CompiledWebpageStructure {
  const next = JSON.parse(JSON.stringify(pageIr)) as CompiledWebpageStructure
  const cloneElements = flattenCloneElements(next.root)
  const extractedElements = flattenExtractedElements(extractedPage.tree ?? [])
  const unmatched = new Set(cloneElements.map((candidate) => candidate.node.id))
  let matched = 0

  for (const extracted of extractedElements) {
    const match = bestMatch(extracted, cloneElements, unmatched)
    if (!match) continue
    unmatched.delete(match.node.id)
    match.node.layout = layoutFor(extracted.element, match.confidence)
    matched++
  }

  return CompiledWebpageStructureSchema.parse({
    ...next,
    stats: {
      ...next.stats,
      layoutElements: extractedElements.length,
      layoutMatchedElements: matched,
    },
  })
}

function bestMatch(
  extracted: ExtractedLayoutCandidate,
  cloneElements: CloneElementCandidate[],
  unmatched: Set<string>,
): (CloneElementCandidate & { confidence: number }) | undefined {
  let best: (CloneElementCandidate & { score: number }) | undefined
  for (const candidate of cloneElements) {
    if (!unmatched.has(candidate.node.id)) continue
    if ((candidate.node.tag ?? "").toLowerCase() !== extracted.element.tag.toLowerCase()) continue
    const score = scoreMatch(extracted, candidate)
    if (!best || score > best.score) best = { ...candidate, score }
  }
  if (!best) return undefined
  return { ...best, confidence: Math.min(1, best.score / 16) }
}

function scoreMatch(extracted: ExtractedLayoutCandidate, candidate: CloneElementCandidate): number {
  let score = 1 / (1 + Math.abs(candidate.order - extracted.order))
  const extractedId = extracted.element.attrs?.id ?? selectorId(extracted.element.selector)
  if (extractedId && candidate.attrs.get("id") === extractedId) score += 8

  const classOverlap = overlap(
    candidate.classTokens,
    new Set(extracted.element.classes ?? selectorClasses(extracted.element.selector)),
  )
  score += classOverlap * 3

  const href = candidate.attrs.get("href")
  if (href && extracted.element.href && href === extracted.element.href) score += 4

  const src = candidate.attrs.get("src")
  if (src && extracted.element.imageSrc && src === extracted.element.imageSrc) score += 4

  const alt = candidate.attrs.get("alt")
  if (alt && extracted.element.imageAlt && alt === extracted.element.imageAlt) score += 3

  const text = normalizeText(extracted.element.text)
  if (text && candidate.text.includes(text)) score += Math.min(5, Math.max(2, text.length / 24))

  return score
}

function layoutFor(element: CompiledWebpageExtractedLayoutElement, confidence: number): CompiledWebpageLayout {
  return {
    selector: element.selector,
    role: element.role,
    bounds: element.bounds,
    styles: cleanStyles(element.styles),
    text: element.text,
    imageSrc: element.imageSrc,
    imageAlt: element.imageAlt,
    href: element.href,
    matchConfidence: Number(confidence.toFixed(3)),
  }
}

function flattenCloneElements(root: CompiledWebpageNode): CloneElementCandidate[] {
  const elements: CloneElementCandidate[] = []
  walk(root, (node) => {
    if (node.type !== "element") return
    const tag = (node.tag ?? "").toLowerCase()
    if (
      tag === "html" ||
      tag === "head" ||
      tag === "script" ||
      tag === "style" ||
      tag === "meta" ||
      tag === "link" ||
      tag === "title"
    ) {
      return
    }
    const attrs = new Map<string, string>()
    const classTokens = new Set<string>()
    for (const attr of node.attrs ?? []) {
      if (attr.value !== undefined) attrs.set(attr.name, attr.value)
      for (const token of attr.classTokens ?? []) classTokens.add(token)
    }
    elements.push({
      node,
      order: elements.length,
      attrs,
      classTokens,
      text: collectText(node),
    })
  })
  return elements
}

function flattenExtractedElements(tree: CompiledWebpageExtractedLayoutElement[]): ExtractedLayoutCandidate[] {
  const elements: ExtractedLayoutCandidate[] = []
  const visit = (element: CompiledWebpageExtractedLayoutElement) => {
    elements.push({ element, order: elements.length })
    for (const child of element.children ?? []) visit(child)
  }
  for (const element of tree) visit(element)
  return elements
}

function walk(node: CompiledWebpageNode, visit: (node: CompiledWebpageNode) => void): void {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function collectText(node: CompiledWebpageNode): string {
  const values: string[] = []
  walk(node, (child) => {
    if (child.type === "text" && child.text) values.push(child.text)
  })
  return normalizeText(values.join(" ")).slice(0, 1000)
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function selectorId(selector: string | undefined): string | undefined {
  return selector?.match(/#([A-Za-z0-9_-]+)/)?.[1]
}

function selectorClasses(selector: string | undefined): string[] {
  return Array.from(selector?.matchAll(/\.([A-Za-z0-9_-]+)/g) ?? [])
    .map((match) => match[1])
    .filter(Boolean)
}

function overlap(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const value of left) {
    if (right.has(value)) count++
  }
  return count
}

function cleanStyles(styles: Record<string, string | undefined> | undefined): Record<string, string> | undefined {
  if (!styles) return undefined
  const entries = Object.entries(styles).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
