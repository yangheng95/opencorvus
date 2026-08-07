import { createInstanceState } from "@/project/instance-state"

/**
 * Per-Instance orchestrator state — extracted from `engine/helpers.ts` so
 * that the engine barrel (`engine/index.ts`) does not transitively force
 * `Instance.state(...)` to run at module-init time on every consumer of the
 * barrel.
 *
 * Uses the leaf `createInstanceState` factory so module initialization does
 * not depend on the full Instance manager.
 *
 * Kept in its own file (and deliberately NOT re-exported from
 * `engine/index.ts`) so accessing `orchestratorState` never goes through
 * the barrel. Its two consumers (`engine/runtime.ts`, `task-api/index.ts`)
 * deep-import from here.
 */

export const orchestratorState = createInstanceState(
  () => ({
    booted: false,
    syncing: false,
  }),
  undefined,
  "engine-orchestrator",
)
