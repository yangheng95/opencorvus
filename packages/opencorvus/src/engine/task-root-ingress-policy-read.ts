import { Database, eq } from "@/storage/db"
import { EngineTaskRootIngressPolicyTable, EngineTaskRootIngressTable } from "./engine.sql"

/** Read the immutable policy already bound to one accepted ingress without
 * importing the fact-store/reducer graph into SessionLoop. */
export function taskRootIngressSemanticTurnLimit(ingressID: string): number {
  return Database.use((db) => {
    const row = db
      .select({ semanticTurnLimit: EngineTaskRootIngressPolicyTable.semantic_turn_limit })
      .from(EngineTaskRootIngressTable)
      .innerJoin(
        EngineTaskRootIngressPolicyTable,
        eq(EngineTaskRootIngressPolicyTable.id, EngineTaskRootIngressTable.policy_id),
      )
      .where(eq(EngineTaskRootIngressTable.id, ingressID))
      .get()
    if (!row) throw new Error(`Task-root ingress ${ingressID} has no immutable policy`)
    return row.semanticTurnLimit
  })
}
