/** Native conversation assignment references must survive configuration normalization. */
export function isConversationMcpRef(name: string): boolean {
  return name.length > 0 && name === name.trim()
}
