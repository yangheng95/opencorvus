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
    provider_usage: "pvu",
  } as const

  export type Kind = keyof typeof prefixes
  export const kinds = Object.freeze(Object.keys(prefixes) as Kind[])
  export const MAX_LENGTH = 24

  export function canonicalPattern(prefix: Kind): RegExp {
    const expected = prefixes[prefix]
    return new RegExp(`^${expected}_(?:[A-Za-z0-9]|[A-Za-z0-9-][A-Za-z0-9._-]*[A-Za-z0-9])$`)
  }

  export function isCanonical(prefix: Kind, input: string): boolean {
    return canonicalPattern(prefix).test(input)
  }

  export function schema(prefix: keyof typeof prefixes) {
    if (prefix === "task" || prefix === "session") {
      return z.string().regex(canonicalPattern(prefix), { message: `Invalid canonical ${prefix} identifier` })
    }
    return z.string().startsWith(prefixes[prefix])
  }

  const FIELD_BYTES = 6
  const FIELD_HEX_LENGTH = FIELD_BYTES * 2
  const MAX_FIELD_VALUE = (1n << BigInt(FIELD_BYTES * 8)) - 1n
  const ASCENDING_FORMAT_MARKER = "g"
  const DESCENDING_FORMAT_MARKER = "-"
  const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
  const COMPACT_TIMESTAMP_LENGTH = 8
  const COMPACT_TIMESTAMP_MAX = BigInt(BASE62_ALPHABET.length) ** BigInt(COMPACT_TIMESTAMP_LENGTH) - 1n
  const COMPACT_SEQUENCE_LENGTH = 2
  const COMPACT_SEQUENCE_SPACE = BigInt(BASE62_ALPHABET.length) ** BigInt(COMPACT_SEQUENCE_LENGTH)
  const COMPACT_SEQUENCE_MAX = COMPACT_SEQUENCE_SPACE - 1n
  const COMPACT_TASK_TIMESTAMP_LENGTH = 9
  const COMPACT_TASK_SEQUENCE_LENGTH = 2
  const COMPACT_TASK_RANDOM_LENGTH = 8
  const COMPACT_TASK_SEQUENCE_SPACE = BigInt(BASE62_ALPHABET.length) ** BigInt(COMPACT_TASK_SEQUENCE_LENGTH)
  const COMPACT_TASK_SEQUENCE_MAX = COMPACT_TASK_SEQUENCE_SPACE - 1n
  const COMPACT_TASK_BODY_LENGTH =
    1 + COMPACT_TASK_TIMESTAMP_LENGTH + COMPACT_TASK_SEQUENCE_LENGTH + COMPACT_TASK_RANDOM_LENGTH

  const ascendingStates = new Map<Kind, { timestamp: bigint; sequence: bigint }>()
  const descendingStates = new Map<Kind, { timestamp: bigint; sequence: bigint }>()
  let lastAscendingTaskTimestamp = -1n
  let ascendingTaskSequence = 0n
  let lastDescendingTaskTimestamp = -1n
  let descendingTaskSequence = 0n

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

    if (prefix === "task" || prefix === "session") {
      if (!isCanonical(prefix, given)) {
        throw new Error(`ID ${given} is not a canonical ${prefix} identifier`)
      }
      return given
    }
    if (!given.startsWith(prefixes[prefix])) {
      throw new Error(`ID ${given} does not start with ${prefixes[prefix]}`)
    }
    return given
  }

  function randomBase62(length: number): string {
    let result = ""
    const bytes = randomBytes(length)
    for (let i = 0; i < length; i++) {
      result += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length]
    }
    return result
  }

  export function create(prefix: keyof typeof prefixes, descending: boolean, timestamp?: number): string {
    const currentTimestamp = timestamp ?? Date.now()
    if (!Number.isSafeInteger(currentTimestamp) || currentTimestamp < 0) {
      throw new Error(`ID timestamp must be a non-negative safe integer: ${currentTimestamp}`)
    }
    const wallTimestamp = BigInt(currentTimestamp)
    if (wallTimestamp > MAX_FIELD_VALUE) throw new Error(`ID timestamp exceeds the 48-bit field: ${currentTimestamp}`)
    if (prefix === "task") return createCompactTaskID(descending, wallTimestamp)

    const states = descending ? descendingStates : ascendingStates
    const state = states.get(prefix) ?? { timestamp: -1n, sequence: 0n }
    if (wallTimestamp > state.timestamp) {
      state.timestamp = wallTimestamp
      state.sequence = 0n
    } else {
      state.sequence += 1n
      if (state.sequence > COMPACT_SEQUENCE_MAX) {
        state.timestamp += 1n
        state.sequence = 0n
      }
    }
    states.set(prefix, state)
    if (state.timestamp > COMPACT_TIMESTAMP_MAX) throw new Error(`ID timestamp exceeds compact field: ${state.timestamp}`)
    const logicalTimestamp = descending ? COMPACT_TIMESTAMP_MAX - state.timestamp : state.timestamp
    const sequence = descending ? COMPACT_SEQUENCE_MAX - state.sequence : state.sequence

    const fixedLength = prefixes[prefix].length + 1 + 1 + COMPACT_TIMESTAMP_LENGTH + COMPACT_SEQUENCE_LENGTH
    const randomLength = MAX_LENGTH - fixedLength
    if (randomLength < 1) throw new Error(`ID prefix ${prefixes[prefix]} cannot fit the compact identifier contract`)
    return (
      prefixes[prefix] +
      "_" +
      (descending ? DESCENDING_FORMAT_MARKER : ASCENDING_FORMAT_MARKER) +
      base62Fixed(logicalTimestamp, COMPACT_TIMESTAMP_LENGTH) +
      base62Fixed(sequence, COMPACT_SEQUENCE_LENGTH) +
      randomBase62(randomLength)
    )
  }

  /**
   * Creates a deterministic OpenCorvus identity without exposing the full
   * cryptographic digest as the identity. Full digests remain separate
   * integrity facts at their owning storage boundary.
   */
  export function deterministic(prefix: Kind, material: string | Uint8Array): string {
    const digest = createHash("sha256")
      .update(`opencorvus.identity.v1\0${prefix}\0`)
      .update(material)
      .digest()
    const bodyLength = MAX_LENGTH - prefixes[prefix].length - 1
    if (bodyLength < 1) throw new Error(`ID prefix ${prefixes[prefix]} cannot fit the compact identifier contract`)
    const encodedLength = bodyLength - 1
    if (encodedLength < 1) throw new Error(`ID prefix ${prefixes[prefix]} cannot fit deterministic identity material`)
    const bodySpace = BigInt(BASE62_ALPHABET.length) ** BigInt(encodedLength)
    const encoded = base62Fixed(BigInt(`0x${digest.toString("hex")}`) % bodySpace, encodedLength)
    return `${prefixes[prefix]}_h${encoded}`
  }

  function createCompactTaskID(descending: boolean, wallTimestamp: bigint): string {
    let logicalTimestamp: bigint
    let sequence: bigint
    if (descending) {
      if (wallTimestamp > lastDescendingTaskTimestamp) {
        lastDescendingTaskTimestamp = wallTimestamp
        descendingTaskSequence = 0n
      } else {
        descendingTaskSequence += 1n
        if (descendingTaskSequence > COMPACT_TASK_SEQUENCE_MAX) {
          lastDescendingTaskTimestamp += 1n
          descendingTaskSequence = 0n
        }
      }
      logicalTimestamp = MAX_FIELD_VALUE - lastDescendingTaskTimestamp
      sequence = COMPACT_TASK_SEQUENCE_MAX - descendingTaskSequence
    } else {
      if (wallTimestamp > lastAscendingTaskTimestamp) {
        lastAscendingTaskTimestamp = wallTimestamp
        ascendingTaskSequence = 0n
      } else {
        ascendingTaskSequence += 1n
        if (ascendingTaskSequence > COMPACT_TASK_SEQUENCE_MAX) {
          lastAscendingTaskTimestamp += 1n
          ascendingTaskSequence = 0n
        }
      }
      logicalTimestamp = lastAscendingTaskTimestamp
      sequence = ascendingTaskSequence
    }

    return (
      prefixes.task +
      "_" +
      (descending ? DESCENDING_FORMAT_MARKER : ASCENDING_FORMAT_MARKER) +
      base62Fixed(logicalTimestamp, COMPACT_TASK_TIMESTAMP_LENGTH) +
      base62Fixed(sequence, COMPACT_TASK_SEQUENCE_LENGTH) +
      randomBase62(COMPACT_TASK_RANDOM_LENGTH)
    )
  }

  export const SHORT_PATH_BODY_LENGTH = 1 + FIELD_HEX_LENGTH * 2
  export const DIRECTORY_KEY_LENGTH = 8

  const DIRECTORY_KEY_ALPHABET = BASE62_ALPHABET
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
    const separator = id.lastIndexOf("_")
    if (separator <= 0) throw new Error(`Invalid ID timestamp encoding: ${id}`)
    if (id[separator + 1] !== ASCENDING_FORMAT_MARKER) {
      throw new Error(`ID does not use the canonical ascending timestamp encoding: ${id}`)
    }
    const prefix = id.slice(0, separator)
    const body = id.slice(separator + 1)
    if (prefix === prefixes.task && body.length === COMPACT_TASK_BODY_LENGTH) {
      const encoded = body.slice(1, 1 + COMPACT_TASK_TIMESTAMP_LENGTH)
      return Number(base62Value(encoded))
    }
    if (body.length === MAX_LENGTH - prefix.length - 1) {
      const encoded = body.slice(1, 1 + COMPACT_TIMESTAMP_LENGTH)
      return Number(base62Value(encoded))
    }
    const hex = id.slice(separator + 2, separator + 2 + FIELD_HEX_LENGTH)
    if (!/^[0-9a-f]{12}$/.test(hex)) throw new Error(`Invalid ID timestamp encoding: ${id}`)
    const encoded = BigInt("0x" + hex)
    return Number(encoded)
  }

  function base62Value(input: string): bigint {
    let value = 0n
    for (const character of input) {
      const digit = BASE62_ALPHABET.indexOf(character)
      if (digit < 0) throw new Error(`Invalid Base62 value: ${input}`)
      value = value * BigInt(BASE62_ALPHABET.length) + BigInt(digit)
    }
    return value
  }
}
