import type { LanguageModel } from "ai"
import z from "zod"
import { resolveAgentModel } from "@/agent/model"
import { EffectiveConfig } from "@/config/effective"
import { streamText } from "@/llm/api"
import { Provider } from "@/provider/provider"
import { ProviderLLM } from "@/provider/llm"
import type { AcceptanceSpec } from "@/acceptance/types"
import { WalkthroughStepSchema, WalkthroughStepsSchema, type WalkthroughStep } from "./dsl"

const TranslateOutputSchema = z.object({ steps: WalkthroughStepsSchema })

type TranslateScenarioInput = {
  spec: AcceptanceSpec
  taskID?: string
  sessionID?: string
}

export type TranslateScenarioDependencies = {
  resolveModel: (input: TranslateScenarioInput) => Promise<Provider.Model>
  getLanguage: (model: Provider.Model, input: TranslateScenarioInput) => Promise<LanguageModel>
  stream: typeof streamText
}

export type WalkthroughTranslation = {
  finalText: string
  steps?: WalkthroughStep[]
  parseObservation?: string
}

export async function resolveWalkthroughTranslationModel(
  input: TranslateScenarioInput,
  resolver: typeof resolveAgentModel = resolveAgentModel,
): Promise<Provider.Model> {
  return resolver("summary", { taskID: input.taskID, sessionID: input.sessionID })
}

const defaultDependencies: TranslateScenarioDependencies = {
  resolveModel: resolveWalkthroughTranslationModel,
  getLanguage: async (model, input) => {
    const config = await EffectiveConfig.effective({ taskID: input.taskID, sessionID: input.sessionID })
    return Provider.getLanguage(model, { config })
  },
  stream: streamText,
}

export async function translateScenarioToSteps(input: TranslateScenarioInput): Promise<WalkthroughTranslation> {
  return translateScenarioToStepsWithDependencies(input, defaultDependencies)
}

export async function translateScenarioToStepsWithDependencies(
  input: TranslateScenarioInput,
  dependencies: TranslateScenarioDependencies,
): Promise<WalkthroughTranslation> {
  if (!input.spec.scenario) throw new Error(`acceptance spec ${input.spec.id} has no scenario`)
  const model = await dependencies.resolveModel(input)
  const language = ProviderLLM.wrapModel(await dependencies.getLanguage(model, input), model, {})
  const result = dependencies.stream({
    model: language,
    usagePurpose: "acceptance-translation",
    prompt: [
      "Convert this Gherkin acceptance scenario into browser walkthrough steps.",
      'Reply with one visible JSON object using exactly this shape: {"steps":[...]}',
      "Do not call a submission tool and do not wrap the JSON in Markdown fences.",
      "Use only: goto, fill, click, assertPath, assertSelector, assertText.",
      "assertPath uses path substring matching, so /chat matches /chat/abc123.",
      "Use assertSelector with present=false only for UI that must be absent.",
      "The final step must be assertPath or assertSelector.",
      "Example 1:",
      "Given: the login page is open; When: the user enters email and password and submits; Then: the chat page is visible",
      `Steps: ${JSON.stringify([
        { action: "goto", path: "/login" },
        { action: "fill", selector: "input[name='email']", value: "user@example.com" },
        { action: "fill", selector: "input[name='password']", value: "password" },
        { action: "click", selector: "button[type='submit']" },
        { action: "assertPath", path: "/chat" },
        { action: "assertSelector", selector: "[data-testid='chat-shell']" },
      ])}`,
      "Example 2:",
      "Given: the settings page is open; When: the user views the form; Then: no validation error is shown and the save button is present",
      `Steps: ${JSON.stringify([
        { action: "goto", path: "/settings" },
        { action: "assertSelector", selector: "[role='alert']", present: false },
        { action: "assertSelector", selector: "button[type='submit']" },
      ])}`,
      `Spec id: ${input.spec.id}`,
      `Title: ${input.spec.title}`,
      `Given: ${input.spec.scenario.given.join("; ")}`,
      `When: ${input.spec.scenario.when.join("; ")}`,
      `Then: ${input.spec.scenario.then.join("; ")}`,
    ].join("\n"),
    timeoutMs: 60_000,
  })
  let finalText = ""
  for await (const part of result.fullStream) {
    if (isErrorPart(part)) throw new Error(`scenario walkthrough translation failed: ${String(part.error)}`)
    if (isTextDeltaPart(part)) finalText += part.text
  }
  const visibleText = finalText.trim()
  if (!visibleText) {
    return {
      finalText,
      parseObservation: `scenario walkthrough translation produced no visible final text for ${input.spec.id}`,
    }
  }
  let decoded: unknown
  try {
    decoded = JSON.parse(visibleText)
  } catch (error) {
    return {
      finalText,
      parseObservation: `scenario walkthrough translation returned invalid JSON for ${input.spec.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
  const parsed = TranslateOutputSchema.safeParse(decoded)
  if (!parsed.success) {
    return {
      finalText,
      parseObservation: `scenario walkthrough translation returned invalid steps for ${input.spec.id}: ${z.prettifyError(parsed.error)}`,
    }
  }
  const steps = parsed.data.steps
  const last = steps.at(-1)
  if (!last || (last.action !== "assertPath" && last.action !== "assertSelector")) {
    return {
      finalText,
      parseObservation: "scenario walkthrough final step must be assertPath or assertSelector",
    }
  }
  return { finalText, steps }
}

function isTextDeltaPart(part: unknown): part is { type: "text-delta"; text: string } {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as { type?: unknown }).type === "text-delta" &&
    typeof (part as { text?: unknown }).text === "string"
  )
}

function isErrorPart(part: unknown): part is { type: string; error: unknown } {
  return typeof part === "object" && part !== null && (part as { type?: unknown }).type === "error"
}

export function parseWalkthroughStep(input: unknown) {
  return WalkthroughStepSchema.parse(input)
}
