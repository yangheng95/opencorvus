import z from "zod"
import { InteractionUserInput } from "@/memory/interaction-user-input"
import { ProductPillarSchema } from "@opencorvus-ai/sdk/expert-squad-manifest-v2"
import {
  ArtifactCatalogEntrySchema,
  ArtifactCatalogProviderErrorSchema,
  ArtifactProducerSchema,
  ArtifactReadLocatorSchema,
  CrossTaskArtifactSourceListSchema,
  ArtifactReadLocatorListSchema,
  EngineArtifactLocatorSchema,
  EvidenceLocatorListSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { TaskArtifactRefSchema } from "@opencorvus-ai/plugin/task-artifact"
import {
  COMPOSER_FILE_ATTACHMENT_LIMIT,
  COMPOSER_FOLDER_ATTACHMENT_LIMIT,
  DIRECTORY_REFERENCE_MIME,
  VisibleComposerReferences,
} from "@opencorvus-ai/transport-protocol"
import { BusEvent } from "@/bus/bus-event"
import {
  TaskCancelledPayload,
  TaskCancellationProjection,
  TaskCancellationRequestedPayload,
  TASK_CANCELLATION_REQUESTED_EVENT_TYPE,
} from "@/engine/cancellation-origin"
import { ENGINE_ARTIFACT_KINDS } from "@/engine/engine.sql"
import { AGENT_COORDINATION_DECISIONS } from "@/engine/agent-coordination-decision"
import { Identifier } from "@/id/id"
import { MailboxAcknowledgementPayload, MailboxAgentMessagePayload } from "@/engine/mailbox-event"
import { Message } from "@/session/message"
import { PermissionDecision } from "@/permission/decision"
import { Answer as QuestionAnswer, Request as QuestionRequest } from "@/question/types"
import { isModelReference } from "@/provider/model-ref"
import { decodeRawBase64Payload } from "@/session/text-mime"
import { SESSION_KINDS } from "@/session/session.sql"
import { Todo } from "@/session/todo"
import { SelectedWorkflowBindingSchema } from "./workflow-binding"
import { ExpertSquadPackageRevisionBindingSchema } from "./expert-squad-package-revision-binding"
import { CheckConfig } from "./check-config"
export { CheckConfig, NamedCheckConfig, NamedCheckFamily } from "./check-config"

export const Budget = z.object({
  maxExecutorGroups: z.number().int().positive().optional(),
})

export const ChannelBinding = z.object({
  platform: z.string(),
  channel: z.string(),
  thread: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
})

export const GoalKind = z.enum(["bootstrap", "feature", "verification", "integration", "system"])

import { AcceptanceSpecSchema } from "@/acceptance/types"

/**
 * API-boundary attachment payload. Callers that cannot upload out-of-band (HTTP
 * clients, benchmark scripts, channel ingress) send the raw bytes base64-encoded.
 * The orchestrator decodes them exactly once at task-creation time, writes them
 * to AttachmentStore, and never carries base64 further into the system.
 */
export const UserUploadBytesInput = z
  .object({
    /** MIME type, e.g. "image/png", "application/pdf", "audio/mpeg" */
    mime: z.string().min(1),
    /** Base64-encoded file bytes (no data-URL prefix) */
    data: z.string(),
    /** Optional display name shown in the overlay message and LLM file part */
    filename: z.string().optional(),
  })
  .strict()
  .superRefine((attachment, ctx) => {
    try {
      decodeRawBase64Payload(attachment.data, `attachment ${attachment.filename ?? attachment.mime}`)
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["data"],
        message: error instanceof Error ? error.message : String(error),
      })
    }
  })

const UserUploadReferenceInput = z
  .object({
    /** Canonical reference returned by POST /attachment. */
    url: z.string().regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/),
    mime: z.string().min(1),
    filename: z.string().optional(),
  })
  .strict()

/**
 * User upload ingress has one durable destination: AttachmentStore. Clients
 * that already uploaded bytes carry its canonical reference; external API
 * callers without an upload session may carry base64 bytes for immediate
 * materialization at the same boundary.
 */
export const UserUploadInput = z.union([UserUploadReferenceInput, UserUploadBytesInput])

function userUploadList<T extends z.ZodType<{ mime: string }>>(item: T) {
  return item
    .array()
    .max(COMPOSER_FILE_ATTACHMENT_LIMIT + COMPOSER_FOLDER_ATTACHMENT_LIMIT)
    .superRefine((attachments, ctx) => {
      const folderCount = attachments.filter((attachment) => attachment.mime === DIRECTORY_REFERENCE_MIME).length
      const fileCount = attachments.length - folderCount
      if (fileCount > COMPOSER_FILE_ATTACHMENT_LIMIT) {
        ctx.addIssue({
          code: "custom",
          message: `No more than ${COMPOSER_FILE_ATTACHMENT_LIMIT} file attachments are allowed`,
        })
      }
      if (folderCount > COMPOSER_FOLDER_ATTACHMENT_LIMIT) {
        ctx.addIssue({
          code: "custom",
          message: `No more than ${COMPOSER_FOLDER_ATTACHMENT_LIMIT} folder attachments are allowed`,
        })
      }
    })
}

export const UserUploadList = userUploadList(UserUploadInput)

/**
 * A one-call ingress that allocates its Project cannot consume a previously
 * uploaded project-owned reference because that Project does not exist yet.
 * It accepts inline bytes only and materializes them after allocation.
 */
export const UserUploadBytesList = userUploadList(UserUploadBytesInput)

/**
 * Persisted attachment reference. Once the bytes live in AttachmentStore
 * (`<projectDir>/.opencorvus/.r/project/attachments/<sha>.<ext>`), every downstream layer
 * — Provider execution row, task loop, orchestrator, frontend-design, requirements — only
 * carries this small, URL-addressable reference. Agents that need the raw
 * bytes for multimodal LLM input read them back through AttachmentStore.
 *
 * Uploads are neutral task inputs. Domain consumers assign semantics through
 * their own explicit contracts, such as frontend_design attachment bindings;
 * MIME and filename never promote an upload into visual authority.
 */
