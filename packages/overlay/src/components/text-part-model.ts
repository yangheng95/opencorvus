import { createEffect, createSignal } from "solid-js"

export const STREAMING_ACTIVE_TEXT_LIMIT = 12_000
const STREAMING_TRUNCATION_PREFIX = "... "

interface BlockScanState {
  completed: string[]
  currentLines: string[]
  pendingLine: string
  inFence: boolean
}

function emptyBlockScanState(): BlockScanState {
  return {
    completed: [],
    currentLines: [],
    pendingLine: "",
    inFence: false,
  }
}

function currentBlockText(state: BlockScanState): string {
  if (state.pendingLine) return [...state.currentLines, state.pendingLine].join("\n")
  return state.currentLines.join("\n")
}

function processBlockLine(state: BlockScanState, line: string): void {
  if (line.trimStart().startsWith("```")) {
    state.inFence = !state.inFence
    state.currentLines.push(line)
    return
  }
  if (state.inFence) {
    state.currentLines.push(line)
    return
  }
  if (line.trim() === "") {
    const block = state.currentLines.join("\n")
    if (block.trim()) state.completed.push(block)
    state.currentLines = []
    return
  }
  state.currentLines.push(line)
}

function appendBlockText(state: BlockScanState, tail: string): BlockScanState {
  const next: BlockScanState = {
    completed: state.completed.slice(),
    currentLines: state.currentLines.slice(),
    pendingLine: state.pendingLine,
    inFence: state.inFence,
  }
  let input = next.pendingLine + tail
  next.pendingLine = ""
  let newlineIndex = input.indexOf("\n")
  while (newlineIndex >= 0) {
    processBlockLine(next, input.slice(0, newlineIndex))
    input = input.slice(newlineIndex + 1)
    newlineIndex = input.indexOf("\n")
  }
  next.pendingLine = input
  return next
}

function scanBlocks(text: string): BlockScanState {
  return appendBlockText(emptyBlockScanState(), text)
}

function blocksFromScan(state: BlockScanState): string[] {
  const active = currentBlockText(state)
  return active ? [...state.completed, active] : state.completed
}

export function visibleStreamingText(text: string, limit = STREAMING_ACTIVE_TEXT_LIMIT): string {
  const source = String(text || "")
  const n = Math.max(0, Math.floor(Number(limit) || 0))
  if (source.length <= n) return source
  return `${STREAMING_TRUNCATION_PREFIX}${source.slice(-n)}`
}

export function createStreamingTextPartModel(
  props: { text: string; streaming?: boolean },
  renderMarkdownBlock: (source: string) => string,
) {
  const [frozenHtml, setFrozenHtml] = createSignal<string[]>([])
  const [activeText, setActiveText] = createSignal("")
  const controller = new StreamingTextPartController(renderMarkdownBlock)

  createEffect(() => {
    const next = controller.update(props.text || "", props.streaming === true)
    setFrozenHtml(next.frozenHtml)
    setActiveText(next.activeText)
  })

  return { frozenHtml, activeText }
}

export class StreamingTextPartController {
  private frozenSources: string[] = []
  private lastText = ""
  private scanState = emptyBlockScanState()
  private html: string[] = []
  activeText = ""

  constructor(private readonly renderMarkdownBlock: (source: string) => string) {}

  update(text: string, streaming: boolean): { frozenHtml: string[]; activeText: string } {
    if (text.startsWith(this.lastText)) {
      this.scanState = appendBlockText(this.scanState, text.slice(this.lastText.length))
    } else {
      this.scanState = scanBlocks(text)
      this.frozenSources = []
      this.html = []
    }
    this.lastText = text

    const blocks = blocksFromScan(this.scanState)
    const total = blocks.length
    const frozenCount = streaming ? Math.max(0, total - 1) : total
    const nextFrozenSources = blocks.slice(0, frozenCount)

    const cacheStillValid =
      this.frozenSources.length <= nextFrozenSources.length &&
      this.frozenSources.every((source, index) => source === nextFrozenSources[index])
    if (!cacheStillValid) {
      this.frozenSources = nextFrozenSources
      this.html = nextFrozenSources.map((source) => this.renderMarkdownBlock(source))
    } else if (nextFrozenSources.length > this.frozenSources.length) {
      const additions = nextFrozenSources
        .slice(this.frozenSources.length)
        .map((source) => this.renderMarkdownBlock(source))
      this.frozenSources = nextFrozenSources
      this.html = [...this.html, ...additions]
    }

    this.activeText = streaming && total > 0 ? visibleStreamingText(blocks[total - 1]) : ""
    return { frozenHtml: this.html, activeText: this.activeText }
  }
}
