/**
 * Goal contract type shared by every durable Goal producer and consumer.
 *
 * Invariants:
 * ① Goal rows are produced through the validated Goal contract boundary.
 * ② DB mapping is lossless: each field gets its own column, no compression.
 * ③ acceptance_specs is the Goal-local contract read by projected execution
 *    and review consumers; Core does not promise host-side scorer execution.
 * ④ owned_paths records collaboration responsibility, not a write sandbox.
 * ⑤ A Goal contract changes only through explicit validated Goal mutation;
 *    no producer, scheduler, or projected worker owns an implicit rewrite.
 */

import type { AcceptanceSpec } from "@/acceptance/types"

export interface GoalContractFields {
  /** Unique goal ID. */
  id: string
  /** Short goal title (standalone, not merged into description). */
  title: string
  /** What this goal accomplishes — the full objective statement. */
  objective: string
  /**
   * Typed Goal-local acceptance contracts consumed by projected execution and
   * review capabilities.
   */
  acceptance_specs: AcceptanceSpec[]
  /** Files this goal is responsible for coordinating; not an edit sandbox. */
  owned_paths: string[]
  /** blocking = must pass for task success. advisory = failure doesn't block. */
  priority: "blocking" | "advisory"
  /** Goal category. */
  kind: string
}
