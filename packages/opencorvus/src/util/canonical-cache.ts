import type { CanonicalDigestSource } from "@/util/canonical-digest"

type Entry<T> = {
  bytes: string
  value: T
}

/** SHA-256 is an index only; canonical bytes remain the equality authority. */
export class CanonicalCache<T> {
  private readonly buckets = new Map<string, Entry<T>[]>()

  get size(): number {
    let count = 0
    for (const bucket of this.buckets.values()) count += bucket.length
    return count
  }

  get(source: CanonicalDigestSource): T | undefined {
    return this.buckets.get(source.sha256)?.find((entry) => entry.bytes === source.bytes)?.value
  }

  set(source: CanonicalDigestSource, value: T): void {
    const bucket = this.buckets.get(source.sha256) ?? []
    const existing = bucket.find((entry) => entry.bytes === source.bytes)
    if (existing) existing.value = value
    else bucket.push({ bytes: source.bytes, value })
    this.buckets.set(source.sha256, bucket)
  }

  delete(source: CanonicalDigestSource, value?: T): void {
    const bucket = this.buckets.get(source.sha256)
    if (!bucket) return
    const retained = bucket.filter((entry) => entry.bytes !== source.bytes || (value !== undefined && entry.value !== value))
    if (retained.length === 0) this.buckets.delete(source.sha256)
    else this.buckets.set(source.sha256, retained)
  }

  clear(): number {
    const detached = this.size
    this.buckets.clear()
    return detached
  }
}
