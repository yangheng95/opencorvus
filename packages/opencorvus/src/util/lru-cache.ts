/**
 * Bounded least-recently-used cache backed by Map insertion order.
 * Reads promote entries; writes evict the oldest entry before insertion.
 */
export class LruCache<K, V> {
  private readonly values = new Map<K, V>()

  constructor(readonly limit: number) {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(`LruCache limit must be a positive integer (got ${limit})`)
    }
  }

  get size(): number {
    return this.values.size
  }

  peek(key: K): V | undefined {
    return this.values.get(key)
  }

  get(key: K): V | undefined {
    if (!this.values.has(key)) return undefined
    const value = this.values.get(key)!
    this.values.delete(key)
    this.values.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.values.has(key)) {
      this.values.delete(key)
    } else if (this.values.size >= this.limit) {
      const oldest = this.values.keys().next().value
      if (oldest !== undefined) this.values.delete(oldest)
    }
    this.values.set(key, value)
  }

  delete(key: K): boolean {
    return this.values.delete(key)
  }

  clear(): void {
    this.values.clear()
  }
}