const TaskAttachment = z.object({
  /** sha256 hex digest of the file bytes */
  sha: z.string(),
  /** Server-relative URL the overlay (and AI SDK) can GET to fetch the bytes */
  url: z.string(),
  /** MIME type, preserved from the original upload */
  mime: z.string(),
  /** Byte length of the stored file */
  size: z.number().int().nonnegative(),
  /** Optional display name shown in the overlay message */
  filename: z.string().optional(),
  intent: z.literal("task_input"),
  source: z.literal("user-upload"),
})

export const CreateTaskInput = z
  .object({
    project: z.string().optional(),
    /**
     * Canonical execution repository for this Task. The Task remains owned by
     * the caller's durable project namespace, while every Session and tool cwd
     * is bound to this exact registered directory.
     */
    directory: z.string().trim().min(1).optional(),
    requestID: z.string().trim().min(1).optional(),
    artifactSources: CrossTaskArtifactSourceListSchema.optional(),
    source: z.string().optional(),
    productPillar: ProductPillarSchema,
    model: z
      .string()
      .refine(isModelReference, {
        message: 'Model must be in the format "provider/model".',
      })
      .optional(),
    title: z.string().optional(),
    request: z.string(),
    /** File attachments (images / PDF / text / audio / video). The preferred
     *  form is the canonical URL returned by POST /attachment. External API
     *  callers may still submit raw base64, which is materialized once at this
     *  boundary; every downstream layer uses references. */
    attachments: UserUploadList.optional(),
    // User-facing priority metadata. It affects Work Ledger presentation; it
    // does not grant Host scheduling authority over Task execution.
    priority: z.enum(["critical", "high", "normal", "low"]).optional(),
    promptProfile: z.string().min(1).optional(),
    expectedPackageDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    budget: Budget.optional(),
    checks: CheckConfig.optional(),
    channelBinding: ChannelBinding.optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict()

export const Task = z.object({
  id: Identifier.schema("task"),
  orderKey: z.string().min(1),
  projectID: z.string(),
  directory: z.string().optional(),
  sessionID: Identifier.schema("session").nullable().optional(),
  requestID: z.string().optional(),
  source: z.string(),
  productPillar: ProductPillarSchema,
  title: z.string(),
  request: z.string(),
  status: z.enum(["active", "completed", "failed", "cancelled"]),
  terminalReason: z.enum(["completed", "failed", "cancelled", "interrupted"]).optional(),
  cancellation: TaskCancellationProjection.optional(),
  priority: z.enum(["critical", "high", "normal", "low"]),
  packageRevisionBinding: ExpertSquadPackageRevisionBindingSchema,
  blockingReason: z.string().optional(),
  error: z.string().optional(),
  completionDecision: z
    .object({
      artifactLocator: EngineArtifactLocatorSchema,
      orchestratorSessionID: Identifier.schema("session"),
      orchestratorMessageID: Identifier.schema("message"),
      toolCallID: z.string().min(1),
      toolPartID: Identifier.schema("part"),
      evidenceLocators: EvidenceLocatorListSchema,
      deliverableArtifactLocators: ArtifactReadLocatorListSchema,
      acceptedDeliverySliceRevisionIDs: z.array(Identifier.schema("goal")),
      workflowBinding: SelectedWorkflowBindingSchema,
      timeRecorded: z.number(),
    })
    .optional(),
  budget: Budget.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  /** Persisted attachment references carried from task creation. */
  attachments: TaskAttachment.array().optional(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
    started: z.number(),
    completed: z.number().optional(),
    archived: z.number().optional(),
  }),
})

export const TaskListTask = Task.pick({
  id: true,
  orderKey: true,
  projectID: true,
  directory: true,
  sessionID: true,
  requestID: true,
  source: true,
  productPillar: true,
  title: true,
  status: true,
  terminalReason: true,
  priority: true,
  packageRevisionBinding: true,
  time: true,
})

export const Goal = z.object({
  id: Identifier.schema("goal"),
  taskID: Identifier.schema("task"),
  requirementSetArtifactLocator: EngineArtifactLocatorSchema.optional(),
  contractGraphArtifactLocator: EngineArtifactLocatorSchema.optional(),
  supersedeOf: Identifier.schema("goal").nullable().optional(),
  title: z.string(),
  objective: z.string(),
  acceptance_specs: AcceptanceSpecSchema.array(),
  owned_paths: z.array(z.string()),
  kind: z.string(),
  priority: z.enum(["blocking", "advisory"]),
  source: z.string(),
  orderIndex: z.number().int(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
  }),
})

export const Interaction = z.object({
  id: Identifier.schema("interaction"),
  taskID: Identifier.schema("task"),
  orderKey: z.string().min(1),
  responseOrderKey: z.string().min(1).optional(),
  sessionID: Identifier.schema("session").nullable().optional(),
  externalID: z.string(),
  type: z.enum(["permission", "question"]),
  status: z.enum(["pending", "answered", "rejected", "expired"]),
  title: z.string(),
  body: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
  response: z.record(z.string(), z.any()).optional(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
    resolved: z.number().optional(),
  }),
})

export const Artifact = z.object({
  id: Identifier.schema("artifact"),
  taskID: Identifier.schema("task"),
  locator: EngineArtifactLocatorSchema,
  kind: z.enum(ENGINE_ARTIFACT_KINDS),
  label: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
  }),
})

const ProgressSnapshot = z.object({
  id: Identifier.schema("progress"),
  taskID: Identifier.schema("task"),
  status: z.enum(["created", "active", "completed", "failed", "cancelled"]),
  summary: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
  }),
})

/** Session prompts physically owned by this process for one Task. */
export const OwnedPromptSession = z.object({
  sessionID: Identifier.schema("session"),
  kind: z.string(),
  lastActivityMs: z.number(),
})

