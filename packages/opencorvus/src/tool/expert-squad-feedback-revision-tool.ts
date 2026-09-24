import { tool as aiTool } from "ai"
import {
  ExpertSquadFeedbackRevisionInputSchema,
  reviseInstalledExpertSquadFromFeedback,
} from "@/expert-squad/feedback-revision"
import {
  prepareEvolutionPackageMutation,
  evolutionMutationConfirmationText,
} from "@/expert-squad/evolution-mutation-intent"
import { Instance } from "@/project/instance"
import { resolveCoreProjectedTaskToolExecutionScope } from "./task-tool-execution-scope"

const DESCRIPTION = [
  "Revise one installed Expert Squad from what the operator just told you, and stage the change for their acceptance.",
  "Use this only after the operator has authorized a durable change to how the Squad works, including an explicit request to improve its measured task performance. A request to fix only one deliverable does not authorize changing the Squad. Preserve the operator's scope: when generated outputs or evaluation results are read-only, treat them as evidence rather than repair targets.",
  "For evidence-driven optimization, inspect the original request, current instructions, actual Tool inputs/results and checker observations. A file supplied to you, a score index, or a Task completion label is not a complete causal trace. Separate observed facts, inferred causes and missing evidence. Identify the decisive failed obligation and a successful obligation to preserve; disclose which cases, source fields and outcomes you actually inspected.",
  "Preserve evidence bytes and provenance. Ordinary read output can clip long lines even when it reaches the last line of a file. For long JSON/Tool evidence, snapshot the authorized original files with artifact_snapshot, then use the returned artifact_locator_ref values in artifact_read.reads with bounded byte windows and delivery=inline. Follow returned next_reads unchanged until the relevant exact resources are complete. Supply their complete artifact_read_ref values in source_read_refs; never invent locators or copy digests. Existing published Artifacts use artifact_search followed by the same exact read path. A materialized-file receipt proves byte availability, not that you inspected its contents. Do not treat uninspected or clipped content as evidence, or rewrite original outputs to make them easier to claim as read.",
  "Reconstruct source fact -> decision -> actual Tool arguments for the failure and the closest successful trace. Identify the actual calling role from the Tool receipt, including the scheduler, rather than assuming a worker owns the action. Trace handoffs that carry or lose the decisive facts. Preserve exclusion, cancellation and applicability evidence as well as positive receipts. A verifier must derive the eligible set and expected operation before comparing writes; rereading only the selected item can miss why another item was excluded. Put each correction in the role that actually decides or acts, and check every relevant action owner against the original interaction constraints.",
  "Audit the real supervision data path before prescribing a prompt edit: declared dispatch inputs -> persisted subject/Turn identity -> the actual worker capability set -> source and operation evidence received -> verifier finding -> scheduler completion or repair decision. Distinguish a lost contract or unavailable reader from a model that received contradictory facts and still accepted. A Mission layer supervises only an actual Mission-owned Task; prove that ownership and its observed wake before claiming Mission coverage. Never compensate for broken transport by repeating a reminder, adding case answers, or changing the evaluator. When a required platform correction is outside this Tool's package scope, report its exact failing boundary rather than pretending a candidate fixes it.",
  "Before replacing a role's instructions, map its working operational prerequisites to the proposed text: concrete Tool discovery and activation steps, authoritative-source precedence, exact payload requirements and receipt checks. Preserve the steps supported by successful traces; removing a step requires evidence that the replacement still performs its function. An empty or irrelevant discovery result establishes only what that query found, not that a declared capability is unavailable. Check the actual query, category, returned references and activation result before changing grants or declaring an access blocker.",
  "State a falsifiable hypothesis: what observed decision will change, which agent owns it, what evidence that agent can use, which existing successful behavior is preserved, and what an unchanged checker should observe on a fresh run. Distinguish a source never discovered, a discovered operation never used, a source read but misinterpreted under update/exclusion rules, and a successful mutation whose later read API is unavailable. A rule for one failure class does not repair the others. Walk each proposed rule through an observed failure and a passed obligation: name the predicted Tool arguments that change, the ones that stay invariant, and the scope that remains untested. This authoring analysis is not a fresh measurement. Keep case-specific names, IDs, answer literals, scorer implementation details and success claims out of the revised instructions. Never edit original outputs, Tool receipts, datasets or recorded scores to make the hypothesis appear true.",
  "Supply precise edits to the installed parent: path, old_text copied exactly from that file, new_text for that span, and the causal reason for changing that owning instruction. old_text must match once including whitespace; provide enough unchanged surrounding text to disambiguate it. Edits apply in order, including multiple edits to one file. Empty old_text creates a new file only; empty new_text removes the matched span. Preserve unrelated text rather than recreating whole roles. The Host proves exact edit application, not semantic conflict resolution. A README edit cannot substitute for an edit to the responsible prompt.",
  "Prompts are agents/<agent-id>/system.md, the scheduler is agents/orchestrator/system.md, the selector is selector.md, and Skill instructions/references live under skills/. The manifest expert-squad.jsonc owns Tool grants, topology and agents; edit it only when the authorized diagnosis requires that surface. The Host alone derives its version. Do not change grants to compensate for an uninspected or incorrectly queried capability.",
  "You may move capability between agents but never introduce capability the Squad does not already hold: a candidate granting a Tool, Skill, base role, or reference no revision before it declared is refused.",
  "Before concluding an agent cannot do something, read the `tools` set on its line in Active Projected Worker Identities. That is what the agent can actually call. Manifest `capability_refs` are exact declarations: projected workers additionally receive the platform-owned worker transport, while a scheduler receives Task Artifact transport only by declaring the exact platform `scheduler-transport` CapabilitySet. Never assume an undeclared scheduler Tool.",
  "So a preference for charts, tables, or any rendered shape is usually not a missing grant. It is a prompt that never named the Tool the agent already holds — and an instruction to put a chart inside a typed JSON payload field renders nothing at all.",
  "Write the preference as an instruction the agent can be judged against. A sentence that is satisfied by changing nothing — \"favor X where useful\", \"prefer X as the task permits\" — changes nothing, and that is the usual reason a revision has no effect at all.",
  "Replace the controlling instruction where it stands when it conflicts with the intended behavior; appending a competing rule leaves an unresolved choice. Preserve genuine task constraints and successful operational prerequisites. If a role publishes a typed payload, identify the field affected by the preference. Prefer one coherent causal correction to simultaneous unrelated rewrites; explain any necessary cross-role changes and how their handoff retains the decisive evidence.",
  "The Host applies your exact edits to the installed revision, validates the runnable package, records the supplied complete-read sources and publishes one immutable candidate from the operator's verbatim feedback. Empty source_read_refs is valid for a preference without Artifact evidence; it proves no evidence-based validation. A published candidate must remain unchanged. Installation still requires acceptance through the returned confirmation and has its own undo receipt.",
  "This Tool performs no trial, comparison, parent selection or measured promotion. Report the hypothesis as untested until a fresh unchanged checker evaluates the candidate, and retain all regressions and unavailable outcomes. User acceptance of installation is not evidence of performance improvement.",
].join("\n")

