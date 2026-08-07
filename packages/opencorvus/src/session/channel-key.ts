export function channelKey(
  input: { local: true; userID?: string } | { platform: string; channel: string; userID?: string },
) {
  const userID = input.userID?.trim() || "anonymous"
  if ("local" in input) return `local:${userID}`
  return `${input.platform.trim()}:${input.channel.trim()}:${userID}`
}
