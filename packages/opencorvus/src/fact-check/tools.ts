import { tool } from "ai"
import { FactCheckReviewSchema, validateFactCheckReviewSemantics, type FactCheckReview } from "./schema"
import { materializeExactTool } from "@/agent/exact-tool-factory"

export interface FactCheckCollector {
  review?: FactCheckReview
}

function emptyCollector(): FactCheckCollector {
  return {}
}

export function createFactCheckOutputTools(onMaterialize?: (toolID: string) => void) {
  let collector = emptyCollector()
  const toolFactories = {
    record_fact_check_review: () => tool({
      description:
        "Record the FactCheckReview required for Fact Check domain completion after inspecting claims. This tool does not end the streamed session. " +
        "The review classifies inspected claims as verified, corrected, or unresolved.",
      inputSchema: FactCheckReviewSchema,
      execute: async (review) => {
        const semanticError = validateFactCheckReviewSemantics(review)
        if (semanticError) return `Error: fact-check review failed semantic validation: ${semanticError}`
        collector.review = review
        return (
          `OK: fact-check review recorded ` +
          `(verified=${review.verified.length}, ` +
          `corrected=${review.corrected.length}, ` +
          `unresolved=${review.unresolved.length}, ` +
          `verdict=${review.overall_verdict})`
        )
      },
    }),
  }
  return {
    materializeExact: (toolID: string) => materializeExactTool(toolFactories, toolID, onMaterialize),
    getCollector: () => collector,
    reset() {
      collector = emptyCollector()
      return collector
    },
  }
}
