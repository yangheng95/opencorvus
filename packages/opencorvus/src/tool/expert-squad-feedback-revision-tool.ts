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

const DESCRIPTION = [
  "Revise one installed Expert Squad from what the operator just told you, and stage the change for their acceptance.",
  "Use this only after the operator has authorized a durable change to how the Squad works, including an explicit request to improve its measured task performance. A request to fix only one deliverable does not authorize changing the Squad. Preserve the operator's scope: when generated outputs or evaluation results are read-only, treat them as evidence rather than repair targets.",
  "For evidence-driven optimization, read the exact original request, current Squad instructions, actual Tool inputs/results and available checker observations before proposing an edit. Separate observed behavior from inferred causes; a failed score or a Task completion label alone does not identify the responsible instruction. If evidence is partial, name which cases or obligations were observed and which remain unknown.",
  "Identify both failed obligations and behavior that already passed. Reconstruct the source facts, controlling decision and actual Tool arguments for a failure or regression, and contrast the closest successful trace. Locate the earliest incorrect decision, including selection, calculation, payload construction, interaction constraints, or a verifier accepting or introducing the same error. Rewrite that decision rule in the owning role while preserving successful behavior; do not merely append a longer checklist or tell agents to achieve a higher score.",
  "Before replacing a role's instructions, map its working operational prerequisites to the proposed text: concrete Tool discovery and activation steps, authoritative-source precedence, exact payload requirements and receipt checks. Preserve the steps supported by successful traces; removing a step requires evidence that the replacement still performs its function. An empty or irrelevant discovery result establishes only what that query found, not that a declared capability is unavailable. Check the actual query, category, returned references and activation result before changing grants or declaring an access blocker.",
  "State a falsifiable hypothesis: what observed decision will change, which agent owns it, what evidence that agent can use, which existing successful behavior is preserved, and what an unchanged checker should observe on a fresh run. Walk the proposed rule through one observed failure and one passed obligation: identify which predicted Tool arguments change and which stay invariant. This authoring analysis is not a fresh measurement. Keep case-specific names, IDs, answer literals, scorer implementation details and success claims out of the revised instructions. Never edit original outputs, Tool receipts, datasets or recorded scores to make the hypothesis appear true.",
  "Supply the complete new content of every file you are changing. Prompts are agents/<agent-id>/system.md, the scheduler is agents/orchestrator/system.md, the selector is selector.md, and Skill instructions/references live under skills/. You may also rewrite expert-squad.jsonc, which is where an agent's Tool grants, the workflow topology, and the set of agents live — except its version, which the Host derives and restamps over whatever you write.",
  "You may move capability between agents but never introduce capability the Squad does not already hold: a candidate granting a Tool, Skill, base role, or reference no revision before it declared is refused.",
  "Before concluding an agent cannot do something, read the `tools` set on its line in Active Projected Worker Identities. That is what the agent can actually call. Manifest `capability_refs` are exact declarations: projected workers additionally receive the platform-owned worker transport, while a scheduler receives Task Artifact transport only by declaring the exact platform `scheduler-transport` CapabilitySet. Never assume an undeclared scheduler Tool.",
  "So a preference for charts, tables, or any rendered shape is usually not a missing grant. It is a prompt that never named the Tool the agent already holds — and an instruction to put a chart inside a typed JSON payload field renders nothing at all.",
  "Write the preference as an instruction the agent can be judged against. A sentence that is satisfied by changing nothing — \"favor X where useful\", \"prefer X as the task permits\" — changes nothing, and that is the usual reason a revision has no effect at all.",
  "Do not add an escape clause. The operator weighed the trade-off when they stated the preference; \"while preserving existing output constraints\" hands that decision back to the agent, which will take it. A task's own constraints already bind without being restated.",
  "Rewrite the sentence that currently says otherwise, in the agent that actually produces the thing. Appending to a prompt that already prescribes a different shape leaves two instructions in conflict, and the older, more specific one wins. Read the prompts before you write, decide which agent owns the output the operator is describing, and if that agent publishes a typed payload, say which field carries the new shape: an instruction about \"reports\" does not reach a field named `note`.",
  "Prefer one decisive edit to several cautious ones.",
  "Answer `conflicting_instruction` from the text you actually read. If you claim an existing instruction was rewritten, the Host checks it: a revision where every changed file still begins with its parent unchanged and only adds at the end is refused, because that is the shape that leaves the older instruction in force.",
  "The Host copies the exact installed revision, applies your files, validates the candidate as a runnable package, publishes the candidate Artifact from the operator's verbatim words, and returns the confirmation the operator must accept before anything is installed. Nothing changes until they accept, and the receipt they get back is how they undo it.",
  "There is no trial and no measurement behind this change; the operator's acceptance is the only verdict. Do not describe it as tested or verified.",
].join("\n")

export function createExpertSquadFeedbackRevisionAiTool(trace: { taskID: string; sessionID: string }) {
  return aiTool({
    description: DESCRIPTION,
    inputSchema: ExpertSquadFeedbackRevisionInputSchema,
    execute: async (args) => {
      const revision = await reviseInstalledExpertSquadFromFeedback({
        taskID: trace.taskID,
        sessionID: trace.sessionID,
        request: args,
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
