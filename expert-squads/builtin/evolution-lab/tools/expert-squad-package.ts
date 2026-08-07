import { TaskArtifactResourceSetLocatorSchema, tool } from "@opencorvus-ai/plugin"
import { compareCandidateIntegrity } from "../lib/evolution-lab/candidate-integrity"
export default tool({
  description:
    "Materialize, validate, or compare exact Expert Squad package revisions in the current Task-owned runtime without installing them.",
  args: {
    action: tool.schema.enum(["materialize", "validate", "compare"]),
    package_digest: tool.schema
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    resource_set: TaskArtifactResourceSetLocatorSchema.optional(),
    candidate_resource_set: TaskArtifactResourceSetLocatorSchema.optional(),
  },
  async execute(args, context) {
    if (args.action === "materialize") {
      if (!args.package_digest) throw new Error("materialize requires package_digest")
      return JSON.stringify(
        await context.host.expertSquadPackages.materializeRevision({
          revision: { package_digest: args.package_digest },
        }),
      )
    }
    if (!args.resource_set) throw new Error(`${args.action} requires resource_set`)
    const parent = await context.host.expertSquadPackages.validateResourceSet({ resource_set: args.resource_set })
    if (args.action === "validate") return JSON.stringify(parent)
    if (!args.candidate_resource_set) throw new Error("compare requires candidate_resource_set")
    const candidate = await context.host.expertSquadPackages.validateResourceSet({
      resource_set: args.candidate_resource_set,
    })
    return JSON.stringify(compareCandidateIntegrity(parent, candidate))
  },
})
