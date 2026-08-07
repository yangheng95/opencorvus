import { tool } from "ai"
import z from "zod"
import { requireTask } from "@/engine/store"
import { PromptProjectionObservation } from "@/prompt/projection-observation"

export const READ_CONTEXT_OUTPUT_CHAR_BUDGET = PromptProjectionObservation.CHARACTER_TARGET
const READ_CONTEXT_DECISION_GENERAL_CHAR_CAP = 5_500

type ReadContextAddOptions = {
  pointer: string
  sectionCap?: number
}

type ReadContextOutput = ReturnType<typeof createReadContextOutput>

function createReadContextOutput() {
  const sections: string[] = []
  let usedChars = 0

  function add(...input: Array<string | ReadContextAddOptions | undefined>): boolean {
    const options = input[input.length - 1]
    if (!options || typeof options !== "object" || !("pointer" in options)) {
      throw new Error("read_context output block missing pointer")
    }
    const rawLines = input.slice(0, -1) as Array<string | undefined>
    const block = normalizeReadContextBlock(rawLines)
    if (!block) return true
    const bounded =
      typeof options.sectionCap === "number" ? readContextTrimText(block, options.pointer, options.sectionCap) : block
    if (!bounded) return true

    const separatorChars = sections.length > 0 ? 1 : 0
    const remaining = READ_CONTEXT_OUTPUT_CHAR_BUDGET - usedChars - separatorChars
    if (remaining <= 0) return false
    const fits = bounded.length <= remaining
    const rendered = fits ? bounded : readContextTrimText(bounded, options.pointer, remaining)
    if (!rendered) return false
    sections.push(rendered)
    usedChars += separatorChars + rendered.length
    return fits
  }

  function result(): string {
    return sections.length > 0 ? sections.join("\n") : "No context available yet."
  }

  return { add, result }
}

function normalizeReadContextBlock(lines: Array<string | undefined>): string {
  return lines
    .filter((line): line is string => typeof line === "string")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function readContextTrimText(text: string, pointer: string, cap: number): string {
  if (cap <= 0) return ""
  if (text.length <= cap) return text
  const marker = `\n[read_context omitted ${text.length - cap} chars; full detail: ${pointer}]`
  if (marker.length >= cap) return `[read_context output budget reached; full detail: ${pointer}]`.slice(0, cap)
  const sliceLength = Math.max(0, cap - marker.length)
  return `${text.slice(0, sliceLength)}${marker}`
}

export function createReadContextTool(input: { taskID: string }) {
  const { taskID } = input
  return {
    read_context: tool({
      description:
        "Drill into persisted Decision Log context that is not already rendered in the scheduler prompt. Artifact discovery, exact reads, and semantic source declarations belong exclusively to artifact_search, artifact_read, and artifact_select.",
      inputSchema: z.object({
        scope: z.literal("decisions").describe("Persisted non-Artifact Decision Log surface to drill into"),
      }),
      execute: async ({ scope }) => {
        requireTask(taskID)
        const output = createReadContextOutput()
        // This tool intentionally excludes ordinary scheduler state. Current
        // ordinary Task, Goal, and research facts are rendered on every wake by
        // renderTaskDescription() and the latest-result context block in
        // orchestrator/agent.ts. Keeping those facts here would recreate a
        // second task-state refresh path.

        if (scope === "decisions") {
          const { createDecisionLog, DECISION_LOG_PROMPT_LIMIT } = await import("@/decision-log")
          const log = createDecisionLog(taskID)
          const section = log.toPromptSection({
            limit: DECISION_LOG_PROMPT_LIMIT,
            excludePhases: ["review"],
          })
          if (section)
            output.add(section, {
              pointer: "read_context scope=decisions",
              sectionCap: READ_CONTEXT_DECISION_GENERAL_CHAR_CAP,
            })
        }

        const result = output.result()
        // Telemetry: read_context is structurally bounded by the per-section
        // caps above, but if a future change blows through the budget the
        // observability layer surfaces it instead of letting it slip silently.
        PromptProjectionObservation.record(result, "tool:read_context")
        return result
      },
    }),
  }
}
