import { z } from "zod"

const registration = z
  .object({
    benchmark: z.string().regex(/^HeavyWorkBench-[A-Za-z0-9-]+\/\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/),
    case: z.string().regex(/^[A-Z]\d{2}$/),
    model: z.string().regex(/^openai\/[^/\s]+$/),
    inactivitySeconds: z.number().int().positive(),
    tokenBudgetScope: z.literal("task-session-lineage"),
    budget: z.object({ total_model_tokens: z.null() }).passthrough(),
    runRoot: z.string().min(1),
    project: z.string().min(1),
  })
  .passthrough()

/** Parse execution metadata before creating the owned runtime or staging access. */
export function parseHeavyWorkbenchRegistration(input: unknown) {
  return registration.parse(input)
}