export const ReplyInteractionInput = z.object({
  decision: PermissionDecision.optional(),
  autoReply: z.boolean(),
  message: z.string().optional(),
  answers: z.array(QuestionAnswer).optional(),
})

export const RejectInteractionInput = z.object({
  autoReply: z.boolean(),
  message: z.string().optional(),
})

export const UserReplyInteractionInput = ReplyInteractionInput.omit({ autoReply: true }).extend({
  userInput: InteractionUserInput,
})

export const UserRejectInteractionInput = RejectInteractionInput.omit({ autoReply: true }).extend({
  userInput: InteractionUserInput,
})

export const UpdateGoalTitleInput = z
  .object({
    title: z.string().min(1),
  })
  .strict()

export const GoalMutationResult = z
  .object({
    goalID: Identifier.schema("goal"),
    supersedeOf: Identifier.schema("goal").optional(),
    goalGraphProjectionArtifactLocator: EngineArtifactLocatorSchema,
  })
  .strict()

export const ReplaceGoalContractInput = z
  .object({
    title: z.string().min(1),
    acceptance_specs: z.array(AcceptanceSpecSchema).min(1),
  })
  .strict()

export const UpdateTaskChecksInput = z
  .object({
    checks: CheckConfig,
  })
  .strict()

export const TaskAccepted = z.object({
  task_id: Identifier.schema("task"),
  project_id: z.string().min(1),
  directory: z.string().min(1),
})

export const TaskMessageInput = z
  .object({
    text: z.string(),
    source: z.string().min(1),
    model: z
      .string()
      .refine(isModelReference, {
        message: 'Model must be in the format "provider/model".',
      })
      .optional(),
    user_id: z.string().optional(),
    attachments: UserUploadList.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    /** Overlay bridge envelope fields. They identify how a rendered message was
     *  displayed, not what the operator asked. The task service accepts them so
     *  replay/resume clients can reuse bridge-stamped message objects, but task
     *  semantics still come only from `text`, `source`, `user_id`, and
     *  `attachments`. */
    resolvedRole: z.string().optional(),
    channel: z.string().optional(),
  })
  .strict()

export const InjectMessageInput = z.object({
  message: z.string().min(1),
})

const TaskMessageUserInfo = z.lazy(() =>
  Message.User.extend({
    orderKey: z.string().min(1),
    resolvedRole: z.string().min(1),
    channel: z.string().min(1),
    agentID: z.string().min(1),
    sessionAgentID: z.string().min(1),
    originSource: z.string(),
  }).meta({
    ref: "TaskMessageUserInfo",
  }),
)
const TaskMessageUserPart = z.lazy(() =>
  Message.Part.and(
    z.object({
      orderKey: z.string().min(1),
    }),
  ).meta({
    ref: "TaskMessageUserPart",
  }),
)
const MessageVisibleWithPartsArray = z.lazy(() => Message.VisibleWithParts.array())

export const TaskMessageResult = z.object({
  message: z.string(),
  wake_status: z.enum(["accepted", "not_woken"]),
  ingress_id: Identifier.schema("artifact").optional(),
  /** The persisted user `Message` row + parts the server just wrote.
   *  Returned so the overlay can insert the real message into its store
   *  immediately (no client-side synthetic placeholder; rule 22). The
   *  subsequent SSE `message.updated` / `message.part.updated` events
   *  carry the same ids and idempotently update the same rows. Absent
   *  when the task has no session_id (e.g. failed task short-circuit). */
  user_message: z
    .object({
      info: TaskMessageUserInfo,
      parts: z.array(TaskMessageUserPart),
    })
    .optional(),
})

export const TaskOperatorModelContext = z.object({
  taskID: Identifier.schema("task"),
  sessionID: Identifier.schema("session"),
  agent: z.string(),
  model: z.object({
    providerID: z.string(),
    modelID: z.string(),
  }),
})

export const TaskBrief = z.object({
  content: z.string(),
  goals: z.array(
    z.object({
      description: z.string(),
      criteria: z.string(),
    }),
  ),
})

export const TaskChannelBinding = z.object({
  id: z.string(),
  platform: z.string(),
  channel: z.string(),
  thread: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
  }),
})

export const TaskBoardFailure = z.object({
  source: z.enum(["task", "interaction"]),
  title: z.string(),
  summary: z.string(),
})

export const TaskBoardNextStep = z.object({
  kind: z.enum(["resolve_blocker", "observe", "review_acceptance", "message"]),
  title: z.string(),
  detail: z.string().optional(),
})

export const TaskBoardOverview = z.object({
  headline: z.string(),
  summary: z.string(),
  currentFailure: TaskBoardFailure.optional(),
  nextStep: TaskBoardNextStep,
  controls: z.object({
    canCancel: z.boolean(),
  }),
})

export const TaskBoardRequirement = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(["explicit", "inferred", "system"]),
  priority: z.enum(["blocking", "advisory"]),
  acceptance: z.object({
    accepted: z.boolean(),
    claimingDeliverySliceRevisionIDs: z.array(Identifier.schema("goal")),
    acceptedDeliverySliceRevisionIDs: z.array(Identifier.schema("goal")),
    completionDecisionArtifactID: Identifier.schema("artifact").optional(),
  }),
})

export const TaskBoardArchitect = z.object({
  summary: z.string(),
  contractCount: z.number(),
  categories: z.array(z.string()),
  decisions: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
        reason: z.string(),
        goalID: z.string().nullable(),
      }),
    )
    .optional(),
})

export const TaskBoardDeliverySliceActivity = z.object({
  sessionIDs: z.array(Identifier.schema("session")),
  activeSessionIDs: z.array(Identifier.schema("session")),
  evidenceArtifactIDs: z.array(Identifier.schema("artifact")),
})

export const TaskBoardDeliverySliceReviewAssociation = z.object({
  artifactID: Identifier.schema("artifact"),
  deliverySliceRevisionID: Identifier.schema("goal"),
  judgment: z.enum(["accepted", "rejected", "inconclusive"]),
})

