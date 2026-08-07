// Each provider already has the correct baseURL in its model database:
//   alibaba-cn            → https://dashscope.aliyuncs.com/compatible-mode/v1
//   alibaba-coding-plan-cn → https://coding.dashscope.aliyuncs.com/v1
// Do NOT override baseURL based on key prefix — that mixes the two endpoints.
export function applyProviderPolicy(_providerID: string, _options: Record<string, any>) {
  // no-op: provider URLs are authoritative from the model database
}
