import {
  analyzeExpertSquadWorkflowTopology,
  validateBuiltInExpertSquadTopologyPolicy,
} from "../../sdk/js/src/expert-squad-authoring"
import path from "node:path"

const repositoryRoot = path.resolve(import.meta.dir, "..", "..", "..")
const manifestPaths = [
  ...new Bun.Glob("expert-squads/builtin/*/expert-squad.jsonc").scanSync(repositoryRoot),
  ...new Bun.Glob("packages/opencorvus/src/expert-squad/builtin/*/expert-squad.jsonc").scanSync(repositoryRoot),
].sort()

type RequiredStructure = "flat_planner_parallel_workers" | "parallel_workers_join" | "dependency_dag"

/**
 * Pin the declared shape of the workflows whose structure is a product decision rather than an
 * author's preference. Both Base workflows are `dependency_dag`s on purpose: the executable
 * workflow keeps Planner -> Developer -> Tester, while the research workflow additionally shares
 * the Planner's frontier with a capability-matched Researcher. In both graphs verification observes
 * a settled result instead of racing the mutation it is supposed to check.
 */
const requiredWorkflowStructures = new Map<string, Map<string, RequiredStructure>>([
  [
    "base",
    new Map([
      ["planner-execution-verification", "dependency_dag"],
      ["planner-parallel-delivery", "dependency_dag"],
    ]),
  ],
  ["browser-research-acceptance", new Map([["browser-evidence-acceptance", "flat_planner_parallel_workers"]])],
  ["frontend-innovate", new Map([["delivery", "flat_planner_parallel_workers"]])],
  [
    "frontend-replica",
    new Map([
      ["interface-modeling", "flat_planner_parallel_workers"],
      ["source-replica", "flat_planner_parallel_workers"],
    ]),
  ],
  ["office-delivery", new Map([["planned-office-delivery", "flat_planner_parallel_workers"]])],
  [
    "review-debug",
    new Map([
      ["review-only", "flat_planner_parallel_workers"],
      ["debug-repair", "flat_planner_parallel_workers"],
      ["visual-debug-repair", "flat_planner_parallel_workers"],
    ]),
  ],
  [
    "squad-sdk",
    new Map([
      ["sdk-authoring", "flat_planner_parallel_workers"],
      ["heterogeneous-import", "flat_planner_parallel_workers"],
    ]),
  ],
  ["evolution-lab", new Map([["evolution-candidate-preparation", "flat_planner_parallel_workers"]])],
])

const summaries: Array<{
  id: string
  workflows: number
  flat: number
  parallelJoins: number
  dependencyDags: number
}> = []

for (const relativePath of manifestPaths) {
  const absolutePath = path.join(repositoryRoot, relativePath)
  const manifest = validateBuiltInExpertSquadTopologyPolicy(Bun.JSONC.parse(await Bun.file(absolutePath).text()))
  const analyses = analyzeExpertSquadWorkflowTopology(manifest)
  const required = requiredWorkflowStructures.get(manifest.id) ?? new Map<string, RequiredStructure>()
  for (const [workflowID, structure] of required) {
    const analysis = analyses.find((item) => item.workflow_id === workflowID)
    if (!analysis) throw new Error(`${manifest.id} is missing required workflow ${workflowID}`)
    if (analysis.structure !== structure) {
      throw new Error(
        `${manifest.id}/${workflowID} must declare structure ${structure}, but analyzes as ${analysis.structure}`,
      )
    }
  }
  for (const agentID of Object.keys(manifest.capability_projection.agents)) {
    if (manifest.id !== "advanced" && /(?:^|-)(?:visual|integrity)-reviewer$/.test(agentID)) {
      throw new Error(`${manifest.id} retains forbidden specialist reviewer identity ${agentID}`)
    }
  }
  summaries.push({
    id: manifest.id,
    workflows: analyses.length,
    flat: analyses.filter((item) => item.structure === "flat_planner_parallel_workers").length,
    parallelJoins: analyses.filter((item) => item.structure === "parallel_workers_join").length,
    dependencyDags: analyses.filter((item) => item.structure === "dependency_dag").length,
  })
}

console.log(
  JSON.stringify({
    manifests: summaries.length,
    workflows: summaries.reduce((sum, item) => sum + item.workflows, 0),
    flat_planner_parallel_workers: summaries.reduce((sum, item) => sum + item.flat, 0),
    parallel_workers_join: summaries.reduce((sum, item) => sum + item.parallelJoins, 0),
    dependency_dag: summaries.reduce((sum, item) => sum + item.dependencyDags, 0),
  }),
)
