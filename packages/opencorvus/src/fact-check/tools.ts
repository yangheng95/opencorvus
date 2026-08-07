import { tool } from "ai"
import { FactCheckReviewSchema, validateFactCheckReviewSemantics, type FactCheckReview } from "./schema"

export interface FactCheckCollector {
  review?: FactCheckReview
}

function emptyCollector(): FactCheckCollector {
  return {}
}

export function createFactCheckOutputTools() {
  let collector = emptyCollector()
  const tools = {
    record_fact_check_review: tool({
      description:
        "Record a FactCheckReview domain artifact after inspecting claims. This tool is optional and does not end the session. " +
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
    tools,
    getCollector: () => collector,
    reset() {
      collector = emptyCollector()
      return collector
    },
  }
}
