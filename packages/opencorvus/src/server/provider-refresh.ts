import { NativeAgentRegistryLifecycle } from "@/agent/native-agent-registry-lifecycle"
import { Provider } from "@/provider/provider"

export async function settleProviderRefreshInvalidation(
  operations: ReadonlyArray<{ phase: string; run: () => Promise<void> }>,
): Promise<Provider.LoadIssue[]> {
  const settled = await Promise.allSettled(operations.map((operation) => operation.run()))
  return settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return []
    return [
      {
        phase: operations[index].phase,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      },
    ]
  })
}

export function settleCanonicalProviderCatalogInvalidation(): Promise<Provider.LoadIssue[]> {
  return settleProviderRefreshInvalidation([
    { phase: "cache.provider", run: Provider.resetAll },
    { phase: "cache.native-agents", run: NativeAgentRegistryLifecycle.resetAll },
  ])
}
