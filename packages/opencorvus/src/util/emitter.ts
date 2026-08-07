/**
 * TypedEventEmitter - A type-safe event emitter implementation
 *
 * Design Intent:
 * - Provides full TypeScript type safety for event names and their parameter types
 * - Uses Map + Set for efficient listener storage and automatic deduplication
 * - Returns unsubscribe functions from on()/once() for convenient cleanup
 * - Follows high cohesion and loose coupling principles
 */

/**
 * TypedEventEmitter class with full type safety
 * @template Events - A record type mapping event names to their parameter arrays
 *
 * Example usage:
 * ```typescript
 * type MyEvents = {
 *   'data': [string, number],
 *   'error': [Error]
 * }
 * const emitter = new TypedEventEmitter<MyEvents>()
 * emitter.on('data', (str, num) => { ... })
 * emitter.emit('data', 'hello', 42)
 * ```
 */
export class TypedEventEmitter<Events extends Record<keyof Events, any[]>> {
  // Internal storage: Map<eventName, Set<callbacks>>
  // Using Set automatically handles listener deduplication
  private listeners = new Map<keyof Events, Set<(...args: any[]) => void>>()

  /**
   * Register an event listener
   * @param event - The event name to listen to
   * @param callback - The callback function to invoke when event is emitted
   * @returns An unsubscribe function to remove this listener
   *
   * Type safety: Event name and callback parameters must match the Events type
   */
  on<K extends keyof Events>(event: K, callback: (...args: Events[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Return unsubscribe function for convenient cleanup
    return () => {
      this.off(event, callback)
    }
  }

  /**
   * Remove an event listener
   * @param event - The event name to remove listener from
   * @param callback - The callback function to remove
   * @returns true if the listener was successfully removed, false otherwise
   *
   * Note: Uses Set.delete() which returns false if the callback was not found
   */
  off<K extends keyof Events>(event: K, callback: (...args: Events[K]) => void): boolean {
    const set = this.listeners.get(event)
    if (!set) {
      return false
    }
    const result = set.delete(callback)
    // Clean up empty listener sets to prevent memory leaks
    if (set.size === 0) {
      this.listeners.delete(event)
    }
    return result
  }

  /**
   * Emit an event with parameters
   * @param event - The event name to emit
   * @param args - The parameters to pass to all listeners
   * @returns true if the event has listeners, false otherwise
   *
   * Note: All listeners are invoked synchronously in registration order
   * Listener exceptions will propagate to the caller
   */
  emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    const set = this.listeners.get(event)
    if (!set || set.size === 0) {
      return false
    }
    // Iterate over Set using forEach for better compatibility
    // Callbacks are invoked in insertion order
    set.forEach((callback) => {
      callback(...args)
    })
    return true
  }

  /**
   * Register a one-time event listener
   * @param event - The event name to listen to
   * @param callback - The callback function to invoke on first event
   * @returns An unsubscribe function to remove this listener
   *
   * The listener is automatically removed after it is invoked once.
   * The unsubscribe function can be used to cancel before the event fires.
   */
  once<K extends keyof Events>(event: K, callback: (...args: Events[K]) => void): () => void {
    // Create a wrapper that removes itself after first invocation
    const wrapper = (...args: Events[K]) => {
      this.off(event, wrapper)
      callback(...args)
    }
    return this.on(event, wrapper)
  }

  /**
   * Get the number of listeners for an event
   * @param event - Optional event name. If omitted, returns total count across all events
   * @returns Number of listeners for the specified event, or total count if no event specified
   *
   * Type safety: Event name must be a valid key from the Events type
   */
  listenerCount<K extends keyof Events>(event?: K): number {
    if (event !== undefined) {
      const set = this.listeners.get(event)
      return set ? set.size : 0
    }
    // Sum all listeners across all events using forEach for compatibility
    let total = 0
    this.listeners.forEach((set) => {
      total += set.size
    })
    return total
  }
}
