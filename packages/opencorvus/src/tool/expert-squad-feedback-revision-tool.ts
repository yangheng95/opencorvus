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
  "Use this only after the operator has stated a durable preference about how work should be done — one that would apply again to the next Task of this kind — and has agreed to adjust the Squad. A correction to this one output is not a preference; edit the output instead.",
  "Supply the complete new content of every file you are changing. Prompts are agents/<agent-id>/system.md, the scheduler is agents/orchestrator/system.md, the selector is selector.md, and Skill instructions/references live under skills/. You may also rewrite expert-squad.jsonc, which is where an agent's Tool grants, the workflow topology, and the set of agents live — except its version, which the Host derives and restamps over whatever you write.",
  "You may move capability between agents but never introduce capability the Squad does not already hold: a candidate granting a Tool, Skill, base role, or reference no revision before it declared is refused.",
  "Before concluding a worker cannot do something, read the `tools` set on its line in Active Projected Worker Identities. That is what the worker can actually call. The manifest alone understates an inheriting worker: `built_in_tool_ids: []` with `inherit_base_tools: true` adds the base-role pool, and every projected worker additionally holds `publish_interactive_artifact` and the Task Artifact Tools. A scheduler instead receives its inherited base pool only when `inherit_base_tools` is true plus its explicit `built_in_tool_ids`; do not assume an undeclared scheduler Tool.",
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