export const TaskBoardDeliverySliceAcceptance = z.object({
  accepted: z.boolean(),
  completionDecisionArtifactID: Identifier.schema("artifact").optional(),
})

export const TaskBoardGoal = z.object({
  goalID: z.string(),
  deliverySliceID: Identifier.schema("goal"),
  deliverySliceRevisionID: Identifier.schema("goal"),
  revision: z.number().int().positive(),
  priorRevisionID: Identifier.schema("goal").optional(),
  orderKey: z.string().min(1),
  goalTitle: z.string(),
  goalObjective: z.string().optional(),
  kind: z.string(),
  ownedPaths: z.array(z.string()),
  activity: TaskBoardDeliverySliceActivity,
  reviewAssociations: TaskBoardDeliverySliceReviewAssociation.array(),
  acceptance: TaskBoardDeliverySliceAcceptance,
  orderIndex: z.number().int(),
  priority: z.enum(["blocking", "advisory"]),
  acceptanceSpecs: AcceptanceSpecSchema.array().optional(),
  /** Build observations attributed through exact dispatch lineage and owned paths. */
  contribution: z.object({
    observationArtifactIDs: z.array(Identifier.schema("artifact")),
    sessionIDs: z.array(Identifier.schema("session")),
    files: z.array(
      z.object({
        file: z.string().min(1),
        status: z.string().min(1),
        additions: z.number().int().nonnegative(),
        deletions: z.number().int().nonnegative(),
        isBinary: z.boolean(),
      }),
    ),
    contributionCommitRefs: z.array(z.string().min(1)),
    publishedCommitRefs: z.array(z.string().min(1)),
    diffRefs: z.array(
      z.object({
        base: z.string().min(1),
        head: z.string().min(1),
      }),
    ),
  }),
})

export const TaskBoardProcessIncident = z.object({
  id: z.string().min(1),
  source: z.enum(["session_stream", "execution_lifecycle", "infrastructure"]),
  sessionID: Identifier.schema("session").optional(),
  inputMessageID: Identifier.schema("message").optional(),
  processOccurrenceID: z.string().min(1).optional(),
  affectedExecutions: z
    .array(
      z.object({
        sessionID: Identifier.schema("session"),
        inputMessageID: Identifier.schema("message").optional(),
      }),
    )
    .optional(),
  errorName: z.string().min(1),
  message: z.string().optional(),
  assistantMessageID: Identifier.schema("message").optional(),
  emittedAt: z.number().int().positive(),
})

export const AgentInvocationStatus = z.object({
  type: z.string(),
  reason: z.string().optional(),
  error: z.string().optional(),
  emittedAt: z.number(),
})

export const AgentInvocationNode = z.object({
  sessionID: z.string(),
  orderKey: z.string().min(1),
  agent: z.string(),
  kind: z.enum(SESSION_KINDS),
  title: z.string().optional(),
  parentSessionID: z.string().optional(),
  parentAgentSessionID: z.string().optional(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
  }),
})

export const AgentInvocationEdge = z.object({
  fromSessionID: z.string(),
  toSessionID: z.string(),
  relation: z.literal("agent_call"),
  viaSessionIDs: z.array(z.string()).optional(),
})

export const SessionInvocationTopology = z.object({
  taskID: Identifier.schema("task"),
  rootSessionID: z.string().optional(),
  nodes: AgentInvocationNode.array(),
  edges: AgentInvocationEdge.array(),
  topLevelSessionIDs: z.array(z.string()),
})

export const AgentExecutionLifecycleEvent = z.object({
  eventID: Identifier.schema("protocol_event"),
  sequence: z.number().int().positive(),
  status: AgentInvocationStatus.omit({ emittedAt: true }),
  emittedAt: z.number().int().positive(),
})

export const AgentExecutionOccurrence = z.object({
  inputMessageID: Identifier.schema("message"),
  sessionID: Identifier.schema("session"),
  agent: z.string().min(1),
  kind: z.enum(SESSION_KINDS),
  preparedAt: z.number().int().positive().optional(),
  events: AgentExecutionLifecycleEvent.array(),
  latest: AgentExecutionLifecycleEvent.optional(),
})

export const TaskExecutionProjection = z.object({
  taskID: Identifier.schema("task"),
  occurrences: AgentExecutionOccurrence.array(),
})

export const TaskRootIngressReducerProjection = z.union([
  z.object({
    state: z.literal("host_fault"),
    reason: z.enum([
      "evidence_violation",
      "policy_drift",
      "decision_ambiguous",
      "outcome_ambiguous",
      "turn_without_activation",
      "interaction_ambiguous",
    ]),
  }),
  z.object({
    state: z.literal("exhausted"),
    reason: z.enum(["semantic_limit", "activation_limit", "deadline"]),
  }),
  z.object({
    state: z.literal("terminal_inapplicable"),
    boundary: z.enum(["cancelled", "closed", "reopened", "deleted"]),
  }),
  z.object({ state: z.literal("resolved"), decisionIDs: z.array(z.string()) }),
  z.object({
    state: z.literal("leased"),
    activationID: z.string(),
    ownerOccurrenceID: z.string(),
    expiresAt: z.number().int(),
  }),
  z.object({ state: z.literal("reconcile_required"), requestIDs: z.array(z.string()) }),
  z.object({ state: z.literal("waiting"), interactionID: z.string(), resumeAt: z.number().int().optional() }),
  z.object({ state: z.literal("cancelling"), requestEventID: z.string() }),
  z.object({ state: z.literal("ready") }),
])

