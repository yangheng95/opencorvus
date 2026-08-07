/**
 * `build` agent — Task-scoped code-writing agent with optional exact Delivery
 * Slice revision subjects.
 *
 * Public surface:
 *   - BuildAgent.run({ taskID, workScope: { kind: "task" }, message, ... }) → BuildAgent.RunOutput
 *   - BuildTarget — the complete Task request used by one Task-scoped Build execution.
 */
export { BuildAgent } from "./agent"
export type { BuildTarget } from "./types"