export function createExpertSquadFeedbackRevisionAiTool(trace: { taskID: string; sessionID: string }) {
  return aiTool({
    description: DESCRIPTION,
    inputSchema: ExpertSquadFeedbackRevisionInputSchema,
    execute: async (args, options) => {
      const scope = await resolveCoreProjectedTaskToolExecutionScope({ options, toolName: "evolve_expert_squad_from_feedback" })
      if (scope.taskID !== trace.taskID || scope.sessionID !== trace.sessionID)
        throw new Error("Feedback revision invocation belongs to another Task or Session")
      const revision = await reviseInstalledExpertSquadFromFeedback({
        taskID: trace.taskID,
        sessionID: trace.sessionID,
        request: args,
        evidenceScope: { assistantMessageID: scope.messageID, toolPartID: scope.toolPartID },
      })
      const prepared = prepareEvolutionPackageMutation({
        taskID: trace.taskID,
        intent: {
          operation: "feedback_revision",
          candidateRevisionLocator: revision.locator,
          expectedCurrentPackageDigest: revision.expectedCurrentPackageDigest,
        },
      })
      if (prepared.operation !== "feedback_revision")
        throw new Error("Expert Squad feedback revision prepared a different mutation operation")
      return {
        pending_acceptance: true,
        namespace: revision.namespace,
        id: revision.id,
        version: revision.version,
        changed_paths: revision.changedPaths,
        intent: prepared.intent,
        confirmation_text: evolutionMutationConfirmationText({
          projectID: Instance.project.id,
          target: prepared.target,
          beforeDigest: prepared.beforeDigest,
          afterDigest: prepared.afterDigest,
          evidenceSHA256s: prepared.evidence.map((locator) => locator.expected_sha256),
          operation: "feedback_revision",
          feedback: prepared.feedback,
        }),
      }
    },
  })
}
