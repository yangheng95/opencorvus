export namespace BrowserMCPNodeBundleContract {
  export const sourceExportConditions = Object.freeze(["source"] as const)

  export function bunCliConditionArgs(): string[] {
    return sourceExportConditions.map((condition) => `--conditions=${condition}`)
  }
}
