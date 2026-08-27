import { BusEvent } from "@/bus/bus-event"
import { createHash } from "node:crypto"
import z from "zod"
import { DIRECTORY_REFERENCE_MIME } from "@opencorvus-ai/transport-protocol"
import { NamedError } from "@opencorvus-ai/util/error"
import { APICallError, convertToModelMessages, LoadAPIKeyError, type ModelMessage, type UIMessage } from "ai"
import { RangeSchema } from "./range"
import { formatPatchEvidence } from "@/snapshot/types"
import { SnapshotEmptyTreeError, SnapshotIntegrityError } from "@/snapshot/errors"
import { fn } from "@/util/fn"
import { ProviderError } from "@/provider/error"
import { ProviderAuthRequiredError } from "@/provider/auth-required-error"
import { type SystemError } from "bun"
import type { Provider } from "@/provider/provider"
import { decodeDataUrlBase64Bytes, decodeTextBytes, isDecodableText } from "./text-mime"
import { attachmentNameFromUrl } from "@/storage/attachment-reference"
import { CompactionHandoff } from "./compaction-handoff"
import {
  FailureOccurrenceAnchor,
  ProcessorObservationFailure,
  ToolFailureCause,
  ToolPersistenceConvergenceFailure,
  renderToolFailureCause,
  sameFailureOccurrence,
} from "./tool-failure-cause"
import { normalizeToolInput } from "./tool-input-norm"
import { ModelImageInputTooLargeError, prepareModelImageInput } from "./model-image-input"
import { VISIBLE_PART_TYPE } from "./part-types"
import { ExecutionCancellationError, ExecutionCancellationOrigin } from "./prompt/cancellation"

function replayToolInput(raw: unknown): Record<string, unknown> {
  const normalized = normalizeToolInput(raw)
  if (normalized.ok) return normalized.value
  // The persisted part keeps the raw invalid value for diagnostics. The model
  // replay path must still emit object-shaped tool arguments; the paired
  // tool-error result carries the exact validation failure back to the model.
  return {}
}

export namespace Message {
  export const OutputLengthError = NamedError.create(
    "MessageOutputLengthError",
    z.object({
      message: z.string().optional(),
      effectiveOutputLimit: z.number().int().positive().optional(),
    }),
  )
  export const AbortedError = NamedError.create(
    "MessageAbortedError",
    z.object({
      message: z.string(),
      cancellation: ExecutionCancellationOrigin.optional(),
    }),
  )
  export const StructuredOutputPayloadError = NamedError.create(
    "StructuredOutputPayloadError",
    z.object({
      message: z.string(),
      reason: z.string(),
    }),
  )
  export const AuthError = NamedError.create(
    "ProviderAuthError",
    z.object({
      providerID: z.string(),
      message: z.string(),
    }),
  )
  export const APIError = NamedError.create(
    "APIError",
    z.object({
      message: z.string(),
      statusCode: z.number().optional(),
      isRetryable: z.boolean(),
      responseHeaders: z.record(z.string(), z.string()).optional(),
      responseBody: z.string().optional(),
      metadata: z.record(z.string(), z.string()).optional(),
    }),
  )
  export type APIError = z.infer<typeof APIError.Schema>
  export const ContextOverflowError = NamedError.create(
    "ContextOverflowError",
    z.object({ message: z.string(), responseBody: z.string().optional() }),
  )
  export const CompactionTaskAuthorityError = NamedError.create(
    "CompactionTaskAuthorityError",
    z.object({ message: z.string(), sessionID: z.string(), anchorMessageID: z.string() }),
  )
  export const CompactionContinuationMissingError = NamedError.create(
    "CompactionContinuationMissingError",
    z.object({ message: z.string(), sessionID: z.string(), assistantMessageID: z.string() }),
  )
  /**
   * Predictive-compaction fired but compaction cannot rescue this turn â€”
   * either there is no message history to summarise (`assistantMsgCount=0`
   * and the user message itself fits) or the non-compressible prompt
   * (system prompt + tool schemas) is already at/over budget. Carries the
   * full breakdown so the operator can identify whether to drop tools, raise
   * the budget, or change the agent design (rule 26: surface the actual
   * cause, do not loop a useless action).
   * See structured-output systemic fix record Â§C.
   */
  export const PromptBudgetOverflowError = NamedError.create(
    "PromptBudgetOverflowError",
    z.object({
      message: z.string(),
      systemTokensEst: z.number(),
      messagePayloadChars: z.number(),
      toolSchemaChars: z.number(),
      compressibleMessageChars: z.number(),
      nonCompressiblePromptChars: z.number(),
      usableBudget: z.number(),
      limit: z.number(),
      toolNames: z.string(),
    }),
  )
  /**
   * Tool schemas alone overrun a configurable share of the model's input
   * budget. Compaction never touches tool definitions, so this is a
   * structural problem with the agent's tool surface (often Zod-rich
   * register/submit tools); fail-fast and refuse to retry.
   */
  export const ToolSchemaBudgetError = NamedError.create(
    "ToolSchemaBudgetError",
    z.object({
      message: z.string(),
      toolSchemaChars: z.number(),
      usableBudget: z.number(),
      ratio: z.number(),
      toolNames: z.string(),
    }),
  )

  export const OutputFormatText = z
    .object({
      type: z.literal("text"),
    })
    .meta({
      ref: "OutputFormatText",
    })

  export const OutputFormatJsonSchema = z
    .object({
      type: z.literal("json_schema"),
      schema: z.record(z.string(), z.any()).meta({ ref: "JSONSchema" }),
      retryCount: z.number().int().min(0).default(2),
    })
    .meta({
      ref: "OutputFormatJsonSchema",
    })

  export const Format = z.discriminatedUnion("type", [OutputFormatText, OutputFormatJsonSchema]).meta({
    ref: "OutputFormat",
  })
  export type OutputFormat = z.infer<typeof Format>

  const PartBase = z.object({
    id: z.string(),
    sessionID: z.string(),
    messageID: z.string(),
    orderKey: z.string().optional(),
  })

