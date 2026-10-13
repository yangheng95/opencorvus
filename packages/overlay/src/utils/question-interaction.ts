import type { QuestionRequest } from "@opencorvus-ai/sdk"
import type { InteractionData } from "../components/InteractionCard"
import { requireTimelineOrderKeyDomain, timelineOrderKeyTime } from "./timeline-order"

export interface QuestionInteraction extends InteractionData {
  type: "question"
  status: "pending" | "answered" | "rejected" | "expired"
  sessionID: string
  orderKey: string
  directory: string
  time: { created: number; resolved?: number }
  payload: Pick<QuestionRequest, "questions" | "tool" | "automatic" | "expiry">
  responseOrderKey?: string
  response?: Record<string, unknown>
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, nonempty = false): string {
  if (typeof value !== "string" || (nonempty && !value.trim())) throw new Error(`${label} must be a${nonempty ? " non-empty" : ""} string`)
  return value
}

function positive(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`)
  return value
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value !== undefined && typeof value !== "boolean") throw new Error(`${label} must be a boolean`)
  return value as boolean | undefined
}

function answers(value: unknown, label: string): string[][] {
  if (!Array.isArray(value) || !value.every((answer) => Array.isArray(answer) && answer.every((item) => typeof item === "string"))) {
    throw new Error(`${label} must be an array of answer arrays`)
  }
  return value.map((answer) => [...answer])
}

/** One normalized immutable Request shape for cold reads, connection snapshots and live events. */
export function questionInteraction(request: unknown, directory: string): QuestionInteraction {
  const value = object(request, "question request")
  const id = text(value.id, "question request id", true)
  const label = `question ${id}`
  const sessionID = text(value.sessionID, `${label} sessionID`, true)
  const created = positive(value.timeCreated, `${label} timeCreated`)
  const orderKey = requireTimelineOrderKeyDomain(value.orderKey, label, "interaction")
  if (timelineOrderKeyTime(orderKey, label) !== created) throw new Error(`${label} orderKey time does not match timeCreated`)
  const owningDirectory = text(directory, `${label} directory`, true).trim()
  if (!Array.isArray(value.questions) || value.questions.length === 0) throw new Error(`${label} questions must be a non-empty array`)
  const questions: QuestionRequest["questions"] = value.questions.map((input, index) => {
    const question = object(input, `${label} question ${index}`)
    if (!Array.isArray(question.options)) throw new Error(`${label} question ${index} options must be an array`)
    return {
      header: text(question.header, `${label} question ${index} header`),
      question: text(question.question, `${label} question ${index} text`),
      options: question.options.map((input, optionIndex) => {
        const option = object(input, `${label} option ${optionIndex}`)
        return {
          value: text(option.value, `${label} option value`),
          label: text(option.label, `${label} option label`),
          description: text(option.description, `${label} option description`),
          ...(option.disabled !== undefined ? { disabled: optionalBoolean(option.disabled, `${label} option disabled`) } : {}),
        }
      }),
      ...(question.multiple !== undefined ? { multiple: optionalBoolean(question.multiple, `${label} multiple`) } : {}),
      ...(question.custom !== undefined ? { custom: optionalBoolean(question.custom, `${label} custom`) } : {}),
    }
  })
  let tool: QuestionRequest["tool"]
  if (value.tool !== undefined) {
    const input = object(value.tool, `${label} tool`)
    tool = { messageID: text(input.messageID, `${label} tool messageID`), callID: text(input.callID, `${label} tool callID`) }
  }
  let automatic: QuestionRequest["automatic"]
  if (value.automatic !== undefined) {
    const input = object(value.automatic, `${label} automatic`)
    automatic = { answers: answers(input.answers, `${label} automatic answers`), timeoutMs: positive(input.timeoutMs, `${label} automatic timeoutMs`), timeExpires: positive(input.timeExpires, `${label} automatic timeExpires`) }
  }
  let expiry: QuestionRequest["expiry"]
  if (value.expiry !== undefined) {
    const input = object(value.expiry, `${label} expiry`)
    if (input.origin !== "deadline") throw new Error(`${label} expiry origin must be deadline`)
    expiry = { origin: "deadline", timeoutMs: positive(input.timeoutMs, `${label} expiry timeoutMs`), timeExpires: positive(input.timeExpires, `${label} expiry timeExpires`) }
  }
  return {
    id, sessionID, orderKey, directory: owningDirectory, type: "question", status: "pending",
    title: questions.map((question) => question.header.trim()).filter(Boolean).join(" / ") || undefined,
    body: questions.map((question) => question.question.trim()).filter(Boolean).join("\n\n"),
    payload: { questions, ...(tool ? { tool } : {}), ...(automatic ? { automatic } : {}), ...(expiry ? { expiry } : {}) },
    replyEndpoint: "question", time: { created },
  }
}

/** Reuse the mounted owner only for the same complete immutable pending Request. */
export function reuseQuestionInteraction(existing: InteractionData | undefined, next: QuestionInteraction): QuestionInteraction {
  if (!existing) return next
  if (existing.type !== "question") throw new Error(`question ${next.id} conflicts with an existing ${existing.type} interaction`)
  const previous = existing as QuestionInteraction
  if (previous.id !== next.id || previous.sessionID !== next.sessionID || previous.directory !== next.directory || previous.orderKey !== next.orderKey ||
      previous.time.created !== next.time.created || JSON.stringify(previous.payload) !== JSON.stringify(next.payload)) {
    throw new Error(`question ${next.id} immutable Request changed`)
  }
  if (previous.status !== "pending") throw new Error(`question ${next.id} pending Request conflicts with its ${previous.status} terminal`)
  return previous
}

export function prepareQuestionInteractions(requests: unknown, directory: string): QuestionInteraction[] {
  if (!Array.isArray(requests)) throw new Error("pendingQuestions must be an array")
  const ids = new Set<string>()
  return requests.map((request) => {
    const interaction = questionInteraction(request, directory)
    if (ids.has(interaction.id)) throw new Error(`pendingQuestions contains duplicate request ${interaction.id}`)
    ids.add(interaction.id)
    return interaction
  })
}

/** Validate and project the real terminal provenance; absence never invents a terminal. */
export function resolveQuestionInteraction(existing: InteractionData | undefined, type: string, payload: unknown, orderKey: unknown): QuestionInteraction | undefined {
  const value = object(payload, type)
  const id = text(value.requestID, `${type} requestID`, true)
  const sessionID = text(value.sessionID, `${type} sessionID`, true)
  const resolved = positive(value.timeResolved, `${type} timeResolved`)
  const responseOrderKey = requireTimelineOrderKeyDomain(orderKey, `${type} ${id}`, "interaction")
  if (timelineOrderKeyTime(responseOrderKey, `${type} ${id}`) !== resolved) throw new Error(`${type} ${id} orderKey time does not match timeResolved`)
  let status: QuestionInteraction["status"]
  let response: Record<string, unknown>
  if (type === "question.replied") {
    const automatic = optionalBoolean(value.automatic, `${type} automatic`)
    status = "answered"
    response = { answers: answers(value.answers, `${type} answers`), ...(automatic === true ? { auto_reply: true } : {}) }
  } else if (type === "question.rejected") {
    if (value.origin !== "operator") throw new Error(`${type} origin must be operator`)
    status = "rejected"; response = { origin: "operator" }
  } else if (type === "question.expired") {
    if (value.origin !== "deadline") throw new Error(`${type} origin must be deadline`)
    status = "expired"; response = { origin: "deadline", time_expires: positive(value.timeExpires, `${type} timeExpires`) }
  } else if (type === "question.abandoned") {
    if (value.origin !== "infrastructure") throw new Error(`${type} origin must be infrastructure`)
    status = "expired"; response = { origin: "infrastructure" }
  } else throw new Error(`Unsupported Question terminal ${type}`)
  if (!existing) return
  if (existing.type !== "question" || existing.id !== id || (existing as QuestionInteraction).sessionID !== sessionID) throw new Error(`${type} ${id} Question identity conflict`)
  const previous = existing as QuestionInteraction
  if (previous.status !== "pending") {
    if (previous.status !== status || previous.time.resolved !== resolved || previous.responseOrderKey !== responseOrderKey || JSON.stringify(previous.response) !== JSON.stringify(response)) throw new Error(`question ${id} immutable terminal changed`)
    return previous
  }
  return { ...previous, status, response, responseOrderKey, time: { ...previous.time, resolved } }
}
