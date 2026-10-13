import { formatErrorDetails } from "../utils/error-details"

export interface ProviderSaveIssue {
  stage?: string
  phase?: string
  providerID?: string
  resource?: string
  message: string
}

export interface ProviderSaveFollowup {
  phase: string
  run(): Promise<readonly ProviderSaveIssue[] | void>
}

/** Preserve each stage's result while observing the provider after writes settle. */
export async function settleProviderSaveFollowups(
  operations: readonly ProviderSaveFollowup[],
  owns: () => boolean,
): Promise<ProviderSaveIssue[]> {
  const issues: ProviderSaveIssue[] = []
  for (const operation of operations) {
    if (!owns()) break
    try {
      const result = await operation.run()
      if (result) {
        for (const issue of result) {
          issues.push({
            ...issue,
            stage: operation.phase,
          })
        }
      }
    } catch (error) {
      issues.push({ stage: operation.phase, message: formatErrorDetails(error) })
    }
  }
  return issues
}
