import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { resolveAgentModel } from "@/agent/model"
import { EffectiveConfig } from "@/config/effective"
import { streamText } from "@/llm/api"
import { Provider } from "@/provider/provider"
import { ProviderLLM } from "@/provider/llm"
import { Vcs } from "@/project/vcs"

export const VCS_COMMIT_MESSAGE_CONFIG = {
  contextCharacters: 60_000,
  diffContextLines: 3,
  recentSubjectCount: 8,
  subjectCharacters: 160,
} as const

interface CommitMessageInput {
  taskID?: string
  sessionID?: string
  signal?: AbortSignal
  onDelta?: (delta: string) => void | Promise<void>
}

interface CommitMessageContext {
  files: Vcs.FileDiff[]
  recentSubjects: string[]
}

function appendWithinLimit(parts: string[], value: string, used: number): number {
  const remaining = VCS_COMMIT_MESSAGE_CONFIG.contextCharacters - used
  if (remaining <= 0) return used
  const next = value.slice(0, remaining)
  parts.push(next)
  return used + next.length
}

export function buildCommitMessageContext(input: CommitMessageContext): string {
  const parts: string[] = []
  let used = 0
  used = appendWithinLimit(
    parts,
    [
      "Recent commit subjects from this repository:",
      ...(input.recentSubjects.length > 0 ? input.recentSubjects.map((subject) => `- ${subject}`) : ["- none"]),
      "",
      "Current working-tree changes:",
    ].join("\n"),
    used,
  )
  for (const file of input.files) {
    used = appendWithinLimit(
      parts,
      `\n\n### ${file.file} (${file.status ?? "modified"}, +${file.additions} -${file.deletions})`,
      used,
    )
    if (file.patch) used = appendWithinLimit(parts, `\n${file.patch}`, used)
    else if (file.patchTruncated)
      used = appendWithinLimit(parts, "\n[patch omitted because it exceeded the VCS limit]", used)
    if (used >= VCS_COMMIT_MESSAGE_CONFIG.contextCharacters) break
  }
  return parts.join("")
}

export function normalizeCommitMessage(value: string): string {
  const subject =
    value
      .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  return subject
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()
    .slice(0, VCS_COMMIT_MESSAGE_CONFIG.subjectCharacters)
}

export async function streamCommitMessage(input: CommitMessageInput): Promise<string> {
  const [files, recentSubjects] = await Promise.all([
    Vcs.diff("git", { context: VCS_COMMIT_MESSAGE_CONFIG.diffContextLines }),
    Vcs.recentSubjects(VCS_COMMIT_MESSAGE_CONFIG.recentSubjectCount),
  ])
  if (files.length === 0) {
    throw new Vcs.PrerequisiteError({
      reason: "nothing_to_commit",
      message: "vcs commit message requires working-tree changes",
    })
  }

  const resolutionScope =
    input.taskID || input.sessionID ? { taskID: input.taskID, sessionID: input.sessionID } : undefined
  const config = await EffectiveConfig.effective(resolutionScope)
  const helper = await HelperAgentRegistry.get("summary", { config })
  const model = await resolveAgentModel(helper.name, resolutionScope)
  const language = ProviderLLM.wrapModel(await Provider.getLanguage(model, { config }), model, {})
  const context = buildCommitMessageContext({ files, recentSubjects })
  const messages = [
    {
      role: "system" as const,
      content:
        "Generate exactly one concise Git commit subject for the supplied repository changes. Match the repository's recent subject style when it is consistent. Describe the actual change, use imperative wording, output no quotes, Markdown, body, explanation, or blank line.",
    },
    { role: "user" as const, content: context },
  ]
  const result = streamText({
    model: language,
    usagePurpose: "vcs-commit-message",
    temperature: model.providerID.startsWith("moonshotai") ? 1 : 0,
    messages,
    abortSignal: input.signal,
    timeoutMs: false,
  })

  let raw = ""
  try {
    for await (const delta of result.textStream) {
      raw += delta
      await input.onDelta?.(delta)
    }
    const message = normalizeCommitMessage(raw)
    if (!message) throw new Error("AI returned an empty Git commit message")
    const { AgentTrace } = await import("@/trace")
    if (AgentTrace.isEnabled() && input.taskID) {
      AgentTrace.recordHelperLLMCall({
        taskID: input.taskID,
        agentName: "vcs-commit-message",
        model: { providerID: model.providerID, modelID: model.id },
        requestRef: `task:${input.taskID}:vcs-commit-message`,
        outcome: "success",
      })
    }
    return message
  } catch (error) {
    const { AgentTrace } = await import("@/trace")
    if (AgentTrace.isEnabled() && input.taskID) {
      AgentTrace.recordHelperLLMCall({
        taskID: input.taskID,
        agentName: "vcs-commit-message",
        model: { providerID: model.providerID, modelID: model.id },
        requestRef: `task:${input.taskID}:vcs-commit-message`,
        outcome: "error",
        error: error instanceof Error ? error.message : String(error),
      })
    }
    throw error
  }
}
