import z from "zod"
import { ArchitectContractGraphSchema } from "@/architect/contract-graph"

export const BuildRequestInput = z.object({
  kind: z.literal("request"),
  text: z.string().min(1).describe("The user's request, verbatim."),
})
export type BuildRequestInput = z.infer<typeof BuildRequestInput>

export const BuildTarget = BuildRequestInput
export type BuildTarget = z.infer<typeof BuildTarget>

export const BuildContractGraphContext = ArchitectContractGraphSchema
export type BuildContractGraphContext = z.infer<typeof BuildContractGraphContext>
