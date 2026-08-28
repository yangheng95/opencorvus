import { SessionCommand } from "../command-exec"
import { SessionLoop } from "../loop"
import { SessionShell } from "../shell-exec"
import { resolvePromptParts as resolvePromptPartsImpl } from "./parts"
import { PromptInput as PromptInputSchema, type PromptInput as PromptInputType } from "./schema"
import { SessionPromptState } from "./state"
import {
  continuePersistedUserMessage,
  persistNoReplyUserMessageSequence,
  runSessionPrompt,
  type NoReplyUserMessageSequenceEntry,
  type PromptRuntimeHooks,
} from "./run"
import type { PersistedUserMessageReceipt } from "./parts"
import type { ExecutionCancellationOrigin } from "./cancellation"
import z from "zod"

export namespace SessionPrompt {
  export const assertNoOwnedPrompt = SessionPromptState.assertNoOwnedPrompt
  export const cancel = (sessionID: string, directory: string | undefined, origin: ExecutionCancellationOrigin) => {
    return SessionPromptState.cancel(sessionID, directory, { origin })
  }
  export const hasOwnedPrompt = SessionPromptState.hasOwnedPrompt
  export const hasOwnedPromptInAnyDirectory = SessionPromptState.hasOwnedPromptInAnyDirectory
  export const waitForFinish = SessionPromptState.waitForFinish
  export const release = SessionPromptState.release
  export const ownerActivity = SessionPromptState.activity
  export const messageOwner = SessionPromptState.messageOwner
  export const promptOwner = SessionPromptState.promptOwner
  export const hasGeneration = SessionPromptState.hasGeneration
  export const withPromptOwnerCapture = SessionPromptState.withPromptOwnerCapture
  export const capturePromptOwner = SessionPromptState.capturePromptOwner
  export const cancelOwned = SessionPromptState.cancelOwned
  export const waitForOwnedFinish = SessionPromptState.waitForOwnedFinish
  export const clearCancellationReceipt = SessionPromptState.clearCancellationReceipt

  export const LoopInput = z.lazy(() => SessionLoop.LoopInput)
  export const loop = (...args: Parameters<typeof SessionLoop.loop>) => SessionLoop.loop(...args)
  export const resolveTools = (...args: Parameters<typeof SessionLoop.resolveTools>) => SessionLoop.resolveTools(...args)
  export const createStructuredOutputTool = (...args: Parameters<typeof SessionLoop.createStructuredOutputTool>) => SessionLoop.createStructuredOutputTool(...args)
  export const setSessionRuntimeContract = (...args: Parameters<typeof SessionLoop.setSessionRuntimeContract>) => SessionLoop.setSessionRuntimeContract(...args)
  export const armSessionRuntimeContractWake = (...args: Parameters<typeof SessionLoop.armSessionRuntimeContractWake>) => SessionLoop.armSessionRuntimeContractWake(...args)
  export const waitForSessionRuntimeContractWakeSettlement = (...args: Parameters<typeof SessionLoop.waitForSessionRuntimeContractWakeSettlement>) => SessionLoop.waitForSessionRuntimeContractWakeSettlement(...args)
  export const getSessionRuntimeContract = (...args: Parameters<typeof SessionLoop.getSessionRuntimeContract>) => SessionLoop.getSessionRuntimeContract(...args)
  export const clearSessionRuntimeContract = (...args: Parameters<typeof SessionLoop.clearSessionRuntimeContract>) => SessionLoop.clearSessionRuntimeContract(...args)
  export const validateSessionRuntimeContractForContinuation = (...args: Parameters<typeof SessionLoop.validateSessionRuntimeContractForContinuation>) => SessionLoop.validateSessionRuntimeContractForContinuation(...args)
  export const sessionKindRequiresRuntimeContract = (...args: Parameters<typeof SessionLoop.sessionKindRequiresRuntimeContract>) => SessionLoop.sessionKindRequiresRuntimeContract(...args)
  export const setStepHook = (...args: Parameters<typeof SessionLoop.setStepHook>) => SessionLoop.setStepHook(...args)
  export const withStepHook = <T>(...args: Parameters<typeof SessionLoop.withStepHook<T>>) => SessionLoop.withStepHook<T>(...args)
  export type SessionRuntimeContract = SessionLoop.SessionRuntimeContract
  export const { ShellInput, shell } = SessionShell
  export type ShellInput = SessionShell.ShellInput
  export const CommandInput = SessionCommand.CommandInput
  export type CommandInput = SessionCommand.CommandInput

  export const PromptInput = PromptInputSchema
  export type PromptInput = PromptInputType
  export const resolvePromptParts = resolvePromptPartsImpl

  export async function persistNoReplySequence(entries: readonly NoReplyUserMessageSequenceEntry[]) {
    return persistNoReplyUserMessageSequence(
      entries.map((entry) => ({
        ...entry,
        input: PromptInput.parse(entry.input),
      })),
    )
  }

  async function runPrompt(input: PromptInputType, hooks?: PromptRuntimeHooks) {
    return runSessionPrompt(input, { ...hooks, loop })
  }

  export async function continuePersistedPrompt(
    input: PromptInputType,
    receipt: PersistedUserMessageReceipt,
    hooks?: PromptRuntimeHooks,
  ) {
    return continuePersistedUserMessage(PromptInput.parse(input), receipt, { ...hooks, loop })
  }

  export const prompt = Object.assign(
    (input: PromptInputType, hooks?: PromptRuntimeHooks) => runPrompt(PromptInput.parse(input), hooks),
    {
      force: (input: PromptInputType, hooks?: PromptRuntimeHooks) => runPrompt(input, hooks),
      schema: PromptInput,
    },
  )

  export const command = (input: CommandInput) => SessionCommand.command(input, prompt)
}
