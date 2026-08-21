import crypto from "node:crypto"
import { asSchema, type Tool as AITool } from "ai"
import { Token } from "@/util/token"

/**
 * Host-side fingerprint of one outgoing Provider request's prompt composition.
 *
 * Written for one question: when a request only partially hits the Provider's
 * prefix cache, *where does the prefix stop*. A twenty-run benchmark batch spent
 * 76% of its uncached input on one Agent whose cache read never grew with its
 * conversation, and nothing in the runtime could say which composed block moved.
 * `context-diagnostics` reported totals — system chars, tool-schema chars,
 * message payload — which cannot distinguish "the prompt got bigger" from "an
 * early block changed and invalidated everything after it".
 *
 * Sizes and digests only, never bodies. AgentTrace deliberately keeps prompt
 * projection ephemeral and reconstructible from durable message facts, and a
 * fingerprint that carried text would put a second copy of every prompt into
 * sealed evidence and widen the credential surface. A digest answers "did this
 * block change" without answering "what did it say".
 *
 * What this does NOT claim: that the first divergent Host block *is* the
 * Provider's cache boundary. Providers cache their own serialisation, and a
 * cache read is a property of one common prefix, not a sum of per-block hits.
 * The fingerprint gives a Host-side hypothesis; the Provider's reported
 * `cache_read` is the measurement that confirms or refutes it.
 */
export type PromptBlockFingerprint = {
  /** Composition family, in the order the Host assembles the request. */
  kind: "tools" | "system" | "message"
  /** Position within the family. */
  index: number
  /** Stable human label: `system[2]`, `message[7]:tool`, `tools`. */
  label: string
  chars: number
  tokensEst: number
  /** Truncated; see `digest`. */
  sha256: string
}

export type PromptCompositionFingerprint = {
  blocks: PromptBlockFingerprint[]
  systemBlocks: number
  messageBlocks: number
  toolCount: number
  toolNames: string[]
  totalChars: number
  totalTokensEst: number
  /** Exact final system text after composition and system transforms. It is a
   * digest/size receipt, not a second logical block and is never double-counted
   * in the token estimates above. */
  physicalSystem?: {
    chars: number
    tokensEst: number
    sha256: string
  }
  /** Digest over every block digest in order — one value that changes if any
   *  block changed or the block order changed. */
  compositionSha256: string
}

export type PromptCompositionDivergence = {
  /** `false` when there is no previous request for this session yet. */
  comparable: boolean
  /** Label of the first block that differs, or null when nothing before the
   *  new tail changed. */
  firstDivergentLabel: string | null
  /** Index into `blocks`, or the length of the shorter composition when one is
   *  simply a prefix of the other. */
  firstDivergentIndex: number
  /** Blocks that matched, and their cumulative size. This is the Host-side
   *  candidate for what the Provider could have served from cache. */
  stablePrefixBlocks: number
  stablePrefixChars: number
  stablePrefixTokensEst: number
  /** Everything from the divergence onward. */
  divergentChars: number
  divergentTokensEst: number
  /** True when only trailing blocks were appended — the shape a healthy
   *  growing conversation has. */
  appendOnly: boolean
}

/**
 * 16 hex characters, not 64.
 *
 * The digest answers one yes/no question — did this block change since the last
 * request — over at most a few hundred blocks per Session. 64 bits is far past
 * sufficient for that, and the full digest would roughly double the size of an
 * evidence stream that already carries one entry per block per Provider call.
 */
function digest(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16)
}

/**
 * Serialise one model message for digest purposes only.
 *
 * Key order is whatever the composing code produced. That is acceptable here
 * because both sides of every comparison come from the same composer in the
 * same process; a spurious digest difference would show up as a divergence at a
 * block whose size did not change, which is itself readable in the evidence.
 */
function messageText(message: unknown): string {
  try {
    return JSON.stringify(message) ?? ""
  } catch {
    return ""
  }
}

function messageRole(message: unknown): string {
  const role = (message as { role?: unknown } | undefined)?.role
  return typeof role === "string" ? role : "unknown"
}

