/** The shortest distinguishing suffix, retaining at least four characters
 * when the identity has that length. Equal IDs refer to the same identity. */
export function distinctIdentitySuffix(identity: string, identities: readonly string[]): string {
  const peers = identities.filter((peer) => peer !== identity)
  if (peers.length === 0) return ""
  let length = Math.min(4, identity.length)
  while (length < identity.length && peers.some((peer) => peer.endsWith(identity.slice(-length)))) length++
  return identity.slice(-length)
}
