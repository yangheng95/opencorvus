import { SessionCommand } from "../command-exec"
import { SessionLoop } from "../loop"
import { SessionShell } from "../shell-exec"
import { resolvePromptParts as resolvePromptPartsImpl } from "./parts"
import { PromptInput as PromptInputSchema, type PromptInput as PromptInputType } from "./schema"
import { SessionPromptState } from "./state"
import { continuePersistedUserMessage, runSessionPrompt, type PromptRuntimeHooks } from "./run"
import type { PersistedUserMessageReceipt } from "./parts"
import type { ExecutionCancellationOrigin } from "./cancellation"

export namespace SessionPrompt {
  export const assertNoOwnedPrompt = SessionPromptState.assertNoOwnedPrompt
  export const cancel = (sessionID: string, directory: string | undefined, origin: ExecutionCancellationOrigin) => {
    return SessionPromptState.cancel(sessionID, directory, { origin })
  }
  export const hasOwnedPrompt = SessionPromptState.hasOwnedPrompt
  export const hasOwnedPromptInAnyDirectory = SessionPromptState.hasOwnedPromptInAnyDirectory
  export const waitForFinish = SessionPromptState.waitForFinish
  export const ownerActivity = SessionPromptState.activity
  export const messageOwner = SessionPromptState.messageOwner
  export const promptOwner = SessionPromptState.promptOwner
  export const hasGeneration = SessionPromptState.hasGeneration
  export const withPromptOwnerCapture = SessionPromptState.withPromptOwnerCapture
  export const capturePromptOwner = SessionPromptState.capturePromptOwner
  export const cancelOwned = SessionPromptState.cancelOwned
  export const waitForOwnedFinish = SessionPromptState.waitForOwnedFinish

  export const {
    LoopInput,
    loop,
    resolveTools,
    createStructuredOutputTool,
    setSessionRuntimeContract,
    getSessionRuntimeContract,
    clearSessionRuntimeContract,
    validateSessionRuntimeContractForContinuation,
    sessionKindRequiresRuntimeContract,
    setStepHook,
    withStepHook,
  } = SessionLoop
  export const { ShellInput, shell } = SessionShell
  export type ShellInput = SessionShell.ShellInput
  export const CommandInput = SessionCommand.CommandInput
  export type CommandInput = SessionCommand.CommandInput

  export const PromptInput = PromptInputSchema
  export type PromptInput = PromptInputType
  export const resolvePromptParts = resolvePromptPartsImpl

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