  export const SnapshotPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.snapshot),
    snapshot: z.string(),
  }).meta({
    ref: "SnapshotPart",
  })
  export type SnapshotPart = z.infer<typeof SnapshotPart>

  export const PatchPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.patch),
    hash: z.string(),
    files: z.string().array(),
  }).meta({
    ref: "PatchPart",
  })
  export type PatchPart = z.infer<typeof PatchPart>

  export const TextPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.text),
    text: z.string(),
    kind: z.enum(["user_content", "control", "context"]).optional(),
    source: z.enum(["user", "system", "task_tool", "mcp_app"]).optional(),
    time: z
      .object({
        start: z.number(),
        end: z.number().optional(),
      })
      .optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
    .strict()
    .meta({
      ref: "TextPart",
    })
  export type TextPart = z.infer<typeof TextPart>

  export const ReasoningPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.reasoning),
    text: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
    time: z.object({
      start: z.number(),
      end: z.number().optional(),
    }),
  }).meta({
    ref: "ReasoningPart",
  })
  export type ReasoningPart = z.infer<typeof ReasoningPart>

  export const PartErrorIssue = z
    .object({
      path: z.string(),
      message: z.string(),
    })
    .meta({
      ref: "PartErrorIssue",
    })
  export type PartErrorIssue = z.infer<typeof PartErrorIssue>

  export const PartErrorPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.partError),
    title: z.string(),
    message: z.string(),
    issues: z.array(PartErrorIssue),
    originalType: z.string().optional(),
    originalTool: z.string().optional(),
  }).meta({
    ref: "PartErrorPart",
  })
  export type PartErrorPart = z.infer<typeof PartErrorPart>

  const SourceProviderFields = {
    provider: z.string().trim().min(1).optional(),
    providerMetadata: z.record(z.string(), z.any()).optional(),
  }

  const HttpSourceUrl = z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol
      return protocol === "http:" || protocol === "https:"
    }, "source URL must use Hypertext Transfer Protocol Secure or Hypertext Transfer Protocol")

  export const SourceUrlPayload = z
    .object({
      type: z.literal(VISIBLE_PART_TYPE.sourceUrl),
      sourceId: z.string().trim().min(1),
      url: HttpSourceUrl,
      title: z.string().trim().min(1).optional(),
      snippet: z.string().trim().min(1).optional(),
      author: z.string().trim().min(1).optional(),
      publishedAt: z.string().trim().min(1).optional(),
      ...SourceProviderFields,
    })
    .strict()
    .meta({ ref: "SourceUrlPayload" })
  export type SourceUrlPayload = z.infer<typeof SourceUrlPayload>

  export const SourceDocumentPayload = z
    .object({
      type: z.literal(VISIBLE_PART_TYPE.sourceDocument),
      sourceId: z.string().trim().min(1),
      mediaType: z.string().trim().min(1),
      title: z.string().trim().min(1),
      filename: z.string().trim().min(1).optional(),
      ...SourceProviderFields,
    })
    .strict()
    .meta({ ref: "SourceDocumentPayload" })
  export type SourceDocumentPayload = z.infer<typeof SourceDocumentPayload>

  export const SourceFileRange = z
    .object({
      startLine: z.number().int().positive(),
      endLine: z.number().int().positive(),
    })
    .refine((value) => value.endLine >= value.startLine, {
      message: "source file range endLine must be greater than or equal to startLine",
      path: ["endLine"],
    })
    .meta({ ref: "SourceFileRange" })

  export const SourceFilePayload = z
    .object({
      type: z.literal(VISIBLE_PART_TYPE.sourceFile),
      sourceId: z.string().trim().min(1),
      path: z.string().trim().min(1),
      title: z.string().trim().min(1),
      range: SourceFileRange.optional(),
      symbol: z.string().trim().min(1).optional(),
      ...SourceProviderFields,
    })
    .strict()
    .meta({ ref: "SourceFilePayload" })
  export type SourceFilePayload = z.infer<typeof SourceFilePayload>

  export const SourcePayload = z
    .discriminatedUnion("type", [SourceUrlPayload, SourceDocumentPayload, SourceFilePayload])
    .meta({ ref: "SourcePayload" })
  export type SourcePayload = z.infer<typeof SourcePayload>

  export const SourceUrlPart = PartBase.extend(SourceUrlPayload.shape).meta({ ref: "SourceUrlPart" })
  export type SourceUrlPart = z.infer<typeof SourceUrlPart>

  export const SourceDocumentPart = PartBase.extend(SourceDocumentPayload.shape).meta({ ref: "SourceDocumentPart" })
  export type SourceDocumentPart = z.infer<typeof SourceDocumentPart>

  export const SourceFilePart = PartBase.extend(SourceFilePayload.shape).meta({ ref: "SourceFilePart" })
  export type SourceFilePart = z.infer<typeof SourceFilePart>

  export const SourcePart = z
    .discriminatedUnion("type", [SourceUrlPart, SourceDocumentPart, SourceFilePart])
    .meta({ ref: "SourcePart" })
  export type SourcePart = z.infer<typeof SourcePart>

  const FilePartSourceBase = z.object({
    text: z
      .object({
        value: z.string(),
        start: z.number().int(),
        end: z.number().int(),
      })
      .meta({
        ref: "FilePartSourceText",
      }),
  })

  export const FileSource = FilePartSourceBase.extend({
    type: z.literal("file"),
    path: z.string(),
  }).meta({
    ref: "FileSource",
  })

  export const SymbolSource = FilePartSourceBase.extend({
    type: z.literal("symbol"),
    path: z.string(),
    range: RangeSchema,
    name: z.string(),
    kind: z.number().int(),
  }).meta({
    ref: "SymbolSource",
  })

  export const ResourceSource = FilePartSourceBase.extend({
    type: z.literal("resource"),
    clientName: z.string(),
    uri: z.string(),
  }).meta({
    ref: "ResourceSource",
  })

  export const FilePartSource = z.discriminatedUnion("type", [FileSource, SymbolSource, ResourceSource]).meta({
    ref: "FilePartSource",
  })

  export const FilePart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.file),
    mime: z.string(),
    filename: z.string().optional(),
    url: z.string(),
    /** Manual uploads use a stable index row instead of provider-bound bytes. */
    presentation: z.literal("attachment-index").optional(),
    source: FilePartSource.optional(),
  }).meta({
    ref: "FilePart",
  })
  export type FilePart = z.infer<typeof FilePart>

  export const InteractiveArtifactPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.interactiveArtifact),
    artifactID: z.string().trim().min(1),
  })
    .strict()
    .meta({
      ref: "InteractiveArtifactPart",
    })
  export type InteractiveArtifactPart = z.infer<typeof InteractiveArtifactPart>

  export const CompactionPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.compaction),
    auto: z.boolean(),
    overflow: z.boolean().optional(),
    tail_start_id: z.string().optional(),
    anchor_id: z.string().optional(),
    focus: z.string().optional(),
  }).meta({
    ref: "CompactionPart",
  })
  export type CompactionPart = z.infer<typeof CompactionPart>

  export const RetryPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.retry),
    attempt: z.number(),
    error: APIError.Schema,
    time: z.object({
      created: z.number(),
    }),
  }).meta({
    ref: "RetryPart",
  })
  export type RetryPart = z.infer<typeof RetryPart>

  export const StepStartPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.stepStart),
    snapshot: z.string().optional(),
  }).meta({
    ref: "StepStartPart",
  })
  export type StepStartPart = z.infer<typeof StepStartPart>

  export const TokenUsage = z
    .object({
      total: z.number(),
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
      cache: z.object({
        read: z.number(),
        write: z.number(),
      }),
    })
    .meta({
      ref: "TokenUsage",
    })
  export type TokenUsage = z.infer<typeof TokenUsage>

  export const BillingCoverage = z
    .object({
      status: z.enum(["priced", "unpriced"]),
    })
    .strict()
    .meta({
      ref: "BillingCoverage",
    })
  export type BillingCoverage = z.infer<typeof BillingCoverage>

  export const StepFinishPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.stepFinish),
    reason: z.string(),
    snapshot: z.string().optional(),
    cost: z.number(),
    tokens: TokenUsage,
    billing: BillingCoverage.optional(),
  }).meta({
    ref: "StepFinishPart",
  })
  export type StepFinishPart = z.infer<typeof StepFinishPart>

  /** JSON (JavaScript Object Notation) is the persisted Tool input value
   * domain. Sharing this schema with every Tool state makes compaction a total
   * projection over exactly the values that can be stored. */
  const PersistedJSONValue = z.json()
  // An empty OpenAPI schema is the complete JSON wire-value domain. Keep the
  // recursive runtime validation in Zod without exporting its local $defs.
  export const ToolInput: z.ZodType<unknown> = z.unknown().superRefine((value, context) => {
    if (PersistedJSONValue.safeParse(value).success) return
    context.addIssue({ code: "custom", message: "Expected a JSON value" })
  })
  export type ToolInput = z.infer<typeof ToolInput>

  export const ToolStatePending = z
    .object({
      status: z.literal("pending"),
      input: ToolInput,
      raw: z.string(),
      time: z.object({
        start: z.number(),
      }),
    })
    .meta({
      ref: "ToolStatePending",
    })

  export type ToolStatePending = z.infer<typeof ToolStatePending>

  export const ToolStateRunning = z
    .object({
      status: z.literal("running"),
      input: ToolInput,
      title: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      time: z.object({
        start: z.number(),
      }),
    })
    .meta({
      ref: "ToolStateRunning",
    })
  export type ToolStateRunning = z.infer<typeof ToolStateRunning>

  export const ToolStateCompleted = z
    .object({
      status: z.literal("completed"),
      input: ToolInput,
      output: z.string(),
      title: z.string(),
      metadata: z.record(z.string(), z.any()),
      time: z.object({
        start: z.number(),
        end: z.number(),
        compacted: z.number().optional(),
      }),
      attachments: FilePart.array().optional(),
    })
    .refine((state) => state.time.end > state.time.start, {
      message: "tool terminal end time must be later than start time",
      path: ["time", "end"],
    })
    .meta({
      ref: "ToolStateCompleted",
    })
  export type ToolStateCompleted = z.infer<typeof ToolStateCompleted>

  export const ToolStateError = z
    .object({
      status: z.literal("error"),
      input: ToolInput,
      failure: ToolFailureCause,
      metadata: z.record(z.string(), z.any()).optional(),
      time: z.object({
        start: z.number(),
        end: z.number(),
      }),
    })
    .refine((state) => state.time.end > state.time.start, {
      message: "tool terminal end time must be later than start time",
      path: ["time", "end"],
    })
    .meta({
      ref: "ToolStateError",
    })
  export type ToolStateError = z.infer<typeof ToolStateError>

  export const ToolState = z
    .discriminatedUnion("status", [ToolStatePending, ToolStateRunning, ToolStateCompleted, ToolStateError])
    .meta({
      ref: "ToolState",
    })

  export const ToolPart = PartBase.extend({
    type: z.literal(VISIBLE_PART_TYPE.tool),
    callID: z.string(),
    tool: z.string(),
    state: ToolState,
    metadata: z.record(z.string(), z.any()).optional(),
  }).meta({
    ref: "ToolPart",
  })
  export type ToolPart = z.infer<typeof ToolPart>

  const Base = z.object({
    id: z.string(),
    sessionID: z.string(),
    orderKey: z.string().optional(),
    author: z.string().min(1),
  })

  export const User = Base.extend({
    role: z.literal("user"),
    time: z.object({
      created: z.number(),
    }),
    /** Persisted while another Turn was in flight. Excluded from prompt
     *  assembly until the loop delivers it at the next Turn boundary; every
     *  other reader (UI, API, exports) sees the Message immediately. */
    pendingDelivery: z.boolean().optional(),
    format: Format.optional(),
    summary: z
      .object({
        title: z.string().optional(),
        body: z.string().optional(),
      })
      .optional(),
    agent: z.string(),
    model: z.object({
      providerID: z.string(),
      modelID: z.string(),
    }),
    tools: z.record(z.string(), z.boolean()).optional(),
    includeMcpTools: z.boolean().optional(),
    variant: z.string().optional(),
    extra: z.record(z.string(), z.any()).optional(),
  }).meta({
    ref: "UserMessage",
  })
  export type User = z.infer<typeof User>

  export const Part = z
    .discriminatedUnion("type", [
      TextPart,
      PartErrorPart,
      ReasoningPart,
      SourceUrlPart,
      SourceDocumentPart,
      SourceFilePart,
      FilePart,
      InteractiveArtifactPart,
      ToolPart,
      StepStartPart,
      StepFinishPart,
      SnapshotPart,
      PatchPart,
      RetryPart,
      CompactionPart,
    ])
    .meta({
      ref: "Part",
    })
  export type Part = z.infer<typeof Part>

  export function compactionContinuationTextParts(parts: readonly Part[]): TextPart[] {
    const finalStepStart = parts.findLastIndex((part) => part.type === "step-start")
    return parts.slice(finalStepStart + 1).filter((part): part is TextPart => part.type === "text")
  }

  export const VisiblePart = z
    .discriminatedUnion("type", [
      TextPart.extend({ orderKey: z.string().min(1) }),
      PartErrorPart.extend({ orderKey: z.string().min(1) }),
      ReasoningPart.extend({ orderKey: z.string().min(1) }),
      SourceUrlPart.extend({ orderKey: z.string().min(1) }),
      SourceDocumentPart.extend({ orderKey: z.string().min(1) }),
      SourceFilePart.extend({ orderKey: z.string().min(1) }),
      FilePart.extend({ orderKey: z.string().min(1) }),
      InteractiveArtifactPart.extend({ orderKey: z.string().min(1) }),
      ToolPart.extend({ orderKey: z.string().min(1) }),
      StepStartPart.extend({ orderKey: z.string().min(1) }),
      StepFinishPart.extend({ orderKey: z.string().min(1) }),
      SnapshotPart.extend({ orderKey: z.string().min(1) }),
      PatchPart.extend({ orderKey: z.string().min(1) }),
      RetryPart.extend({ orderKey: z.string().min(1) }),
      CompactionPart.extend({ orderKey: z.string().min(1) }),
    ])
    .meta({
      ref: "VisibleMessagePart",
    })
  export type VisiblePart = z.infer<typeof VisiblePart>

  export const Assistant = Base.extend({
    role: z.literal("assistant"),
    time: z.object({
      created: z.number(),
      completed: z.number().optional(),
    }),
    error: z
      .discriminatedUnion("name", [
        AuthError.Schema,
        NamedError.Unknown.Schema,
        OutputLengthError.Schema,
        AbortedError.Schema,
        StructuredOutputPayloadError.Schema,
        SnapshotIntegrityError.Schema,
        SnapshotEmptyTreeError.Schema,
        ContextOverflowError.Schema,
        CompactionContinuationMissingError.Schema,
        PromptBudgetOverflowError.Schema,
        ToolSchemaBudgetError.Schema,
        ModelImageInputTooLargeError.Schema,
        APIError.Schema,
      ])
      .optional(),
    failureOccurrence: FailureOccurrenceAnchor.optional(),
    convergenceFailure: ToolPersistenceConvergenceFailure.optional(),
    observationFailures: z.array(ProcessorObservationFailure).optional(),
    parentID: z.string(),
    /** Ordered user Messages accepted by this physical reply Turn. The tail
     *  remains `parentID`; older Messages are co-consumed inputs from the same
     *  delivery batch and resolve to this one canonical assistant reply. */
    acceptedInputMessageIDs: z.array(z.string().min(1)).min(1).optional(),
    modelID: z.string(),
    providerID: z.string(),
    agent: z.string(),
    path: z.object({
      cwd: z.string(),
      root: z.string(),
    }),
    summary: z.boolean().optional(),
    cost: z.number(),
    tokens: TokenUsage,
    billing: BillingCoverage.optional(),
    structured: z.any().optional(),
    variant: z.string().optional(),
    finish: z.string().optional(),
    /** Physical fencing token only. Business ingress identity is derived from
     * the exact parent control/participant Message chain. */
    activationID: z.string().min(1).optional(),
  })
    .superRefine((value, ctx) => {
      if (value.acceptedInputMessageIDs) {
        if (new Set(value.acceptedInputMessageIDs).size !== value.acceptedInputMessageIDs.length) {
          ctx.addIssue({
            code: "custom",
            message: "Assistant accepted input Message identities must be unique",
            path: ["acceptedInputMessageIDs"],
          })
        }
        if (value.acceptedInputMessageIDs.at(-1) !== value.parentID) {
          ctx.addIssue({
            code: "custom",
            message: "Assistant parent must be the tail accepted input Message",
            path: ["acceptedInputMessageIDs"],
          })
        }
      }
      const occurrence = value.failureOccurrence
      if (!occurrence) {
        if (value.convergenceFailure || value.observationFailures?.length) {
          ctx.addIssue({
            code: "custom",
            message: "Processor failure evidence requires a failure occurrence",
            path: ["failureOccurrence"],
          })
        }
        return
      }
      if (
        !value.error ||
        occurrence.session_id !== value.sessionID ||
        occurrence.assistant_message_id !== value.id ||
        occurrence.error_name !== value.error.name
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Assistant failure occurrence must match its Session, message, and canonical error",
          path: ["failureOccurrence"],
        })
      }
      if (value.convergenceFailure && !sameFailureOccurrence(value.convergenceFailure.failure_occurrence, occurrence)) {
        ctx.addIssue({
          code: "custom",
          message: "Tool convergence evidence must reference the assistant failure occurrence",
          path: ["convergenceFailure", "failure_occurrence"],
        })
      }
    })
    .meta({
      ref: "AssistantMessage",
    })
  export type Assistant = z.infer<typeof Assistant>

  /**
   * One durable reply-acceptance authority. Historical assistant Messages
   * predate delivery batching and therefore accept exactly their parent.
   */
  export function acceptedInputMessageIDs(message: Assistant): readonly string[] {
    return message.acceptedInputMessageIDs ?? [message.parentID]
  }

  export function acceptsInputMessage(message: Assistant, messageID: string): boolean {
    return acceptedInputMessageIDs(message).includes(messageID)
  }

  export const Info = z.discriminatedUnion("role", [User, Assistant]).meta({
    ref: "Message",
  })
  export type Info = z.infer<typeof Info>

  export const VisibleInfo = z
    .discriminatedUnion("role", [
      User.extend({ orderKey: z.string().min(1) }),
      Assistant.safeExtend({ orderKey: z.string().min(1) }),
    ])
    .meta({
      ref: "VisibleMessage",
    })
  export type VisibleInfo = z.infer<typeof VisibleInfo>

  export const Event = {
    Created: BusEvent.define(
      "message.created",
      z.object({
        info: VisibleInfo,
      }),
      { tier: 3 },
    ),
    Updated: BusEvent.define(
      "message.updated",
      z.object({
        info: VisibleInfo,
      }),
      { tier: 3 },
    ),
    Removed: BusEvent.define(
      "message.removed",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
      }),
      { tier: 3 },
    ),
    Moved: BusEvent.define(
      "message.moved",
      z.object({
        sourceSessionID: z.string().min(1),
        info: VisibleInfo,
        parts: z.array(VisiblePart),
      }),
      { tier: 3 },
    ),
    PartUpdated: BusEvent.define(
      "message.part.updated",
      z.object({
        orderKey: z.string().min(1),
        part: VisiblePart,
      }),
      { tier: 3 },
    ),
    PartDelta: BusEvent.define(
      "message.part.delta",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
        partID: z.string(),
        field: z.string(),
        delta: z.string(),
      }),
      { tier: 3 },
    ),
    PartRemoved: BusEvent.define(
      "message.part.removed",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
        partID: z.string(),
      }),
      { tier: 3 },
    ),
  }

  export const WithParts = z.object({
    info: Info,
    parts: z.array(Part),
  })
  export type WithParts = z.infer<typeof WithParts>

  export const VisibleWithParts = z
    .object({
      info: VisibleInfo,
      parts: z.array(VisiblePart),
    })
    .meta({
      ref: "VisibleMessageWithParts",
    })
  export type VisibleWithParts = z.infer<typeof VisibleWithParts>


  export interface ToModelMessagesOptions {
    stripMedia?: boolean
    toolOutputMaxChars?: number
    preserveAssistantErrors?: boolean
    omitAssistantReasoning?: boolean
  }

  function compactToolOutput(text: string, maxChars: number | undefined): string {
    if (!maxChars || maxChars <= 0 || text.length <= maxChars) return text
    const head = Math.max(0, Math.floor(maxChars * 0.7))
    const tail = Math.max(0, maxChars - head)
    return [
      text.slice(0, head).trimEnd(),
      `[Tool output truncated for compaction: ${text.length} chars total, ${text.length - maxChars} chars omitted]`,
      text.slice(text.length - tail).trimStart(),
    ].join("\n")
  }

  function assistantErrorText(error: unknown): string {
    const serialized = (() => {
      try {
        return JSON.stringify(error)
      } catch {
        return String(error)
      }
    })()
    if (typeof error === "object" && error !== null) {
      const record = error as Record<string, unknown>
      const name = typeof record.name === "string" ? record.name : "AssistantError"
      const message = typeof record.message === "string" ? record.message : serialized
      const status = typeof record.statusCode === "number" ? ` status=${record.statusCode}` : ""
      return `[Assistant error preserved for compaction: ${name}${status}: ${message}]\n${serialized}`
    }
    return `[Assistant error preserved for compaction: ${serialized}]`
  }

  type ToolResultAttachment = {
    mime: string
    url: string
    filename?: string
  }

  type ResolvedToolResultAttachment = {
    mime: string
    bytes: Buffer
    sha256: string
    byteLength: number
    safeReference: string
    filename?: string
  }

  type ToolResultAttachmentContentPart =
    | {
        type: "image-data"
        mediaType: string
        data: string
      }
    | {
        type: "file-data"
        mediaType: string
        data: string
        filename?: string
      }

  const attachmentDigest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")

  const inlineAttachmentMime = (url: string, attachment: ToolResultAttachment): string => {
    const match = /^data:([^;,]+)(?:;[^;,]+)*;base64,/i.exec(url)
    if (!match) {
      throw new Error(
        `Tool-result attachment ${attachment.filename ?? attachment.mime} must use a valid base64 data URL or canonical AttachmentStore URL`,
      )
    }
    return match[1]
  }

  const resolveToolResultAttachment = async (
    attachment: ToolResultAttachment,
  ): Promise<ResolvedToolResultAttachment> => {
    if (!attachment.mime.trim()) {
      throw new Error(`Tool-result attachment ${attachment.filename ?? "unnamed"} has an empty MIME type`)
    }

    if (attachment.url.startsWith("data:")) {
      const encodedMime = inlineAttachmentMime(attachment.url, attachment)
      if (encodedMime.toLowerCase() !== attachment.mime.toLowerCase()) {
        throw new Error(
          `Tool-result attachment ${attachment.filename ?? "inline attachment"} declares MIME ${attachment.mime} but its data URL declares ${encodedMime}`,
        )
      }
      const bytes = decodeDataUrlBase64Bytes(
        attachment.url,
        `Message.toModelOutput tool-result attachment ${attachment.filename ?? attachment.mime}`,
      )
      return {
        mime: attachment.mime,
        bytes,
        sha256: attachmentDigest(bytes),
        byteLength: bytes.byteLength,
        safeReference: attachment.filename
          ? `inline attachment ${attachment.filename}`
          : `inline attachment (${attachment.mime})`,
        ...(attachment.filename ? { filename: attachment.filename } : {}),
      }
    }

    const located = attachmentNameFromUrl(attachment.url)
    if (!located) {
      throw new Error(
        `Tool-result attachment ${attachment.filename ?? attachment.mime} must use a valid base64 data URL or canonical AttachmentStore URL`,
      )
    }

    try {
      const { AttachmentStore } = await import("@/storage/attachment-store")
      const reference = await AttachmentStore.requireReference({
        projectID: located.projectID,
        url: attachment.url,
        mime: attachment.mime,
      })
      const urlSha256 = /^([0-9a-f]{64})\./i.exec(located.name)?.[1]?.toLowerCase()
      if (urlSha256 !== reference.sha.toLowerCase()) {
        throw new Error(
          `canonical URL SHA-256 ${urlSha256 ?? "missing"} does not match canonical metadata SHA-256 ${reference.sha}`,
        )
      }
      const bytes = await AttachmentStore.read(located.projectID, located.name)
      const sha256 = attachmentDigest(bytes)
      if (bytes.byteLength !== reference.size) {
        throw new Error(`blob size ${bytes.byteLength} does not match canonical metadata size ${reference.size}`)
      }
      if (sha256 !== reference.sha) {
        throw new Error(`blob SHA-256 ${sha256} does not match canonical metadata SHA-256 ${reference.sha}`)
      }
      return {
        mime: reference.mime,
        bytes,
        sha256,
        byteLength: bytes.byteLength,
        safeReference: reference.url,
        ...((attachment.filename ?? reference.filename) ? { filename: attachment.filename ?? reference.filename } : {}),
      }
    } catch (error) {
      throw new Error(
        `Failed to validate tool-result attachment ${attachment.url}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      )
    }
  }

  const prepareModelBoundImage = async (
    attachment: Pick<ResolvedToolResultAttachment, "mime" | "bytes" | "filename" | "safeReference">,
  ) => {
    return await prepareModelImageInput({
      mime: attachment.mime,
      bytes: attachment.bytes,
      source: attachment.filename ?? attachment.safeReference,
    })
  }

  function unwrapToolModelOutputArgs(args: unknown): unknown {
    if (!args || typeof args !== "object" || Array.isArray(args)) return args
    const record = args as Record<string, unknown>
    if ("toolCallId" in record && "output" in record) return record.output
    return args
  }

  /**
   * Converts both live tool execution results and persisted tool-result replay
   * through the same provider-aware multimodal path.
   */
  export async function toolResultToModelOutput(args: unknown, model: Provider.Model) {
    const output = unwrapToolModelOutputArgs(args)
    if (typeof output === "string") return { type: "text" as const, value: output }
    if (!output || typeof output !== "object" || Array.isArray(output)) {
      return { type: "json" as const, value: output as never }
    }

    const outputObject = output as {
      output?: string
      text?: string
      attachments?: ToolResultAttachment[]
    }
    const rawAttachments = outputObject.attachments ?? []
    // Resolve and integrity-check every attachment before consulting provider
    // capability. This makes unsupported transports observable without letting
    // missing or corrupt evidence masquerade as a harmless provider omission.
    const resolvedAttachments = await Promise.all(rawAttachments.map(resolveToolResultAttachment))
    const textAttachments = resolvedAttachments.filter((attachment) =>
      isDecodableText(attachment.mime, attachment.filename),
    )
    const binaryAttachments = resolvedAttachments.filter(
      (attachment) => !isDecodableText(attachment.mime, attachment.filename),
    )
    const decodedAttachmentText = textAttachments
      .map((attachment) =>
        [
          `[Tool-result text attachment: ${attachment.filename ?? attachment.safeReference}; mime=${attachment.mime}; ref=${attachment.safeReference}; sha256=${attachment.sha256}; bytes=${attachment.byteLength}]`,
          decodeTextBytes(attachment.bytes),
        ].join("\n"),
      )
      .join("\n\n")
    const { ProviderTransform } = await import("@/provider/transform")
    const transports = binaryAttachments.map((attachment) => ({
      attachment,
      transport: ProviderTransform.toolResultAttachmentTransport(model, attachment.mime),
    }))
    const unsupportedTextRows = transports.flatMap(({ attachment, transport }) =>
      transport.contentType === "unsupported"
        ? [
            `- ${attachment.mime}; ref=${attachment.safeReference}; sha256=${attachment.sha256}; bytes=${attachment.byteLength}; reason=${transport.reason}`,
          ]
        : [],
    )
    const unsupportedText =
      unsupportedTextRows.length > 0
        ? [
            "Attachments remain tool-owned evidence because this provider transport cannot send them as typed tool results:",
            ...unsupportedTextRows,
          ].join("\n")
        : ""

    const encodedAttachments = await Promise.all(
      transports.map(
        async ({ attachment, transport }): Promise<{ part?: ToolResultAttachmentContentPart; note?: string }> => {
          if (transport.contentType === "unsupported") return {}
          if (transport.contentType === "file-data") {
            return {
              part: {
                type: "file-data",
                mediaType: attachment.mime,
                data: attachment.bytes.toString("base64"),
                ...(attachment.filename ? { filename: attachment.filename } : {}),
              },
            }
          }
          const prepared = await prepareModelBoundImage(attachment)
          return {
            part: {
              type: "image-data",
              mediaType: prepared.mime,
              data: prepared.bytes.toString("base64"),
            },
            ...(prepared.note ? { note: prepared.note } : {}),
          }
        },
      ),
    )
    const attachmentParts = encodedAttachments
      .map((entry) => entry.part)
      .filter((part): part is ToolResultAttachmentContentPart => part !== undefined)
    const cropNotes = encodedAttachments
      .map((entry) => entry.note)
      .filter((note): note is string => typeof note === "string" && note.length > 0)
    const baseText =
      typeof outputObject.text === "string"
        ? outputObject.text
        : typeof outputObject.output === "string"
          ? outputObject.output
          : ""
    const text = [baseText, decodedAttachmentText, unsupportedText, ...cropNotes]
      .filter((item) => item.length > 0)
      .join("\n\n")

    if (attachmentParts.length === 0) {
      if (text.length > 0) return { type: "text" as const, value: text }
      return { type: "json" as const, value: outputObject as never }
    }
    return {
      type: "content" as const,
      value: [...(text.length > 0 ? [{ type: "text" as const, text }] : []), ...attachmentParts],
    }
  }

  export async function toModelMessages(
    input: WithParts[],
    model: Provider.Model,
    options: ToModelMessagesOptions = {},
  ): Promise<ModelMessage[]> {
    const result: UIMessage[] = []
    const toolNames = new Set<string>()

    // AI SDK v6 invokes tool.toModelOutput with an args object
    // ({ toolCallId, input, output }), not a raw output. v5 passed `output`
    // directly. Reading the wrapped argument as if it were the output gave
    // outputObject.text === undefined for every tool result, which the v6
    // ToolModelOutput zod schema rejected ("expected string, received
    // undefined" at value[0].text), surfacing as
    // `Invalid prompt: The messages do not match the ModelMessage[] schema`
    // and a hard orchestrator retry loop.
    // Persisted file parts have one source: a canonical AttachmentStore URL.
    // Bytes are read on demand and converted to the AI SDK (Artificial
    // Intelligence Software Development Kit) data URL only at the provider
    // boundary. Live tool-result attachments have their own conversion path
    // above and may still carry process-local data URLs before persistence.
    const modelBoundFilePart = async (part: {
      mime: string
      url: string
      filename?: string
    }): Promise<{ url: string; note?: string }> => {
      const located = attachmentNameFromUrl(part.url)
      if (!located) {
        throw new Error(
          `Persisted file part ${part.filename ?? part.mime} must use a canonical AttachmentStore URL; received ${part.url}`,
        )
      }
      const { AttachmentStore } = await import("@/storage/attachment-store")
      const bytes = await AttachmentStore.read(located.projectID, located.name)
      const prepared = await prepareModelBoundImage({
        mime: part.mime,
        bytes,
        safeReference: part.url,
        ...(part.filename ? { filename: part.filename } : {}),
      })
      return {
        url: `data:${prepared.mime};base64,${prepared.bytes.toString("base64")}`,
        ...(prepared.note ? { note: prepared.note } : {}),
      }
    }

    const userFilePart = async (part: Message.FilePart): Promise<{ url: string; note?: string }> => {
      return await modelBoundFilePart(part)
    }

    // AI SDK v6 invokes tool.toModelOutput with an args object
    // ({ toolCallId, input, output }), not a raw output. v5 passed `output`
    // directly. Reading the wrapped argument as if it were the output gave
    // outputObject.text === undefined for every tool result, which the v6
    // ToolModelOutput zod schema rejected ("expected string, received
    // undefined" at value[0].text), surfacing as
    // `Invalid prompt: The messages do not match the ModelMessage[] schema`
    // and a hard orchestrator retry loop.
    //
    // toModelOutput is awaited by the AI SDK (see
    // node_modules/ai/dist/index.js: `await tool2.toModelOutput(...)`),
    // so reading attachment bytes from disk on demand is safe.
    const toModelOutput = (args: unknown) => toolResultToModelOutput(args, model)

    for (const msg of input) {
      if (msg.parts.length === 0) continue

      if (msg.info.role === "user") {
        const userMessage: UIMessage = {
          id: msg.info.id,
          role: "user",
          parts: [],
        }
        result.push(userMessage)
        for (const part of msg.parts) {
          if (part.type === "text")
            userMessage.parts.push({
              type: "text",
              text: part.text,
            })
          // Manual uploads explicitly choose index presentation. Persistence
          // retains the real canonical file part, while provider replay gets
          // only the stable name/MIME/URL and can inspect it through a visible
          // tool. Programmatic evidence without this marker retains its typed
          // multimodal behavior.
          if (
            part.type === "file" &&
            part.presentation === "attachment-index" &&
            attachmentNameFromUrl(part.url)
          ) {
            userMessage.parts.push({
              type: "text",
              text:
                part.mime === DIRECTORY_REFERENCE_MIME
                  ? `[Attached folder index: ${part.filename ?? "folder"} — ${part.url}]`
                  : `[Attached file index: ${part.filename ?? "file"} — ${part.mime} — ${part.url}]`,
            })
            continue
          }
          // Canonical text attachments remain concise refs for the historical
          // API path. Noncanonical text inputs are handled by SessionPrompt.
          if (part.type === "file" && isDecodableText(part.mime, part.filename)) {
            if (attachmentNameFromUrl(part.url)) {
              userMessage.parts.push({
                type: "text",
                text: `[Attached ${part.mime}: ${part.filename ?? "file"} (${part.url})]`,
              })
            }
            continue
          }
          // Binary file parts are only forwarded when the target model declares
          // the capability to handle them â€” otherwise the AI SDK / provider
          // conversion layer throws UnsupportedFunctionalityError at runtime.
          if (part.type === "file" && part.mime !== "application/x-directory") {
            if (options.stripMedia) {
              userMessage.parts.push({
                type: "text",
                text: `[Attached ${part.mime}: ${part.filename ?? "file"} omitted from compaction context]`,
              })
              continue
            }
            const isImage = part.mime.startsWith("image/")
            const isPdf = part.mime === "application/pdf"
            const capable = (isImage && model.capabilities.input.image) || (isPdf && model.capabilities.input.pdf)
            if (capable) {
              const file = await userFilePart(part)
              userMessage.parts.push({
                type: "file",
                url: file.url,
                mediaType: part.mime,
                filename: part.filename,
              })
              if (file.note) userMessage.parts.push({ type: "text", text: file.note })
            }
          }

          if (part.type === "compaction") continue
        }
      }

      if (msg.info.role === "assistant") {
        const differentModel = `${model.providerID}/${model.id}` !== `${msg.info.providerID}/${msg.info.modelID}`
        const shouldSkipErroredAssistant =
          msg.info.error &&
          !(
            Message.AbortedError.isInstance(msg.info.error) &&
            msg.parts.some((part) => part.type !== "step-start" && part.type !== "reasoning")
          )
        if (shouldSkipErroredAssistant && !options.preserveAssistantErrors) {
          continue
        }
        const assistantMessage: UIMessage = {
          id: msg.info.id,
          role: "assistant",
          parts: [],
        }
        if (msg.info.error && options.preserveAssistantErrors) {
          assistantMessage.parts.push({
            type: "text",
            text: assistantErrorText(msg.info.error),
          })
        }
        const parts = CompactionHandoff.isValidSummaryMessage(msg.info)
          ? compactionContinuationTextParts(msg.parts)
          : msg.parts
        for (const part of parts) {
          if (part.type === "text")
            assistantMessage.parts.push({
              type: "text",
              text: part.text,
              ...(differentModel ? {} : { providerMetadata: part.metadata }),
            })
          if (part.type === "source-url")
            assistantMessage.parts.push({
              type: "source-url",
              sourceId: part.sourceId,
              url: part.url,
              title: part.title,
              ...(differentModel ? {} : { providerMetadata: part.providerMetadata }),
            })
          if (part.type === "source-document")
            assistantMessage.parts.push({
              type: "source-document",
              sourceId: part.sourceId,
              mediaType: part.mediaType,
              title: part.title,
              filename: part.filename,
              ...(differentModel ? {} : { providerMetadata: part.providerMetadata }),
            })
          if (part.type === "source-file")
            assistantMessage.parts.push({
              type: "text",
              text: `<source-file path=${JSON.stringify(part.path)}${
                part.range
                  ? ` start-line=${JSON.stringify(part.range.startLine)} end-line=${JSON.stringify(part.range.endLine)}`
                  : ""
              } />`,
            })
          if (part.type === "step-start")
            assistantMessage.parts.push({
              type: "step-start",
            })
          if (part.type === "tool") {
            // MCP App calls are real, visible tool evidence, but they are not
            // provider-authored tool calls. Replaying them to the model would
            // manufacture an unmatched provider tool_call_id.
            if (part.metadata?.origin === "mcp-app") continue
            toolNames.add(part.tool)
            if (part.state.status === "completed") {
              let outputText: string
              if (part.state.time.compacted) {
                outputText = "[Old tool result content cleared]"
              } else {
                outputText = compactToolOutput(part.state.output, options.toolOutputMaxChars)
              }
              const attachments =
                part.state.time.compacted || options.stripMedia ? [] : (part.state.attachments ?? [])

              const output =
                attachments.length > 0
                  ? {
                      text: outputText,
                      attachments,
                    }
                  : outputText

              assistantMessage.parts.push({
                type: ("tool-" + part.tool) as `tool-${string}`,
                state: "output-available",
                toolCallId: part.callID,
                input: replayToolInput(part.state.input),
                output,
                ...(differentModel ? {} : { callProviderMetadata: part.metadata }),
              })
            }
            if (part.state.status === "error") {
              const errorText = renderToolFailureCause(part.state.failure)
              assistantMessage.parts.push({
                type: ("tool-" + part.tool) as `tool-${string}`,
                state: "output-error",
                toolCallId: part.callID,
                input: replayToolInput(part.state.input),
                errorText,
                ...(differentModel ? {} : { callProviderMetadata: part.metadata }),
              })
            }
          }
          if (part.type === "reasoning" && !options.omitAssistantReasoning) {
            assistantMessage.parts.push({
              type: "reasoning",
              text: part.text,
              ...(differentModel ? {} : { providerMetadata: part.metadata }),
            })
          }
          if (part.type === "patch") {
            // Wrap with <patch>...</patch> XML tag (same shape as the
            // compaction transcript at session/compaction.ts:145) so the
            // breadcrumb reads as a structural protocol element. The
            // earlier `[...]` prose-style marker was easy for the model
            // to mimic — it would echo `[Patch evidence: ...]` back as
            // its own assistant text, which then persisted and surfaced
            // as raw text in the overlay UI (overlay only chips
            // structured patch parts, not text parts containing the
            // marker). Pair this with the system-prompt clause forbidding
            // restatement of <patch> evidence.
            assistantMessage.parts.push({
              type: "text",
              text: `<patch>${formatPatchEvidence(part)}</patch>`,
            })
          }
        }
        // Structural validity check for provider replay. The chat-completion
        // contract (OpenAI / DeepSeek / vLLM / etc.) requires every assistant
        // message to carry `content` or `tool_calls`. When a stream early-dies
        // â€” provider truncates the response after opening a reasoning block,
        // socket dies, model returns nothing â€” the persisted assistant turn
        // ends up with only [step-start, reasoning("")] and `finish=null,
        // error=null`. Replaying it serialises to {role:"assistant",
        // content:"", tool_calls:undefined}; the provider rejects with HTTP
        // 4xx. Before restart recovery became passive, `monitorRuns` kept
        // replaying the same broken history, burning a deterministic retry storm
        // (orchestrator-stream-error artifact loop, 2026-05-08, see
        // stream early-death retry-fuse contract).
        // step-start is dropped by the global filter below; reasoning alone
        // is not visible content for chat-completion providers, so neither
        // counts toward "message has something the provider can read".
        const hasProviderVisibleContent = assistantMessage.parts.some(
          (part) =>
            (part.type === "text" && typeof part.text === "string" && part.text.length > 0) ||
            (typeof part.type === "string" && part.type.startsWith("tool-")),
        )
        if (assistantMessage.parts.length > 0 && hasProviderVisibleContent) {
          result.push(assistantMessage)
        }
      }
    }

    const tools = Object.fromEntries(Array.from(toolNames).map((toolName) => [toolName, { toModelOutput }]))

    // Reasoning blocks intentionally pass through unchanged. An earlier
    // attempt stripped reasoning from every assistant message except the
    // last to "save context" â€” that miscarried (rule 14: æ€€ç–‘è‡ªå·±ï¼Œæ²¡
    // æ•°æ®æ”¯æ’‘å°±æ˜¯èƒ¡è¯´):
    //   1. Stripping reasoning from messages BEFORE the cache breakpoint
    //      (provider/transform.ts:applyCaching marks system[0], system[-1],
    //      messages[-2], messages[-1]) changes the cache-prefix bytes
    //      every turn â€” every request would cache-miss and pay full input
    //      price for the entire history. Anthropic 5-min cache hit is
    //      0.1Ã— input price; cache write is 1.25Ã— â€” even a 50%-reasoning
    //      history costs ~80% MORE under the strip strategy than under
    //      pass-through with cache hits.
    //   2. Anthropic's thinking + tool_use protocol requires the
    //      immediately-prior assistant's thinking blocks to remain when
    //      the current request is a tool_result follow-up; "last assistant"
    //      in our store may not coincide with that protocol position.
    // Net: pass-through wins on cost AND correctness. Don't strip.

    return await convertToModelMessages(
      result.filter((msg) => msg.parts.some((part) => part.type !== "step-start")),
      {
        //@ts-expect-error (convertToModelMessages expects a ToolSet but only actually needs tools[name]?.toModelOutput)
        tools,
      },
    )
  }

  export async function filterCompacted(stream: AsyncIterable<Message.WithParts>) {
    const result = [] as Message.WithParts[]
    const completed = new Map<string, { part: Message.CompactionPart; summaryID: string }>()
    let projectedCheckpointID: string | undefined
    let retain:
      | {
          tailID?: string
          anchorID?: string
          afterCompactionIndex: number
          tailSatisfied: boolean
        }
      | undefined
    for await (const msg of stream) {
      if (retain) {
        if (!retain.tailSatisfied) {
          result.push(msg)
          if (msg.info.id === retain.tailID) {
            if (msg.info.role !== "user") {
              result.splice(retain.afterCompactionIndex)
              retain = undefined
              break
            }
            retain.tailSatisfied = true
            if (!retain.anchorID || msg.info.id === retain.anchorID) {
              retain = undefined
              break
            }
          }
          continue
        }
        if (retain.anchorID && msg.info.id === retain.anchorID) {
          result.push(msg)
          retain = undefined
          break
        }
        continue
      }
      result.push(msg)
      if (msg.info.role === "user" && completed.has(msg.info.id)) {
        const checkpoint = completed.get(msg.info.id)!
        const part = checkpoint.part
        projectedCheckpointID = checkpoint.summaryID
        if (part.anchor_id === msg.info.id) {
          const markerIndex = result.length - 1
          const summaryIndex = result.findIndex(
            (candidate) =>
              candidate.info.role === "assistant" &&
              candidate.info.id === checkpoint.summaryID &&
              candidate.info.parentID === msg.info.id &&
              CompactionHandoff.isValidSummaryMessage(candidate.info),
          )
          if (summaryIndex < 0) break
          const newer = result.slice(0, summaryIndex)
          const summary = result[summaryIndex]!
          if (part.tail_start_id) {
            const tailIndex = result.findIndex((candidate) => candidate.info.id === part.tail_start_id)
            const tail = tailIndex >= 0 ? result[tailIndex] : undefined
            if (tail && tail.info.role === "user" && tailIndex > summaryIndex && tailIndex < markerIndex) {
              const tailBlock = result.slice(summaryIndex + 1, tailIndex + 1)
              result.splice(0, result.length, ...newer, ...tailBlock, summary, msg)
              break
            }
          }
          result.splice(0, result.length, ...newer, summary, msg)
          break
        }
        if (!part.tail_start_id && !part.anchor_id) {
          const summaryIndex = result.findIndex((candidate) => candidate.info.id === checkpoint.summaryID)
          if (summaryIndex < 0) break
          const newer = result.slice(0, summaryIndex)
          result.splice(0, result.length, ...newer, result[summaryIndex]!, msg)
          break
        }
        retain = {
          tailID: part.tail_start_id,
          anchorID: part.anchor_id,
          afterCompactionIndex: result.length,
          tailSatisfied: !part.tail_start_id,
        }
        continue
      }
      if (msg.info.role === "assistant" && CompactionHandoff.isValidSummaryMessage(msg.info)) {
        const part = msg.parts.find((item): item is Message.CompactionPart => item.type === "compaction")
        if (part && !completed.has(msg.info.parentID)) {
          completed.set(msg.info.parentID, { part, summaryID: msg.info.id })
        }
      }
    }
    if (retain && !retain.tailSatisfied) result.splice(retain.afterCompactionIndex)
    result.reverse()
    const markerIndex = projectedCheckpointID
      ? result.findIndex((msg) => msg.info.id === projectedCheckpointID)
      : -1
    if (markerIndex >= 0) {
      const marker = result[markerIndex]
      const part = marker.parts.find((item): item is Message.CompactionPart => item.type === "compaction")
      const anchorIndex = part?.anchor_id ? result.findIndex((msg) => msg.info.id === part.anchor_id) : -1
      if (
        anchorIndex >= 0 &&
        markerIndex > anchorIndex &&
        marker.info.role === "assistant" &&
        CompactionHandoff.isValidSummaryMessage(marker.info)
      ) {
        // The source user remains at its chronological request position. Move
        // only the append-only summary checkpoint beside the preserved anchor.
        const [summary] = result.splice(markerIndex, 1)
        result.splice(anchorIndex + 1, 0, summary!)
      }
      const anchorID = part?.anchor_id
      const projectedAnchorIndex = anchorID ? result.findIndex((message) => message.info.id === anchorID) : -1
      if (projectedAnchorIndex >= 0) {
        const anchor = result[projectedAnchorIndex]!
        const rawDescriptorRef = anchor.info.role === "user" ? anchor.info.extra?.workerTurnDescriptor : undefined
        const descriptorRef =
          rawDescriptorRef &&
          typeof rawDescriptorRef === "object" &&
          !Array.isArray(rawDescriptorRef) &&
          typeof (rawDescriptorRef as { id?: unknown }).id === "string" &&
          typeof (rawDescriptorRef as { hash?: unknown }).hash === "string"
            ? (rawDescriptorRef as { id: string; hash: string })
            : undefined
        const { WorkerTurnDescriptor } = await import("@/agent/worker-turn-descriptor")
        const latestDescriptor = WorkerTurnDescriptor.latestForSession(anchor.info.sessionID)
        const [{ taskIDForSession }, { findDispatchLineageBySession }] = await Promise.all([
          import("@/engine/task-session-lineage"),
          import("@/engine/dispatch-lineage"),
        ])
        const taskID = taskIDForSession(anchor.info.sessionID)
        const dispatchLineage = taskID
          ? findDispatchLineageBySession({ taskID, sessionID: anchor.info.sessionID })
          : undefined
        const failAuthority = (message: string): never => {
          throw new Message.CompactionTaskAuthorityError({
            message,
            sessionID: anchor.info.sessionID,
            anchorMessageID: anchor.info.id,
          })
        }
        if (descriptorRef || latestDescriptor || dispatchLineage) {
          const currentDescriptor =
            latestDescriptor ?? failAuthority("projected worker compaction Session has no current descriptor")
          const exactDescriptorRef =
            descriptorRef ?? failAuthority("projected worker compaction anchor has no descriptor reference")
          const descriptor =
            WorkerTurnDescriptor.get({ id: exactDescriptorRef.id, sessionID: anchor.info.sessionID }) ??
            failAuthority("projected worker compaction anchor descriptor does not exist")
          if (descriptor.hash !== exactDescriptorRef.hash) {
            failAuthority("projected worker compaction anchor descriptor hash does not match")
          }
          const authority =
            descriptor.payload.dispatchTurn?.task_authority ??
            failAuthority("projected worker compaction anchor descriptor has no Task authority")
          if (authority.initial_user_message_id !== anchor.info.id) {
            failAuthority("projected worker compaction anchor does not match persisted Task authority")
          }
          const currentAuthority = currentDescriptor.payload.dispatchTurn?.task_authority
          if (!currentAuthority || JSON.stringify(currentAuthority) !== JSON.stringify(authority)) {
            failAuthority("projected worker compaction anchor Task authority does not match the latest Turn descriptor")
          }
          const controlParts = new Map(authority.initial_control_text_parts.map((item) => [item.part_id, item]))
          const actualTextParts = anchor.parts.filter((item): item is Message.TextPart => item.type === "text")
          if (actualTextParts.length !== controlParts.size) {
            failAuthority("projected worker compaction text-Part set does not match persisted authority")
          }
          const projectedParts = anchor.parts.filter((item) => {
            if (item.type !== "text") return false
            const expected = controlParts.get(item.id)
            return expected?.text_sha256 === createHash("sha256").update(item.text).digest("hex")
          })
          if (projectedParts.length !== controlParts.size) {
            failAuthority("projected worker compaction control-text content does not match persisted authority")
          }
          result[projectedAnchorIndex] = { ...anchor, parts: projectedParts }
        }
      }
    }
    return result
  }

  export function fromError(e: unknown, ctx: { providerID: string }) {
    switch (true) {
      case e instanceof ExecutionCancellationError:
        return new Message.AbortedError(
          { message: e.message, cancellation: e.origin },
          {
            cause: e,
          },
        ).toObject()
      case e instanceof DOMException && e.name === "AbortError":
        return new Message.AbortedError(
          { message: e.message },
          {
            cause: e,
          },
        ).toObject()
      case Message.OutputLengthError.isInstance(e):
        return e
      case Message.StructuredOutputPayloadError.isInstance(e):
        return e.toObject()
      case Message.CompactionContinuationMissingError.isInstance(e):
        return e.toObject()
      case ModelImageInputTooLargeError.isInstance(e):
        return e.toObject()
      case SnapshotEmptyTreeError.isInstance(e):
        return e.toObject()
      case SnapshotIntegrityError.isInstance(e):
        return e.toObject()
      case LoadAPIKeyError.isInstance(e):
        return new Message.AuthError(
          {
            providerID: ctx.providerID,
            message: e.message,
          },
          { cause: e },
        ).toObject()
      case ProviderAuthRequiredError.isInstance(e):
        return new Message.AuthError(
          {
            providerID: e.data.providerID,
            message: e.data.message,
          },
          { cause: e },
        ).toObject()
      case (e as SystemError)?.code === "ECONNRESET":
        return new Message.APIError(
          {
            message: "Connection reset by server",
            isRetryable: true,
            metadata: {
              code: (e as SystemError).code ?? "",
              syscall: (e as SystemError).syscall ?? "",
              message: (e as SystemError).message ?? "",
            },
          },
          { cause: e },
        ).toObject()
      case APICallError.isInstance(e):
        const parsed = ProviderError.parseAPICallError({
          providerID: ctx.providerID,
          error: e,
        })
        if (parsed.type === "context_overflow") {
          return new Message.ContextOverflowError(
            {
              message: parsed.message,
              responseBody: parsed.responseBody,
            },
            { cause: e },
          ).toObject()
        }

        return new Message.APIError(
          {
            message: parsed.message,
            statusCode: parsed.statusCode,
            isRetryable: parsed.isRetryable,
            responseHeaders: parsed.responseHeaders,
            responseBody: parsed.responseBody,
            metadata: parsed.metadata,
          },
          { cause: e },
        ).toObject()
      case e instanceof Error && /LLM stream stalled|stream inactivity/i.test(e.message):
        return new Message.APIError(
          {
            message: e.message,
            isRetryable: true,
          },
          { cause: e },
        ).toObject()
      case e instanceof Error:
        return new NamedError.Unknown({ message: e.toString() }, { cause: e }).toObject()
      default:
        try {
          const parsed = ProviderError.parseStreamError(e)
          if (parsed) {
            if (parsed.type === "context_overflow") {
              return new Message.ContextOverflowError(
                {
                  message: parsed.message,
                  responseBody: parsed.responseBody,
                },
                { cause: e },
              ).toObject()
            }
            return new Message.APIError(
              {
                message: parsed.message,
                isRetryable: parsed.isRetryable,
                responseBody: parsed.responseBody,
              },
              {
                cause: e,
              },
            ).toObject()
          }
        } catch {}
        return new NamedError.Unknown({ message: JSON.stringify(e) }, { cause: e }).toObject()
    }
  }
}
