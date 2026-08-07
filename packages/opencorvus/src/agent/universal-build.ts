export const UNIVERSAL_BUILD_AGENT_ID = "universal-build"
export const UNIVERSAL_BUILD_LABEL = "Universal Build"
export const UNIVERSAL_BUILD_DESCRIPTION =
  "Repairs concrete repository defects and completes bounded implementation work that no narrower package-owned agent contract owns."

export function isUniversalBuildAgentID(agentID: string): boolean {
  return agentID === UNIVERSAL_BUILD_AGENT_ID
}