export const TaskRootIngressDebugEntry = z.object({
  ingressID: z.string(),
  source: z.enum(["message", "protocol_event", "automation_run", "engine_artifact", "task", "inline"]),
  sourceID: z.string(),
  executionEpoch: z.number().int().positive(),
  sequence: z.number().int().positive(),
  acceptedAt: z.number().int(),
  activationIDs: z.array(z.string()),
  activations: z.array(
    z.object({
      activationID: z.string(),
      ownerOccurrenceID: z.string(),
      activatedAt: z.number().int(),
      expiresAt: z.number().int(),
    }),
  ),
  semanticTurnIDs: z.array(z.string()),
  decisionGapStepIDs: z.array(z.string()),
  semanticAttemptIDs: z.array(z.string()),
  decisions: z.array(
    z.object({
      receiptID: z.string(),
      assistantMessageID: z.string(),
      command: z.string(),
    }),
  ),
  projection: TaskRootIngressReducerProjection,
})

export const TaskRootIngressDebugProjection = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), entries: TaskRootIngressDebugEntry.array() }),
  z.object({ status: z.literal("unavailable"), error: z.string().min(1) }),
])

// ---------------------------------------------------------------------------
// TaskBoard — full board projection
// ---------------------------------------------------------------------------

export const TaskProject = z.object({
  id: z.string(),
  name: z.string().optional(),
  worktree: z.string(),
})

export const TaskBoard = z.object({
  lastSequence: z.number().optional(),
  snapshotVersion: z.string().min(1),
  task: Task,
  project: TaskProject.optional(),
  interactions: Interaction.array(),
  channels: TaskChannelBinding.array(),
  artifacts: Artifact.array(),
  sessionInvocationTopology: SessionInvocationTopology,
  executionProjection: TaskExecutionProjection,
  /** Append-only process failures; independent from each Session's latest status. */
  processIncidents: TaskBoardProcessIncident.array(),
  overview: TaskBoardOverview,
  brief: z.object({
    content: z.string(),
    updated_at: z.number(),
  }),

  /** Structured requirements from Requirements Agent output */
  requirements: TaskBoardRequirement.array().optional(),
  /** Architect Agent consensus summary */
  architect: TaskBoardArchitect.optional(),
  /** Current Delivery Slice revisions with independent fact facets. */
  goals: TaskBoardGoal.array(),
})

export const Progress = z.object({
  task: Task,
  goals: TaskBoardGoal.array(),
  pendingInteractions: Interaction.array(),
  snapshots: ProgressSnapshot.array(),
  ownedPromptSessions: OwnedPromptSession.array(),
})

export const ProjectTaskSummary = z.object({
  task: TaskListTask,
  project: TaskProject.nullable().optional(),
  owned_prompt_sessions: OwnedPromptSession.array(),
  pending_interactions: z.number().int(),
  pending_interaction_items: Interaction.array(),
  updated_at: z.number(),
})

export const TaskListSummary = z.object({
  total_tasks: z.number().int(),
  open_tasks: z.number().int(),
  running_tasks: z.number().int(),
  blocked_tasks: z.number().int(),
  completed_tasks: z.number().int(),
  failed_tasks: z.number().int(),
  cancelled_tasks: z.number().int(),
  median_completion_ms: z.number().int().optional(),
})

export const ProjectBoard = z.object({
  project: TaskProject,
  summary: TaskListSummary,
  tasks: ProjectTaskSummary.array(),
})

export const GlobalTaskBoard = z.object({
  summary: TaskListSummary,
  tasks: ProjectTaskSummary.array(),
})

export const TaskEvent = z.object({
  event_id: Identifier.schema("protocol_event"),
  task_id: Identifier.schema("task"),
  orderKey: z.string().min(1),
  source: z.string().min(1),
  session_id: Identifier.schema("session").optional(),
  correlation_id: z.string().min(1).optional(),
  causation_id: Identifier.schema("protocol_event").optional(),
  type: z.string(),
  emittedAt: z.number().int().positive(),
  timestamp: z.number(),
  sequence: z.number().int().nonnegative().optional(),
  live_sequence: z.number().int().positive().optional(),
  live_epoch: z.number().int().positive().optional(),
  summary: z.string(),
  payload: z.record(z.string(), z.any()),
  notify: BusEvent.NotifyDescriptorSchema.optional(),
})

export const TaskConversationAgentActivityItem = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    messageID: z.string().min(1),
    orderKey: z.string().min(1),
    type: z.literal("text"),
    text: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    messageID: z.string().min(1),
    orderKey: z.string().min(1),
    type: z.literal("tool"),
    tool: z.string().min(1),
    callID: z.string().min(1).optional(),
    state: z.record(z.string(), z.unknown()),
  }),
  z.object({
    id: z.string().min(1),
    messageID: z.string().min(1),
    orderKey: z.string().min(1),
    type: z.literal("patch"),
    files: z.array(z.unknown()),
  }),
  z.object({
    id: z.string().min(1),
    messageID: z.string().min(1),
    orderKey: z.string().min(1),
    type: z.literal("file"),
    filename: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    messageID: z.string().min(1),
    orderKey: z.string().min(1),
    type: z.literal("part-error"),
    title: z.string().min(1).optional(),
    message: z.string().min(1),
  }),
])

const TaskConversationSessionViewBase = z.object({
  sessionID: z.string(),
  agentID: z.string(),
  orderKey: z.string().min(1),
  stage: z.string(),
  parentSessionID: z.string().optional(),
  messageIDs: z.array(z.string()),
  lastDisplayMessageID: z.string().optional(),
  firstMessageTime: z.number(),
  lastMessageTime: z.number(),
  firstObservedAt: z.number().optional(),
  lastObservedAt: z.number().optional(),
  status: z.enum(["pending", "running", "idle", "completed", "error", "skipped"]).optional(),
  activity: TaskConversationAgentActivityItem.array(),
  todos: Todo.Info.array(),
  todoUpdatedAt: z.number().int().nonnegative(),
  errorReason: z.string().min(1).optional(),
  inputPreview: z
    .object({
      text: z.string(),
      messageID: z.string(),
      observedAt: z.number(),
      source: z.literal("user_message"),
    })
    .optional(),
  placement: z.literal("top_level"),
})

