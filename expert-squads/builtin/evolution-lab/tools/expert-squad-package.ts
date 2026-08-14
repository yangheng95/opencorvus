import { TaskArtifactResourceSetLocatorSchema, tool } from "@opencorvus-ai/plugin"
import { compareCandidateIntegrity } from "../lib/evolution-lab/candidate-integrity"
export default tool({
  description:
    "Prepare, validate, or compare exact Expert Squad package revisions in the current Task-owned runtime without installing them. " +
    "For a new candidate, first call action=prepare_candidate with the development Campaign baseline package_digest; " +
    "the Host atomically creates the returned package_root from that immutable revision, and its resource_set is the authoritative parent_resource_set. After merge_back, call action=publish_commit_subtree with its exact primary_head and that returned package_root; " +
    "the Host strips that root and returns the validated candidate package resource_set. " +
    "then validate or compare it. Do not invent snapshot locators or derive a package digest from Git commits or manifests.",
  args: {
    action: tool.schema.enum(["prepare_candidate", "publish_commit_subtree", "validate", "compare"]),
    package_digest: tool.schema
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    source_commit: tool.schema
      .union([tool.schema.string().regex(/^[0-9a-f]{40}$/), tool.schema.string().regex(/^[0-9a-f]{64}$/)])
      .optional(),
    package_root: tool.schema.string().optional(),
    resource_set: TaskArtifactResourceSetLocatorSchema.optional(),
    candidate_resource_set: TaskArtifactResourceSetLocatorSchema.optional(),
  },
  async execute(args, context) {
    if (args.action === "prepare_candidate") {
      if (!args.package_digest) throw new Error("prepare_candidate requires package_digest")
      return JSON.stringify(
        await context.host.expertSquadPackages.prepareCandidate({
          revision: { package_digest: args.package_digest },
        }),
      )
    }
    if (args.action === "publish_commit_subtree") {
      if (!args.source_commit || !args.package_root)
        throw new Error("publish_commit_subtree requires source_commit and package_root")
      return JSON.stringify(
        await context.host.expertSquadPackages.publishCommitSubtree({
          source_commit: args.source_commit,
          package_root: args.package_root,
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
