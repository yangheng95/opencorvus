import type { SelectedTaskRecoveryScheduler } from "../../src/services/selected-task-recovery"

function unexpectedRecovery(reason: string, taskID: string): Promise<number> {
  return Promise.reject(new Error(`unexpected selected-task recovery for ${taskID}: ${reason}`))
}

export const unexpectedSelectedTaskRecoveryScheduler: SelectedTaskRecoveryScheduler = {
  recoverConversation: unexpectedRecovery,
  recoverAfterRewindClear: unexpectedRecovery,
}
