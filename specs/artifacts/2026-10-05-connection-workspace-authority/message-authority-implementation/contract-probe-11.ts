import { DynamicAgentIDSchema } from "../packages/opencorvus/src/agent/dynamic-agent-id"
import { ExpertSquadDynamicAgentIDSchema } from "../packages/sdk/js/src/expert-squad-manifest-v2"
const rows = ["research-worker", "user", "orchestrator", "shared", "universal-build"].map((input) => ({
  input,
  runtime: DynamicAgentIDSchema.safeParse(input),
  package: ExpertSquadDynamicAgentIDSchema.safeParse(input),
}))
console.log(JSON.stringify({time: new Date().toISOString(), rows}, null, 2))