export function fingerprintPromptComposition(input: {
  system: readonly string[]
  systemLabels?: readonly string[]
  physicalSystemText?: string
  messages: readonly unknown[]
  /** Already-normalised tool payload text, one entry per Tool, in request
   *  order. The caller owns schema normalisation; this module never re-runs it. */
  toolPayloads: ReadonlyArray<{ name: string; text: string }>
}): PromptCompositionFingerprint {
  if (input.systemLabels && input.systemLabels.length !== input.system.length) {
    throw new Error(
      `Prompt system label count ${input.systemLabels.length} does not match part count ${input.system.length}`,
    )
  }
  const blocks: PromptBlockFingerprint[] = []
  const push = (kind: PromptBlockFingerprint["kind"], index: number, label: string, text: string) => {
    blocks.push({ kind, index, label, chars: text.length, tokensEst: Token.estimate(text), sha256: digest(text) })
  }

  // Tools lead, then system, then messages.
  //
  // Tool definitions are one block: they are composed together and change
  // together. They come first because that is where a change to them costs —
  // Anthropic documents its cache hierarchy as tools, then system, then
  // messages, and on OpenAI a changed tool table likewise invalidates the
  // request's cached prefix. Ordering them last would additionally make
  // ordinary append-only growth read as a divergence, because every appended
  // message would shift the Tool block's position.
  const toolText = input.toolPayloads.map((item) => [item.name, item.text].join("\n")).join("\n")
  push("tools", 0, "tools", toolText)
  input.system.forEach((text, index) =>
    push("system", index, input.systemLabels?.[index] ?? `system[${index}]`, text ?? ""),
  )
  input.messages.forEach((message, index) =>
    push("message", index, `message[${index}]:${messageRole(message)}`, messageText(message)),
  )

  const physicalSystem =
    input.physicalSystemText === undefined
      ? undefined
      : {
          chars: input.physicalSystemText.length,
          tokensEst: Token.estimate(input.physicalSystemText),
          sha256: digest(input.physicalSystemText),
        }
  return {
    blocks,
    systemBlocks: input.system.length,
    messageBlocks: input.messages.length,
    toolCount: input.toolPayloads.length,
    toolNames: input.toolPayloads.map((item) => item.name),
    totalChars: blocks.reduce((sum, block) => sum + block.chars, 0),
    totalTokensEst: blocks.reduce((sum, block) => sum + block.tokensEst, 0),
    ...(physicalSystem ? { physicalSystem } : {}),
    compositionSha256: digest(
      [physicalSystem?.sha256 ?? "", ...blocks.map((block) => [block.label, block.sha256].join(" "))].join("|"),
    ),
  }
}

export function comparePromptComposition(
  previous: PromptCompositionFingerprint | undefined,
  current: PromptCompositionFingerprint,
): PromptCompositionDivergence {
  const totals = (from: number) => {
    let chars = 0
    let tokensEst = 0
    for (let index = from; index < current.blocks.length; index += 1) {
      chars += current.blocks[index]!.chars
      tokensEst += current.blocks[index]!.tokensEst
    }
    return { chars, tokensEst }
  }
  if (!previous) {
    const all = totals(0)
    return {
      comparable: false,
      firstDivergentLabel: current.blocks[0]?.label ?? null,
      firstDivergentIndex: 0,
      stablePrefixBlocks: 0,
      stablePrefixChars: 0,
      stablePrefixTokensEst: 0,
      divergentChars: all.chars,
      divergentTokensEst: all.tokensEst,
      appendOnly: false,
    }
  }
  const limit = Math.min(previous.blocks.length, current.blocks.length)
  let matched = 0
  let stableChars = 0
  let stableTokensEst = 0
  while (matched < limit) {
    const left = previous.blocks[matched]!
    const right = current.blocks[matched]!
    if (left.label !== right.label || left.sha256 !== right.sha256) break
    stableChars += right.chars
    stableTokensEst += right.tokensEst
    matched += 1
  }
  const rest = totals(matched)
  const identicalPrefix = matched === previous.blocks.length
  return {
    comparable: true,
    firstDivergentLabel: matched < current.blocks.length ? current.blocks[matched]!.label : null,
    firstDivergentIndex: matched,
    stablePrefixBlocks: matched,
    stablePrefixChars: stableChars,
    stablePrefixTokensEst: stableTokensEst,
    divergentChars: rest.chars,
    divergentTokensEst: rest.tokensEst,
    // A conversation that only appended keeps every earlier block byte-identical.
    // Anything else means an already-sent block was rewritten, which is the
    // condition that costs the whole tail its cache.
    appendOnly: identicalPrefix && current.blocks.length >= previous.blocks.length,
  }
}

/**
 * Per-Tool payload text in request order.
 *
 * Mirrors `SessionLoop.estimateToolPayload`: name plus description plus the
 * normalised JSON Schema, which is what the Provider actually receives.
 * Stringifying the raw `inputSchema` wrapper instead would walk a Zod object's
 * internal `_def` graph and produce sizes unrelated to the outgoing request.
 * The schema is only unwrapped here, never re-normalised.
 */
export function toolPayloadTexts(tools: Record<string, AITool>): Array<{ name: string; text: string }> {
  return Object.entries(tools).map(([name, item]) => {
    const description =
      typeof (item as { description?: unknown }).description === "string"
        ? (item as { description: string }).description
        : ""
    let schemaText = ""
    const inputSchema = (item as { inputSchema?: unknown }).inputSchema
    if (inputSchema !== undefined && inputSchema !== null) {
      try {
        schemaText = JSON.stringify(asSchema(inputSchema as never).jsonSchema ?? {})
      } catch {
        schemaText = ""
      }
    }
    return { name, text: [description, schemaText].join("") }
  })
}