export const TaskConversationSessionView = z.union([
  TaskConversationSessionViewBase.extend({
    executionID: Identifier.schema("message"),
    inputMessageID: Identifier.schema("message"),
  })
    .strict()
    .refine((value) => value.executionID === value.inputMessageID, {
      message: "executionID must equal the canonical inputMessageID occurrence identity",
      path: ["executionID"],
    }),
  TaskConversationSessionViewBase.strict(),
])

export const TaskConversationMessageView = z.object({
  messageID: z.string(),
  inputMessageID: Identifier.schema("message"),
  orderKey: z.string().min(1),
  sessionID: z.string(),
  sessionAgentID: z.string(),
  agentID: z.string(),
  stage: z.string(),
  parentSessionID: z.string().optional(),
  time: z.number(),
  placement: z.literal("top_level"),
})

export const TaskConversationView = z.object({
  topLevelSessionIDs: z.array(z.string()),
  sessions: TaskConversationSessionView.array(),
  messages: TaskConversationMessageView.array(),
})

export const TaskConversationAgentView = z.object({
  topLevelExecutionIDs: z.array(Identifier.schema("message")),
  sessions: TaskConversationSessionView.array(),
  messages: TaskConversationMessageView.array(),
})

export const ConversationTurnArtifactSummary = z
  .object({
    messageID: Identifier.schema("message"),
    userMessageID: Identifier.schema("message"),
    task: z
      .object({
        id: Identifier.schema("task"),
        title: z.string(),
        status: z.enum(["completed", "failed", "cancelled"]),
        reason: z.string().optional(),
      })
      .strict(),
    declaredOutputs: z.array(
      z
        .object({
          declarationLocator: ArtifactReadLocatorSchema,
          producer: ArtifactProducerSchema.nullable(),
          label: z.string(),
          artifactType: z.string().optional(),
          resources: TaskArtifactRefSchema.array(),
        })
        .strict(),
    ),
    entries: ArtifactCatalogEntrySchema.array(),
    catalogComplete: z.boolean(),
    providerErrors: ArtifactCatalogProviderErrorSchema.array(),
  })
  .strict()

export const TaskConversationEventReplay = z.object({
  cursor: z.number().int().nonnegative(),
  latestSequence: z.number().int().nonnegative(),
  complete: z.boolean(),
  limit: z.number().int().positive(),
  sinceTimestamp: z.number().nullable().optional(),
})

export const TaskConversationHistoryState = z.object({
  oldestTimestamp: z.number().nullable(),
  oldestOrderKey: z.string().nullable(),
  oldestMessageID: z.string().nullable().optional(),
  hasMore: z.boolean(),
  limit: z.number().int().positive(),
})

export const TaskConversationHydration = z.object({
  lastSequence: z.number().int().nonnegative(),
  board: TaskBoard,
  transcript: MessageVisibleWithPartsArray,
  events: TaskEvent.array(),
  eventReplay: TaskConversationEventReplay,
  history: TaskConversationHistoryState,
  agentView: TaskConversationAgentView,
  view: TaskConversationView,
  turnArtifacts: ConversationTurnArtifactSummary.array(),
})

export const SessionBoardEnvelope = z.object({
  kind: z.literal("session"),
  sessionID: z.string(),
  status: z.string(),
  composerReferences: VisibleComposerReferences,
  title: z.string().nullable().optional(),
  directory: z.string().nullable().optional(),
  selectedTaskID: z.string().nullable().optional(),
  changes: z.array(
    z.object({
      file: z.string(),
      before: z.string().optional(),
      after: z.string().optional(),
      additions: z.number(),
      deletions: z.number(),
      status: z.enum(["added", "deleted", "modified"]).optional(),
    }),
  ),
})

export const SessionPendingQuestion = QuestionRequest.extend({
  orderKey: z.string().min(1),
})

const SessionEventEnvelope = z.object({
  event_id: z.string(),
  session_id: z.string(),
  orderKey: z.string().min(1),
  emittedAt: z.number().int().positive(),
  timestamp: z.number(),
  sequence: z.number().int().nonnegative().optional(),
  summary: z.string(),
  notify: BusEvent.NotifyDescriptorSchema.optional(),
})

export const SessionEvent = SessionEventEnvelope.extend({
  type: z.string(),
  payload: z.record(z.string(), z.any()),
})

export const SessionConversationConnectionSnapshot = z
  .object({
    transcript: z.array(
      z.object({
        info: z.intersection(
          Message.VisibleInfo,
          z.object({
            channel: z.string(),
            resolvedRole: z.string(),
            agentID: z.string(),
            sessionAgentID: z.string(),
            originSource: z.string(),
            parentSessionID: z.string().optional(),
            participantEvidence: z.any().optional(),
          }),
        ),
        parts: z.array(Message.VisiblePart),
      }),
    ),
    view: TaskConversationView,
    history: TaskConversationHistoryState,
  })
  .meta({ ref: "SessionConversationConnectionSnapshot" })

export const SessionConnectedEvent = SessionEventEnvelope.extend({
  type: z.literal("session.connected"),
  payload: z.object({
    sessionID: z.string(),
    conversationSnapshot: SessionConversationConnectionSnapshot,
  }),
}).meta({ ref: "SessionConnectedEvent" })

export const SessionProtocolEventType = z.enum([
  "agent.execution.lifecycle",
  "config.changed",
  "message.updated",
  "message.moved",
  "message.removed",
  "message.part.updated",
  "message.part.delta",
  "message.part.removed",
  "permission.asked",
  "permission.replied",
  "question.asked",
  "question.replied",
  "question.rejected",
  "question.expired",
  "question.abandoned",
  "session.diff",
  "session.error",
  "session.heartbeat",
])

export const SessionProtocolEvent = SessionEventEnvelope.extend({
  type: SessionProtocolEventType,
  payload: z.record(z.string(), z.any()),
}).meta({ ref: "SessionProtocolEvent" })

