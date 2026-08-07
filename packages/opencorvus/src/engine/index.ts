/**
 * Public API barrel for the engine module.
 *
 * External callers import from "@/engine" — never from sub-modules directly.
 * Internal engine files may still use relative imports between siblings.
 */
export * from "./store"
export * from "./persist"
export * from "./state"
export * from "./helpers"
export * from "./model"
export * from "./config"
export * from "./protocol"
export * from "./task-status"
export * from "./agent-coordination"
export {
  EngineTaskTable,
  EngineGoalTable,
  EngineArtifactTable,
  EngineProgressSnapshotTable,
  EngineInteractionRequestTable,
  EngineChannelBindingTable,
} from "./engine.sql"
export type {
  EngineBudget,
  EngineMetadata,
  EngineTaskStatus,
  EngineTaskPriority,
  EngineInteractionStatus,
  EngineArtifactKind,
} from "./engine.sql"
