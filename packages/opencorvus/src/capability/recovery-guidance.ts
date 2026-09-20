/** Guidance, not authority: only name a coordination Tool already present in
 * this occurrence's actual callable surface. It cannot expand frozen grants. */
export function capabilityRecoveryGuidance(callableNames: readonly string[]): string {
  const names = new Set(callableNames)
  const request = names.has("request_orchestrator_decision")
    ? "Use the callable request_orchestrator_decision with the exact failed tool/ref, error, required operation and evidence; ask the scheduler to assign a capable owner or arrange the necessary operator decision. This coordination handoff ends your turn and does not grant the capability."
    : names.has("question")
      ? "Use the callable question to ask the operator for the exact missing configuration or authorized scope decision. The answer itself does not change frozen role grants."
      : "Report the exact capability, operation, error and missing authority in your visible response to the current owner; this occurrence has no callable permission-request tool."
  return [
    "Search is discovery, not permission: refine incomplete search_window results, copy returned exact_refs to reveal, then call the exposed tool using its definition.",
    "An empty scoped result does not prove the server is missing. A missing role grant requires an owner/projection change and a new authorized occurrence, not repeated search or shell/API substitution.",
    "For requires_auth or open_settings, preserve the returned settings target and ask its operator to connect/authenticate. Never request or copy secret values into messages.",
    "Operation approval is requested by invoking an already granted tool: its permission runtime presents the real request when needed. Respect a rejected operation; do not retry to bypass it or invent an escalation flag.",
    "Filesystem EPERM/EACCES, browser launch, timeout and artifact publication errors are execution failures, not evidence of a missing role grant or operator approval; inspect their exact operation and diagnostics.",
    request,
  ].join(" ")
}
