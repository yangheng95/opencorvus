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

const requiredFlatWorkflows = new Map<string, Set<string>>([
  ["base", new Set(["planner-parallel-delivery"])],
  ["browser-research-acceptance", new Set(["browser-evidence-acceptance"])],
  ["frontend-innovate", new Set(["delivery"])],
  ["frontend-replica", new Set(["interface-modeling", "source-replica"])],
  ["office-delivery", new Set(["planned-office-delivery"])],
  ["review-debug", new Set(["review-only", "debug-repair", "visual-debug-repair"])],
  ["squad-sdk", new Set(["sdk-authoring", "heterogeneous-import"])],
  ["evolution-lab", new Set(["evolution-candidate-preparation"])],
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
  const required = requiredFlatWorkflows.get(manifest.id) ?? new Set<string>()
  for (const workflowID of required) {
    const analysis = analyses.find((item) => item.workflow_id === workflowID)
    if (!analysis) throw new Error(`${manifest.id} is missing required workflow ${workflowID}`)
    if (analysis.structure !== "flat_planner_parallel_workers") {
      throw new Error(`${manifest.id}/${workflowID} must be Planner-first with one parallel worker frontier`)
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
