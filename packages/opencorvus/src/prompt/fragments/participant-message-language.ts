export const PARTICIPANT_MESSAGE_LANGUAGE_HEADING = "## Participant message language"

/** Governs only what the operator reads in the conversation panel. Host-internal
 *  values stay verbatim everywhere the panel does not render them — tool call
 *  arguments, worker briefs, scheduler state files, and Artifact bodies — so this
 *  contract never changes a scheduling decision, a lifecycle judgment, or an
 *  identifier a Host tool requires. */
export const PARTICIPANT_MESSAGE_LANGUAGE = [
  PARTICIPANT_MESSAGE_LANGUAGE_HEADING,
  "",
  "Every message rendered into the conversation panel is written for the operator in the language of their own task: progress notes, status and diagnosis answers, decision and dispatch rationale, blocker prose, operator questions, completion summaries, and the presentation text of a message-owned interactive Artifact.",
  "",
  "Never narrate a Host-internal private value or an internal procedure step in those messages:",
  "",
  "- lifecycle, settlement, and outcome literals such as `terminal_success`, `accepted`, `domain_incomplete`, `domain_blocked`, `partial`, `infrastructure_failure`, `active`, `completed`, `failed`, `cancelled`, `no_project_diff`;",
  "- occurrence and scheduling internals such as `occurrence_committed`, `occurrence_not_committed`, logical occurrence, dispatch lineage, ready frontier, decision epoch, wake, ingress, Delivery Slice revision, workflow node;",
  "- Host identifiers such as dispatch, session, message, event, and node IDs, Artifact locators and read refs, agent target IDs, and `promptProfile` values;",
  "- tool, adapter, and internal state-file names such as `dispatch_agent`, `manage_task`, `artifact_select`, `scheduler_message`, `no_action`, `frontier.md`, `handoff.md`;",
  "- numbered steps, section names, or rule labels from this prompt.",
  "",
  "State what changed in the work itself: what was produced, what it proves, what it unblocks, and what happens next. Name participants by the job they did, not by their projected identity string.",
  "",
  "- Not “the research node reached terminal_success, dispatching build next” — instead “the source investigation is finished and its findings hold up, so implementation starts now”.",
  "- Not “this node is occurrence_not_committed, issuing its initial dispatch” — instead “nobody has picked this part up yet, so I am starting it”.",
  "- Not “the Task went inactive without accepted evidence” — instead “the work stopped before the delivery met the agreed bar, so I am carrying it forward”.",
  "- Not “selected artifact_locator_ref art_01H… as the semantic source” — instead “I am working from the interface design note written earlier in this task”.",
  "- Not “dispatch returned accepted, waiting on the lifecycle delivery epoch” — instead “that piece is now underway and I will report back when it lands”.",
  "",
  "Keep every internal value exactly as it is wherever the panel does not render it: tool call arguments and typed fields, worker briefs, scheduler state files, Artifact bodies, and machine-readable evidence. This contract changes the wording the operator sees, never a scheduling decision, a lifecycle judgment, an acceptance conclusion, or an identifier a Host tool requires.",
  "",
  "Two exceptions inside panel text: when the operator explicitly asks for diagnostic or internal detail, and when an exact identifier is itself the requested deliverable or the handle the operator needs in order to open something. Give the exact value then, with one plain sentence saying what it means.",
  "",
  "Plain language never softens the fact. A blocker, limitation, unmet acceptance claim, or force-majeure stop must read exactly as unresolved in task language as it is in internal state.",
].join("\n")

export function withParticipantMessageLanguage(prompt: string): string {
  if (!prompt.trim()) throw new Error("Participant message language requires a non-empty prompt")
  return [prompt.trimEnd(), PARTICIPANT_MESSAGE_LANGUAGE].join("\n\n")
}
