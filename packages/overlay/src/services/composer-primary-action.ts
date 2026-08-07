export type ComposerPrimaryAction = "send" | "stop"

export function composerPrimaryAction(input: { activeWork: boolean; hasDraft: boolean }): ComposerPrimaryAction {
  return input.activeWork && !input.hasDraft ? "stop" : "send"
}
