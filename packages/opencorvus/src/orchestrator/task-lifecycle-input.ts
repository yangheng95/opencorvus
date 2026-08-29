import z from "zod"
import {
  ArtifactReadLocatorInputListSchema,
  EvidenceLocatorInputListSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { TaskCancellationReason } from "@opencorvus-ai/transport-protocol"
import { Identifier } from "@/id/id"

/**
 * Model-facing input shapes for the terminal Task lifecycle actions.
 *
 * These live apart from `task-lifecycle-tools.ts` because `orchestrator/tools.ts` needs their
 * *values* while its own module body evaluates, in order to build the `manage_task` discriminated
 * union. `task-lifecycle-tools.ts` reaches `orchestrator/tools.ts` again through
 * `engine/state -> protocol/delivery -> session/wake -> session/prompt -> session/loop`, so when a
 * caller enters that cycle from the lifecycle side the schemas are still uninitialized and
 * `tools.ts` throws at import time. Keeping them in a leaf module with no OpenCorvus runtime imports
 * means the union always sees settled bindings, whichever side of the cycle is entered first.
 */

export const CompleteTaskInputSchema = z
  .object({
    summary: z
      .string()
      .min(1)
      .describe(
        "Orchestrator-owned task decision summary. Cite the evidence you used, including IntegrityReview or VisualReview artifacts when relevant.",
      ),
    evidence_locators: EvidenceLocatorInputListSchema.default([]).describe(
      "Exact typed durable evidence locators used for this completion decision. For every worker final Message relied on for synthesis or acceptance, include a session_message locator pairing the exact producing session_id and message_id returned by read_agent_message. A terminal lifecycle Artifact does not replace that participant Message. Name each Artifact by its exact revision or snapshot path only; the Host reads the digest, byte count, and media type itself, so never restate a content digest here. Empty is explicit and remains visible; it is not a host-side completion gate. Raw IDs and artifact:<id> display strings are invalid.",
    ),
    deliverable_artifact_locators: ArtifactReadLocatorInputListSchema.default([]).describe(
      "Exact Artifact locators intentionally delivered to the user, named by exact revision or snapshot path without any content digest. Include every user-consumable report, document, screenshot set, structured result, or other published Artifact; use an empty list only when the Task produced no Artifact deliverable. Completion evidence belongs in evidence_locators instead. The terminal workflow node's own worker Artifacts are derived and sealed by the Host, so omitting one is never a rejection.",
    ),
    accepted_delivery_slice_revision_ids: z
      .array(Identifier.schema("goal"))
      .default([])
      .describe(
        "Exact current Delivery Slice revision IDs accepted by this Task completion decision. Slice IDs are evidence subjects, not lifecycle owners; use an empty list only when the Task has no Delivery Slices.",
      ),
    workflow_id: z
      .string()
      .min(1)
      .nullable()
      .default(null)
      .describe(
        "Exact selected virtual workflow ID, or null for a direct Task with no selected virtual workflow. The persisted completion decision binds this ID to the active expert squad package revision and complete declared node graph.",
      ),
  })
  .strict()

export const FailTaskInputSchema = z.object({ error: z.string().describe("Why the task failed") }).strict()

export const CancelTaskInputSchema = z
  .object({ reason: TaskCancellationReason.describe("Why you are cancelling the task") })
  .strict()