export const SessionStreamEvent = z
  .discriminatedUnion("type", [SessionConnectedEvent, SessionProtocolEvent])
  .meta({ ref: "SessionStreamEvent" })

export const SessionConversationHydration = z.object({
  board: SessionBoardEnvelope,
  pendingQuestions: SessionPendingQuestion.array(),
  transcript: MessageVisibleWithPartsArray,
  events: SessionEvent.array(),
  history: TaskConversationHistoryState,
  agentView: TaskConversationAgentView,
  view: TaskConversationView,
  turnArtifacts: ConversationTurnArtifactSummary.array(),
})

export const SessionConversationHistoryPage = z.object({
  transcript: MessageVisibleWithPartsArray,
  events: SessionEvent.array(),
  view: TaskConversationView,
  history: TaskConversationHistoryState,
})

export const TaskConversationEventPage = z.object({
  events: TaskEvent.array(),
  eventReplay: TaskConversationEventReplay,
})

export const TaskConversationHistoryPage = z.object({
  transcript: MessageVisibleWithPartsArray,
  events: TaskEvent.array(),
  view: TaskConversationView,
  history: TaskConversationHistoryState,
})

export const TaskConversationSessionPage = TaskConversationHistoryPage.extend({
  removedMessageIDs: z.array(Identifier.schema("message")),
  lastLiveSequence: z.number().int().nonnegative(),
  liveEpoch: z.number().int().nonnegative(),
  transcriptMode: z.enum(["snapshot", "delta"]),
})

export const AgentSessionOperatorSteerInput = z
  .object({
    message: z.string().trim().min(1),
  })
  .strict()

export const AgentSessionOperatorSteerResult = z.object({
  task_id: Identifier.schema("task"),
  session_id: Identifier.schema("session"),
  request_id: Identifier.schema("artifact"),
  wake_status: z.literal("accepted"),
})

export const AgentSessionCancelResult = z.object({
  task_id: Identifier.schema("task"),
  session_id: Identifier.schema("session"),
  cancelled: z.boolean(),
})

/** AgentTrace event surfaced to the overlay debug panel. Shape mirrors what
 *  the trace JSONL writer persists; payload is open-ended (`record<string, any>`)
 *  because llm_request / agent_turn / helper_llm_call carry different
 *  fields and the UI renders them with kind-aware components. */
export const TraceEvent = z.object({
  ts: z.number(),
  kind: z.string(),
  sessionID: z.string().optional(),
  parentSessionID: z.string().optional(),
  taskID: z.string().optional(),
  agentName: z.string().optional(),
  agentMode: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
})

export const TraceEventList = z.object({
  ok: z.literal(true),
  events: TraceEvent.array(),
  /** Resolved trace directory the server reads from. Surfaced so the overlay's
   *  empty state can show the operator WHICH directory was scanned — the
   *  "events:[]" failure mode otherwise hides a path mismatch (e.g. overlay
   *  bound to project root while agents wrote traces in a benchmark temp dir
   *  via OPENCORVUS_AGENT_TRACE_DIR override). */
  traceDir: z.string(),
  /** Whether AgentTrace.isEnabled() returned true. False = no traces are
   *  being written regardless of dir resolution; OPENCORVUS_AGENT_TRACE=0
   *  was set on the server process. */
  enabled: z.boolean(),
})

export const ArtifactAudit = z.object({
  source_files_added: z.number(),
  config_files_added: z.number(),
  doc_files_added: z.number(),
  source_file_count: z.number(),
  doc_file_count: z.number(),
  non_source_churn_ratio: z.number(),
  readme_proliferation_count: z.number(),
  out_of_scope_file_count: z.number(),
  scaffold_noise_count: z.number(),
  placeholder_count: z.number(),
  out_of_scope_files: z.string().array(),
  unmapped_files: z.string().array(),
  placeholder_hits: z.string().array(),
  duplicate_docs: z.string().array(),
  scaffold_expansion_flags: z.string().array(),
})

export const ReviewStreamPhase = z.literal("integrity")
export const ReviewStreamStep = z.enum(["manifest", "runtime", "visual", "specialist", "agent", "post_repair"])

