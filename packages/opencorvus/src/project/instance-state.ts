import { State } from "./state"
import { currentProjectDirectory } from "./instance-context"

export function createInstanceState<S>(
  init: () => S,
  dispose: ((state: Awaited<S>) => Promise<void>) | undefined,
  label: string,
): (() => S) & { reset(): Promise<void>; resetAll(): Promise<void> } {
  return State.create(currentProjectDirectory, init, dispose, label)
}
