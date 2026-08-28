import { z } from "zod"

export const DesignResourceIntentSchema = z.enum([
  "visual_reference",
  "design_source",
  "interaction_reference",
  "design_tokens",
  "implementation_reference",
  "verification_evidence",
])

export type DesignResourceIntent = z.infer<typeof DesignResourceIntentSchema>