export const Event = {
  TaskCreated: BusEvent.define("task.created", z.object({ taskID: Identifier.schema("task"), summary: z.string() }), {
    tier: 3,
  }),
  TaskUpdated: BusEvent.define("task.updated", z.object({ taskID: Identifier.schema("task"), summary: z.string() }), {
    tier: 3,
  }),
  TaskDeleted: BusEvent.define(
    "task.deleted",
    z
      .object({ taskID: Identifier.schema("task"), executionEpoch: z.number().int().positive(), summary: z.string() })
      .strict(),
    { tier: 2 },
  ),
  ArtifactPersisted: BusEvent.define(
    "artifact.persisted",
    z.object({
      taskID: Identifier.schema("task"),
      artifactID: Identifier.schema("artifact"),
      kind: z.enum(ENGINE_ARTIFACT_KINDS),
      catalogRevision: z.number().int().positive(),
    }),
    { tier: 3 },
  ),
  TaskCancellationRequested: BusEvent.define(TASK_CANCELLATION_REQUESTED_EVENT_TYPE, TaskCancellationRequestedPayload, {
    tier: 3,
  }),
  /** Terminal task transition events. Emitted alongside TaskUpdated when the
   *  derived status (`deriveTaskStatus`) crosses from non-terminal to one of
   *  the three terminal verbs. Consumers that surface OS-level "task
   *  succeeded / failed / cancelled" toasts (overlay, channel-runtime) read
   *  these instead of re-deriving from `task.updated.status` to avoid every
   *  consumer reimplementing the transition predicate (rule 8: single source). */
  TaskCompleted: BusEvent.define(
    "task.completed",
    z
      .object({
        taskID: Identifier.schema("task"),
        execution_epoch: z.number().int().positive(),
        summary: z.string(),
      })
      .strict(),
    { tier: 2 },
  ),
  TaskFailed: BusEvent.define(
    "task.failed",
    z
      .object({
        taskID: Identifier.schema("task"),
        execution_epoch: z.number().int().positive(),
        summary: z.string(),
        error: z.string().min(1),
        terminalReason: z.literal("interrupted").optional(),
      })
      .strict(),
    { tier: 1, badge: true },
  ),
  TaskCancelled: BusEvent.define("task.cancelled", TaskCancelledPayload.extend({ taskID: Identifier.schema("task") }), {
    tier: 2,
  }),
  TaskInfrastructureFailed: BusEvent.define(
    "task.infrastructure.failed",
    z.object({
      taskID: Identifier.schema("task"),
      component: z.string().min(1),
      operation: z.string().min(1),
      summary: z.string().min(1),
      details: z.string().min(1),
      errorName: z.string().min(1).optional(),
      evidenceLocators: EvidenceLocatorListSchema.length(1),
    }),
    { tier: 1 },
  ),
  /** User rewound the task timeline to a specific anchor event. Events
   *  with time_created > cursorTime are filtered from UI-facing queries.
   *  Overlay subscribers reload their filtered view on receipt. */
  TaskRewound: BusEvent.define(
    "task.rewound",
    z.object({
      taskID: Identifier.schema("task"),
      cursorTime: z.number().int().nonnegative(),
      anchorEventID: z.string().optional(),
      reason: z.string().optional(),
      anchorKind: z.enum(["cursorTime", "message"]),
    }),
  ),
  InteractionRequested: BusEvent.define(
    "interaction.requested",
    z.object({
      taskID: Identifier.schema("task"),
      interactionID: Identifier.schema("interaction"),
      requestType: Interaction.shape.type,
      summary: z.string(),
    }),
    { tier: 1, badge: true },
  ),
  InteractionResolved: BusEvent.define(
    "interaction.resolved",
    z.object({
      taskID: Identifier.schema("task"),
      interactionID: Identifier.schema("interaction"),
      status: z.enum(["answered", "rejected", "expired"]),
      summary: z.string(),
    }),
  ),
  TaskMessageRecorded: BusEvent.define(
    "task.message",
    z.object({
      taskID: Identifier.schema("task"),
      source: z.string(),
      summary: z.string(),
      messageID: Identifier.schema("message"),
    }),
    { tier: 3 },
  ),
  MessageInjected: BusEvent.define(
    "message.injected",
    z.object({
      taskID: Identifier.schema("task"),
      text: z.string(),
      summary: z.string(),
    }),
  ),
  MailboxMessage: BusEvent.define("mailbox.message", MailboxAgentMessagePayload, (payload) =>
    payload.attention || payload.category === "notification" ? { tier: 2 } : { tier: 3 },
  ),
  MailboxAcknowledged: BusEvent.define("mailbox.acknowledged", MailboxAcknowledgementPayload, { tier: 3 }),
  AgentCoordinationRequested: BusEvent.define(
    "agent.coordination.requested",
    z.object({
      taskID: Identifier.schema("task"),
      requestID: Identifier.schema("artifact"),
      sessionID: Identifier.schema("session"),
      agent: z.string(),
      blocking: z.boolean(),
      severity: z.enum(["info", "blocked", "failure"]),
      summary: z.string(),
    }),
    { tier: 2 },
  ),
  AgentCoordinationResponded: BusEvent.define(
    "agent.coordination.responded",
    z.object({
      taskID: Identifier.schema("task"),
      requestID: Identifier.schema("artifact"),
      responseID: Identifier.schema("artifact"),
      actionID: Identifier.schema("artifact"),
      sessionID: Identifier.schema("session"),
      decision: z.enum(AGENT_COORDINATION_DECISIONS),
      summary: z.string(),
    }),
    { tier: 2 },
  ),
  AgentCoordinationActionUpdated: BusEvent.define(
    "agent.coordination.action",
    z.object({
      taskID: Identifier.schema("task"),
      requestID: Identifier.schema("artifact"),
      responseID: Identifier.schema("artifact"),
      actionID: Identifier.schema("artifact"),
      sessionID: Identifier.schema("session"),
      action: z.enum(["cancel_worker", "redispatch_worker", "fail_task", "ask_user", "acknowledge_terminal"]),
      status: z.enum(["pending", "completed", "failed"]),
      summary: z.string(),
    }),
    { tier: 2 },
  ),
  AgentCoordinationCancelled: BusEvent.define(
    "agent.coordination.cancelled",
    z.object({
      taskID: Identifier.schema("task"),
      requestID: Identifier.schema("artifact"),
      sessionID: Identifier.schema("session"),
      summary: z.string(),
    }),
    { tier: 3 },
  ),

  ReviewStreamStarted: BusEvent.define(
    "review.stream.started",
    z.object({
      taskID: Identifier.schema("task"),
      reviewID: z.string().min(1),
      phase: ReviewStreamPhase,
      sessionID: z.string().optional(),
      agentID: z.string().min(1),
    }),
    { tier: 3 },
  ),
  ReviewStreamProgress: BusEvent.define(
    "review.stream.progress",
    z.object({
      taskID: Identifier.schema("task"),
      reviewID: z.string().min(1),
      phase: ReviewStreamPhase,
      agentID: z.string().min(1),
      currentStep: ReviewStreamStep.optional(),
      activity: z.string().optional(),
      reviewerID: z.string().optional(),
      roundID: z.string().optional(),
      attempt: z.number(),
      elapsedMs: z.number(),
      summary: z.string().optional(),
    }),
    { tier: 3 },
  ),
  ReviewStreamChunk: BusEvent.define(
    "review.stream.chunk",
    z.object({
      taskID: Identifier.schema("task"),
      reviewID: z.string().min(1),
      phase: ReviewStreamPhase,
      agentID: z.string().min(1),
      kind: z.literal("reasoning"),
      delta: z.string(),
      attempt: z.number(),
    }),
    { tier: 3 },
  ),
}
