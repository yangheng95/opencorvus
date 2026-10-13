export interface ConfigMutationReceipt {
  name: "GlobalConfigCommittedReconcileError" | "ProjectConfigCommittedReconcileError"
  data: {
    committed: true
    message: string
    config: Record<string, unknown>
    failures: string[]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Read the complete envelope emitted by Config.committedMutationReceipt. */
export function readConfigMutationReceipt(value: unknown): ConfigMutationReceipt | undefined {
  if (!isRecord(value)) return undefined
  if (value.name !== "GlobalConfigCommittedReconcileError" && value.name !== "ProjectConfigCommittedReconcileError") {
    return undefined
  }
  const data = value.data
  if (
    !isRecord(data) ||
    data.committed !== true ||
    typeof data.message !== "string" ||
    !isRecord(data.config) ||
    !Array.isArray(data.failures) ||
    !data.failures.every((failure) => typeof failure === "string")
  ) {
    return undefined
  }
  return value as unknown as ConfigMutationReceipt
}

/** Keep the committed configuration exclusively in the business receipt. */
export function configMutationReceiptDiagnostic(receipt: ConfigMutationReceipt) {
  return {
    name: receipt.name,
    data: {
      committed: true as const,
      message: receipt.data.message,
      failures: receipt.data.failures,
    },
  }
}
