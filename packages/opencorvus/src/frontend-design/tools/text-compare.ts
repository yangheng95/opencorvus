export interface TextCompareResult {
  jaccardSimilarity: number
  coverageRate: number
  referenceTokens: number
  renderedTokens: number
  missingTokens: string[]
  score: number
}

const CJK_RANGE =
  /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\u{2ceb0}-\u{2ebef}\u{30000}-\u{3134f}\u3000-\u303f\uff00-\uffef]/u

function splitLatinWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_.,;:!?@#$%^&*()[\]{}<>/\\|'"=+`~]+/)
    .filter((word) => word.length > 1 || /[a-z]/.test(word))
    .filter((word) => !/^\d+$/.test(word))
}

export function tokenize(text: string): string[] {
  if (!text) return []
  const tokens: string[] = []
  let latinBuffer = ""
  for (const char of text.replace(/\s+/g, " ").trim().split("")) {
    if (CJK_RANGE.test(char)) {
      if (latinBuffer.trim()) {
        tokens.push(...splitLatinWords(latinBuffer))
        latinBuffer = ""
      }
      tokens.push(char)
    } else {
      latinBuffer += char
    }
  }
  if (latinBuffer.trim()) tokens.push(...splitLatinWords(latinBuffer))
  return tokens.filter((token) => token.length > 0)
}

function multiset(tokens: string[]): Map<string, number> {
  const result = new Map<string, number>()
  for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1)
  return result
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function compareText(referenceText: string, renderedText: string): TextCompareResult {
  const referenceTokens = tokenize(referenceText)
  const renderedTokens = tokenize(renderedText)
  if (referenceTokens.length === 0 && renderedTokens.length === 0) {
    return {
      jaccardSimilarity: 1,
      coverageRate: 1,
      referenceTokens: 0,
      renderedTokens: 0,
      missingTokens: [],
      score: 100,
    }
  }
  if (referenceTokens.length === 0) {
    return {
      jaccardSimilarity: 0,
      coverageRate: 1,
      referenceTokens: 0,
      renderedTokens: renderedTokens.length,
      missingTokens: [],
      score: 100,
    }
  }

  const referenceCounts = multiset(referenceTokens)
  const renderedCounts = multiset(renderedTokens)
  let intersectionSize = 0
  for (const [token, referenceCount] of referenceCounts) {
    intersectionSize += Math.min(referenceCount, renderedCounts.get(token) ?? 0)
  }
  const allTokens = new Set([...referenceCounts.keys(), ...renderedCounts.keys()])
  let unionSize = 0
  for (const token of allTokens) {
    unionSize += Math.max(referenceCounts.get(token) ?? 0, renderedCounts.get(token) ?? 0)
  }

  const jaccardSimilarity = unionSize > 0 ? intersectionSize / unionSize : 0
  const coverageRate = intersectionSize / referenceTokens.length
  const missingTokens: string[] = []
  for (const [token, referenceCount] of referenceCounts) {
    const renderedCount = renderedCounts.get(token) ?? 0
    if (renderedCount < referenceCount) missingTokens.push(token)
  }

  return {
    jaccardSimilarity: round3(jaccardSimilarity),
    coverageRate: round3(coverageRate),
    referenceTokens: referenceTokens.length,
    renderedTokens: renderedTokens.length,
    missingTokens: missingTokens.slice(0, 20),
    score: Math.round(coverageRate * 70 + jaccardSimilarity * 30),
  }
}

interface TextNode {
  text?: string | { content?: string }
  children?: TextNode[]
}

export function extractTextFromTree(elements: TextNode[]): string {
  const parts: string[] = []
  function walk(nodes: TextNode[]) {
    for (const node of nodes) {
      if (typeof node.text === "string" && node.text) parts.push(node.text)
      else if (node.text && typeof node.text === "object" && node.text.content) parts.push(node.text.content)
      if (node.children) walk(node.children)
    }
  }
  walk(elements)
  return parts.join(" ")
}
