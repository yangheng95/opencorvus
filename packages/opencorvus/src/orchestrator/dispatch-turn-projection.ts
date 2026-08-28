import { createHash } from "node:crypto"
import z from "zod"
import { Identifier } from "@/id/id"
import { SelectedWorkflowBindingSchema } from "@/engine/workflow-binding"
import { EvidenceLocatorListSchema, type EvidenceLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { MissionAcceptanceCriterionSchema } from "@/mission/acceptance-gap"

export const ControlTextPartAuthoritySchema = z
  .object({
    part_id: Identifier.schema("part"),
    text_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export const ControlTextPartAuthorityListSchema = z
  .array(ControlTextPartAuthoritySchema)
  .superRefine((parts, context) => {
    const identities = new Set<string>()
    for (const [index, part] of parts.entries()) {
      if (!identities.has(part.part_id)) {
        identities.add(part.part_id)
        continue
      }
      context.addIssue({
        code: "custom",
        path: [index, "part_id"],
        message: `control-text Part authority contains duplicate identity ${part.part_id}`,
      })
    }
  })

export const TaskAuthorityAnchorSchema = z
  .object({
    task_id: Identifier.schema("task"),
    root_session_id: Identifier.schema("session"),
    request_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    initial_user_message_id: Identifier.schema("message").optional(),
    initial_control_text_parts: ControlTextPartAuthorityListSchema,
  })
  .strict()
  .superRefine((anchor, context) => {
    if ((anchor.initial_user_message_id === undefined) !== (anchor.initial_control_text_parts.length === 0)) {
      context.addIssue({
        code: "custom",
        path: ["initial_control_text_parts"],
        message: "initial user-message identity and hashed control-text Part authority must be present together",
      })
    }
  })
export type TaskAuthorityAnchor = z.infer<typeof TaskAuthorityAnchorSchema>

export const WorkerInputMessageAuthoritySchema = z
  .object({
    user_message_id: Identifier.schema("message"),
    control_text_parts: ControlTextPartAuthorityListSchema.refine((parts) => parts.length > 0, {
      message: "worker input message authority requires at least one control-text Part",
    }),
  })
  .strict()
export type WorkerInputMessageAuthority = z.infer<typeof WorkerInputMessageAuthoritySchema>

const DispatchTurnBaseSchema = z.object({
  current_dispatch_id: z.string().min(1),
  workflow_binding: SelectedWorkflowBindingSchema,
  workflow_node_id: z.string().min(1).nullable(),
  workflow_occurrence_id: z.string().min(1),
  delivery_slice_revision_ids: z.array(Identifier.schema("goal")),
  evidence_locators: EvidenceLocatorListSchema,
  task_authority: TaskAuthorityAnchorSchema,
})

export const AcceptanceRepairDispatchSchema = z
  .object({
    gap_id: z.string().min(1),
    ledger_revision_artifact_id: Identifier.schema("artifact"),
    execution_epoch: z.number().int().positive(),
    criteria: z.array(MissionAcceptanceCriterionSchema).min(1).max(64),
    checkpoint_required: z.literal(true),
  })
  .strict()
  .superRefine((repair, context) => {
    const ids = new Set<string>()
    for (const [index, criterion] of repair.criteria.entries()) {
      if (ids.has(criterion.criterion_id)) {
        context.addIssue({
          code: "custom",
          path: ["criteria", index, "criterion_id"],
          message: `Duplicate acceptance repair criterion ${criterion.criterion_id}.`,
        })
      }
      ids.add(criterion.criterion_id)
    }
  })
export type AcceptanceRepairDispatch = z.infer<typeof AcceptanceRepairDispatchSchema>

export function acceptanceRepairEvidenceLocators(repair: AcceptanceRepairDispatch): EvidenceLocator[] {
  const parsed = AcceptanceRepairDispatchSchema.parse(repair)
  const locators = parsed.criteria.flatMap((criterion) => [
    ...criterion.relied_evidence_locators,
    ...criterion.contradictory_evidence_locators,
  ])
  return [...new Map(locators.map((locator) => [JSON.stringify(locator), locator])).values()]
}

export const DispatchTurnSchema = z.discriminatedUnion("kind", [
  DispatchTurnBaseSchema.extend({ kind: z.literal("initial") }).strict(),
  DispatchTurnBaseSchema.extend({
    kind: z.literal("continuation"),
    source_dispatch_id: z.string().min(1),
    child_session_id: Identifier.schema("session"),
    acceptance_repair: AcceptanceRepairDispatchSchema.optional(),
  }).strict(),
])
export type DispatchTurn = z.infer<typeof DispatchTurnSchema>

export function taskRequestSHA256(request: string): string {
  return createHash("sha256").update(request).digest("hex")
}

export function controlTextSHA256(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

export function renderDispatchContinuationTurn(input: {
  turn: DispatchTurn
  guidance: string
  evidenceLocators?: readonly EvidenceLocator[]
}): string | undefined {
  const turn = DispatchTurnSchema.parse(input.turn)
  if (turn.kind === "initial") return undefined
  const guidance = input.guidance.trim()
  const evidenceLocators = EvidenceLocatorListSchema.parse(input.evidenceLocators ?? turn.evidence_locators)
  const authority = turn.task_authority
  return [
    "# Incremental continuation",
    "",
    "Continue the existing physical worker Session and its original Task contract. This Turn contains only current guidance and immutable locators; do not reinterpret it as a new Task or repeat the complete request.",
    "",
    "## Dispatch lineage",
    "",
    `- current_dispatch_id: ${turn.current_dispatch_id}`,
    `- source_dispatch_id: ${turn.source_dispatch_id}`,
    `- child_session_id: ${turn.child_session_id}`,
    `- workflow_node_id: ${turn.workflow_node_id ?? "(direct)"}`,
    `- workflow_occurrence_id: ${turn.workflow_occurrence_id}`,
    `- delivery_slice_revision_ids: ${turn.delivery_slice_revision_ids.join(", ") || "(none)"}`,
    `- workflow_binding: ${JSON.stringify(turn.workflow_binding)}`,
    ...(turn.acceptance_repair
      ? [
          "",
          "## Acceptance repair obligation",
          "",
          `- gap_id: ${turn.acceptance_repair.gap_id}`,
          `- ledger_revision_artifact_id: ${turn.acceptance_repair.ledger_revision_artifact_id}`,
          `- execution_epoch: ${turn.acceptance_repair.execution_epoch}`,
          `- criterion_ids: ${turn.acceptance_repair.criteria.map((criterion) => criterion.criterion_id).join(", ")}`,
          ...turn.acceptance_repair.criteria.flatMap((criterion) => [
            `### ${criterion.criterion_id}`,
            `- disposition: ${criterion.disposition}`,
            `- finding: ${criterion.finding}`,
            `- responsible_workflow_node_id: ${criterion.responsible_workflow_node_id}`,
            `- required_new_evidence_kind: ${criterion.required_new_evidence_kind}`,
            `- relied_evidence_locators: ${JSON.stringify(criterion.relied_evidence_locators)}`,
            `- contradictory_evidence_locators: ${JSON.stringify(criterion.contradictory_evidence_locators)}`,
          ]),
          "- Recheck only these criteria. Preserve every acceptance not named here and publish delta evidence in the canonical Artifact lineage.",
        ]
      : []),
    "",
    "## Task authority anchor",
    "",
    `- task_id: ${authority.task_id}`,
    `- root_session_id: ${authority.root_session_id}`,
    `- request_sha256: ${authority.request_sha256}`,
    `- initial_user_message_id: ${authority.initial_user_message_id}`,
    `- initial_control_text_parts: ${authority.initial_control_text_parts.map((part) => `${part.part_id}:${part.text_sha256}`).join(", ")}`,
    "",
    "## Current guidance",
    "",
    guidance || "Continue from the latest visible worker result and current Task evidence.",
    "",
    "## Artifact evidence",
    "",
    ...(evidenceLocators.length > 0
      ? evidenceLocators.map((locator) => `- ${JSON.stringify(locator)}`)
      : [
          "Use artifact_search, complete each artifact_locator_ref read, and select with artifact_read_ref. Keep Artifact bodies in the Catalog instead of copying them into this Turn.",
        ]),
  ].join("\n")
}
