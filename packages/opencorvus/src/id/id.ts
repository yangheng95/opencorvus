import z from "zod"
import { createHash, randomBytes, randomUUID } from "crypto"

export namespace Identifier {
  const prefixes = {
    session: "ses",
    message: "msg",
    permission: "per",
    question: "que",
    user: "usr",
    part: "prt",
    pty: "pty",
    tool: "tool",
    workspace: "wrk",
    memory: "mem",
    memchunk: "mck",
    automation: "atm",
    automation_run: "atr",
    event_job: "evt",
    task: "tsk",
    plan: "pln",
    goal: "gol",
    interaction: "int",
    artifact: "art",
    attachment: "att",
    acceptance: "dlv",
    acceptance_round: "dlr",
    evaluation: "evl",
    binding: "bnd",
    progress: "prg",
    note: "nte",
    brief: "brf",
    milestone: "mst",
    spec: "spc",
    specitem: "spi",
    goal_snapshot: "gls",
    plan_node: "pln_node",
    requirement: "req",
    call: "cal",
    protocol_event: "pev",
    protocol_inbox: "pib",
    session_control: "sctl",
    worker_turn_descriptor: "wtd",
    decision_log: "dlog",
    metric_spec: "mts",
    metric_result: "mtr",
    /** LLM provider call lifecycle (one logical request, including its
     *  internal retries / heartbeats). See packages/opencorvus/src/llm/activity.ts. */
    activity: "act",
  } as const

  export function schema(prefix: keyof typeof prefixes) {
    return z.string().startsWith(prefixes[prefix])
  }

  const LENGTH = 26

  // State for monotonic ID generation
  let lastTimestamp = 0
  let counter = 0

  export function ascending(prefix: keyof typeof prefixes, given?: string) {
    return generateID(prefix, false, given)
  }

  export function descending(prefix: keyof typeof prefixes, given?: string) {
    return generateID(prefix, true, given)
  }

  /** UUID means Universally Unique Identifier. UUID4 is random; use its first
   *  8 hexadecimal characters only where the product contract explicitly asks
   *  for short opaque ids instead of sortable prefixed ids. */
  export function uuid4First8(): string {
    return randomUUID().slice(0, 8)
  }

  function generateID(prefix: keyof typeof prefixes, descending: boolean, given?: string): string {
    if (!given) {
      return create(prefix, descending)
    }

    if (!given.startsWith(prefixes[prefix])) {
      throw new Error(`ID ${given} does not start with ${prefixes[prefix]}`)
    }
    return given
  }

  function randomBase62(length: number): string {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    let result = ""
    const bytes = randomBytes(length)
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % 62]
    }
    return result
  }

  export function create(prefix: keyof typeof prefixes, descending: boolean, timestamp?: number): string {
    const currentTimestamp = timestamp ?? Date.now()

    if (currentTimestamp !== lastTimestamp) {
      lastTimestamp = currentTimestamp
      counter = 0
    }
    counter++

    let now = BigInt(currentTimestamp) * BigInt(0x1000) + BigInt(counter)

    now = descending ? ~now : now

    const timeBytes = Buffer.alloc(6)
    for (let i = 0; i < 6; i++) {
      timeBytes[i] = Number((now >> BigInt(40 - 8 * i)) & BigInt(0xff))
    }

    return prefixes[prefix] + "_" + timeBytes.toString("hex") + randomBase62(LENGTH - 12)
  }

  export const SHORT_PATH_BODY_LENGTH = 12
  export const DIRECTORY_KEY_LENGTH = 8

  const DIRECTORY_KEY_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
  const DIRECTORY_KEY_SPACE = BigInt(DIRECTORY_KEY_ALPHABET.length) ** BigInt(DIRECTORY_KEY_LENGTH)

  /**
   * Returns prefix + '_' + the full timestamp/counter body for filesystem
   * path segments. The earlier 8-char form only kept the high timestamp
   * bytes, so goals created in one planning burst could map to the same
   * runtime directory and branch.
   */
  export function shortPath(fullID: string): string {
    const separator = fullID.lastIndexOf("_")
    if (separator <= 0) throw new Error(`Invalid ID for path segment: ${fullID}`)
    const prefix = fullID.slice(0, separator)
    const body = fullID.slice(separator + 1)
    if (!body) throw new Error(`Invalid ID body for path segment: ${fullID}`)
    return `${prefix}_${body.slice(0, SHORT_PATH_BODY_LENGTH)}`
  }

  function base62Fixed(value: bigint, length: number): string {
    const base = BigInt(DIRECTORY_KEY_ALPHABET.length)
    let remaining = value
    let output = ""
    do {
      const digit = Number(remaining % base)
      output = DIRECTORY_KEY_ALPHABET[digit] + output
      remaining /= base
    } while (remaining > 0n)
    if (output.length > length) throw new Error(`Directory key overflow: ${output}`)
    return output.padStart(length, "0")
  }

  /**
   * Returns a stable, non-readable 8-character filesystem key for a full ID.
   * This hashes the complete ID instead of truncating the timestamp prefix, so
   * same-millisecond IDs do not collapse onto the same runtime directory.
   */
  export function scopedDirectoryKey(scope: string, value: string): string {
    if (!scope.trim()) throw new Error("Directory key scope is empty")
    if (!value.trim()) throw new Error("Directory key value is empty")
    const digest = createHash("sha256").update(`${scope}:${value}`).digest()
    const valueBits = BigInt(`0x${digest.toString("hex")}`)
    return base62Fixed(valueBits % DIRECTORY_KEY_SPACE, DIRECTORY_KEY_LENGTH)
  }

  export function directoryKey(fullID: string): string {
    const separator = fullID.lastIndexOf("_")
    if (separator <= 0) throw new Error(`Invalid ID for path segment: ${fullID}`)
    const body = fullID.slice(separator + 1)
    if (!body) throw new Error(`Invalid ID body for path segment: ${fullID}`)
    return scopedDirectoryKey("id", fullID)
  }

  /** Extract timestamp from an ascending ID. Does not work with descending IDs. */
  export function timestamp(id: string): number {
    const prefix = id.split("_")[0]
    const hex = id.slice(prefix.length + 1, prefix.length + 13)
    const encoded = BigInt("0x" + hex)
    return Number(encoded / BigInt(0x1000))
  }
}
