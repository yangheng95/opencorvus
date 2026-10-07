import {
  analyzeExpertSquadWorkflowTopology,
  validateExpertSquadManifestDispatchTopology,
} from "../../sdk/js/src/expert-squad-authoring"
import path from "node:path"

const repositoryRoot = path.resolve(import.meta.dir, "..", "..", "..")
const manifestPaths = [
  ...new Bun.Glob("expert-squads/builtin/*/expert-squad.jsonc").scanSync(repositoryRoot),
  ...new Bun.Glob("packages/opencorvus/src/expert-squad/builtin/*/expert-squad.jsonc").scanSync(repositoryRoot),
].sort()

const summaries: Array<{
  id: string
  workflows: number
  flat: number
  parallelJoins: number
  dependencyDags: number
}> = []

for (const relativePath of manifestPaths) {
  const absolutePath = path.join(repositoryRoot, relativePath)
  const manifest = validateExpertSquadManifestDispatchTopology(Bun.JSONC.parse(await Bun.file(absolutePath).text()))
  const analyses = analyzeExpertSquadWorkflowTopology(manifest)
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
