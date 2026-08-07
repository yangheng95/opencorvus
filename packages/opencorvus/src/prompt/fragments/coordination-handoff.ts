export function coordinationHandoffPrompt(toolID: "request_orchestrator_decision"): string {
  return [
    "# Durable coordination handoff",
    "",
    `The adapter exposes \`${toolID}\` to persist a coordination request when an Orchestrator decision is required.`,
    "Describe the scheduling or scope decision and its evidence; do not prescribe a hidden Host route or fabricate domain completion.",
    `After \`${toolID}\` returns, stop the current Turn because its durable handoff has replaced further in-flight work.`,
    "A verified durable coordination request will return synchronously through the current dispatch ownership to the Orchestrator.",
  ].join("\n")
}
