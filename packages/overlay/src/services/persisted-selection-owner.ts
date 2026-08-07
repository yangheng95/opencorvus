export interface PersistedSelectionFailure<Confirmed> {
  error: unknown
  confirmed: Readonly<Confirmed>
}

export interface PersistedSelectionOwner<Value> {
  select(next: Value): Promise<boolean>
  invalidate(): void
}

export function createPersistedSelectionOwner<Value, Confirmed>(input: {
  read: () => Value
  write: (value: Value) => void
  confirmedValue: (settings: Readonly<Confirmed>) => Value
  persist: (
    snapshot: Value,
    onFailure: (failure: PersistedSelectionFailure<Confirmed>) => void,
  ) => Promise<void>
  onCurrentFailure: (error: unknown) => void
}): PersistedSelectionOwner<Value> {
  let generation = 0
  let pending:
    | {
        snapshot: Value
        generation: number
        result: Promise<boolean>
      }
    | undefined

  return {
    async select(next) {
      if (pending?.snapshot === next) return pending.result
      if (next === input.read()) return true
      const snapshot = next
      const operationGeneration = ++generation
      const ownsOperation = () => operationGeneration === generation
      input.write(snapshot)
      const operation = {
        snapshot,
        generation: operationGeneration,
        result: Promise.resolve(false),
      }
      operation.result = (async () => {
        try {
          await input.persist(snapshot, ({ error, confirmed }) => {
            if (!ownsOperation()) return
            input.write(input.confirmedValue(confirmed))
            input.onCurrentFailure(error)
          })
        } catch {
          return false
        } finally {
          if (pending === operation) pending = undefined
        }
        return ownsOperation()
      })()
      pending = operation
      return operation.result
    },
    invalidate() {
      generation += 1
      pending = undefined
    },
  }
}
