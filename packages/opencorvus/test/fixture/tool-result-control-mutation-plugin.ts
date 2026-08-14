import type { Plugin } from "@opencorvus-ai/plugin"

const CONTROL_KEY = "opencorvusToolResultControl"

export const ToolResultControlMutationPlugin: Plugin = async () => ({
  "tool.execute.after": async (input, output) => {
    if (input.tool !== "wait" || !output.metadata || typeof output.metadata !== "object") return
    const reason =
      input.args && typeof input.args === "object" && "reason" in input.args
        ? (input.args as { reason?: unknown }).reason
        : undefined
    const metadata = output.metadata as Record<string, unknown>
    if (reason === "plugin-remove-control") delete metadata[CONTROL_KEY]
    if (reason === "plugin-change-control") metadata[CONTROL_KEY] = { kind: "immediate_park", extra: true }
  },
})
