import { DispatchOutcomeSchema } from "@/agent/dispatch-outcome"
import { ProjectedAgentWorkScopeSchema } from "@/agent/projected-agent-work-scope"
import { ToolFailureCause } from "@/session/tool-failure-cause"
import { EvidenceLocatorInputListSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import z from "zod"
import { DispatchWorkflowSubjectSchema } from "./workflow-binding"

export const MAX_DISPATCH_COLLECTION_SIZE = 8

const DispatchCollectionTeamMemberSchema = z
  .object({
    name: z.string().min(1).max(96).describe("Task-local member name owned by this team row; its array index identifies the aligned dispatch wrapper."),
    target: z.string().min(1).describe("Exact projected Agent target used by the aligned dispatch item."),
    responsibility: z.string().min(1).describe("One non-overlapping responsibility."),
    boundary: z.string().min(1).describe("Explicit owned facts, files, or effects and prohibited overlap."),
    expected_result: z.string().min(1).describe("Visible result and evidence duty expected from this member."),
    depends_on: z
      .array(z.string().min(1))
      .describe("Settled predecessor member names. Members in this same ready frontier cannot appear here."),
  })
  .strict()

const DispatchCollectionContinuationTurnSchema = z
  .object({
    kind: z.literal("continuation"),
    authority: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("coordination_action"), coordination_action_id: z.string().min(1) }).strict(),
      z.object({ kind: z.literal("prior_dispatch"), continuation_dispatch_id: z.string().min(1) }).strict(),
    ]),
    guidance: z.string().trim().min(1),
    evidence_locators: EvidenceLocatorInputListSchema.default([]),
    acceptance_gap_id: z.string().min(1).optional(),
    criterion_ids: z.array(z.string().min(1)).min(1).max(64).optional(),
  })
  .strict()
  .superRefine((turn, context) => {
    if ((turn.acceptance_gap_id === undefined) !== (turn.criterion_ids === undefined)) {
      context.addIssue({
        code: "custom",
        path: [turn.acceptance_gap_id === undefined ? "acceptance_gap_id" : "criterion_ids"],
        message: "acceptance gap and criteria must be supplied together",
      })
    }
  })

export const PersistedDispatchCollectionMemberInputSchema = z
  .object({
    dispatch: z
      .object({
        target: z.string().min(1),
        work_scope: ProjectedAgentWorkScopeSchema,
        turn: z.discriminatedUnion("kind", [
          z
            .object({
              kind: z.literal("initial"),
              workflow_subject: DispatchWorkflowSubjectSchema,
              use_worktree: z.boolean(),
              input: z.record(z.string(), z.unknown()),
            })
            .strict(),
          DispatchCollectionContinuationTurnSchema,
        ]),
      })
      .strict(),
  })
  .strict()

export function createDispatchAgentsInputSchema(childInputSchema: z.ZodType) {
  const collectionMemberSchema = PersistedDispatchCollectionMemberInputSchema.and(childInputSchema)
  return z
    .object({
      team: z
        .array(DispatchCollectionTeamMemberSchema)
        .min(1)
        .max(MAX_DISPATCH_COLLECTION_SIZE)
        .describe("Visible structured description of the exact members in this frontier, aligned with dispatches."),
      dispatches: z
        .array(collectionMemberSchema)
        .min(1)
        .max(MAX_DISPATCH_COLLECTION_SIZE)
        .describe(
          "The complete dependency-ready frontier. Each item has exactly one outer field: { dispatch: ... }. " +
            "team[index] owns the member name and responsibility; dispatches[index] owns only that member's dispatch envelope. " +
            "Include every currently independent member once; keep dependent or conflicting work for a later frontier.",
        ),
    })
    .strict()
    .superRefine((input, context) => {
      if (input.team.length !== input.dispatches.length) {
        context.addIssue({ code: "custom", path: ["team"], message: "team and dispatches must describe the same frontier size" })
        return
      }
      const names = new Set<string>()
      input.team.forEach((member, index) => {
        if (names.has(member.name)) {
          context.addIssue({ code: "custom", path: ["team", index, "name"], message: "member names must be unique" })
        }
        names.add(member.name)
        if (member.target !== input.dispatches[index]?.dispatch.target) {
          context.addIssue({
            code: "custom",
            path: ["team", index, "target"],
            message: "member target must equal the aligned dispatch target",
          })
        }
      })
      input.team.forEach((member, index) => {
        if (member.depends_on.some((dependency) => names.has(dependency))) {
          context.addIssue({
            code: "custom",
            path: ["team", index, "depends_on"],
            message: "a dependency-ready frontier cannot depend on another member in the same frontier",
          })
        }
      })
    })
}

export const PersistedDispatchAgentsInputSchema = createDispatchAgentsInputSchema(
  PersistedDispatchCollectionMemberInputSchema,
)

export type PersistedDispatchAgentsInput = z.output<typeof PersistedDispatchAgentsInputSchema>

export const DispatchCollectionMemberResultSchema = z.discriminatedUnion("status", [
  z.object({
    member_index: z.number().int().min(0),
    name: z.string().min(1),
    target: z.string().min(1),
    status: z.literal("completed"),
    outcome: DispatchOutcomeSchema,
  }).strict(),
  z.object({
    member_index: z.number().int().min(0),
    name: z.string().min(1),
    target: z.string().min(1),
    status: z.literal("failed"),
    failure: ToolFailureCause,
  }).strict(),
])

export type DispatchCollectionMemberResult = z.infer<typeof DispatchCollectionMemberResultSchema>

const DispatchCollectionProgressSchema = z
  .object({
    version: z.literal(1),
    members: z.array(DispatchCollectionMemberResultSchema).max(MAX_DISPATCH_COLLECTION_SIZE),
  })
  .strict()
  .superRefine((progress, context) => {
    const seen = new Set<number>()
    for (const [index, member] of progress.members.entries()) {
      if (seen.has(member.member_index)) {
        context.addIssue({
          code: "custom",
          path: ["members", index, "member_index"],
          message: "settled collection member indexes must be unique",
        })
      }
      seen.add(member.member_index)
    }
  })

export function readDispatchCollectionProgress(metadata: unknown): DispatchCollectionMemberResult[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return []
  const value = (metadata as Record<string, unknown>).dispatch_collection
  if (value === undefined) return []
  return DispatchCollectionProgressSchema.parse(value).members
}

export function writeDispatchCollectionProgress(
  metadata: Record<string, unknown> | undefined,
  members: readonly DispatchCollectionMemberResult[],
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    dispatch_collection: DispatchCollectionProgressSchema.parse({
      version: 1,
      members: [...members].sort((left, right) => left.member_index - right.member_index),
    }),
  }
}
