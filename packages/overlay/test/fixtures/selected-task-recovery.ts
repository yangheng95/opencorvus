import { createSelectedTaskRecoveryScheduler } from "../../src/services/selected-task-recovery"
import { startSSE } from "../../src/services/sse"

export const selectedTaskRecoveryScheduler = createSelectedTaskRecoveryScheduler(startSSE)
