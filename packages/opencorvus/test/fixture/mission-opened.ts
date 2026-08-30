import {
  currentMissionExecutionClosure,
  missionOperatorWakeReason,
  openMissionExecutionWithWake,
} from "@/mission/execution-closure"
import { SessionWake } from "@/session/wake"
import { Config } from "@/config/config"

export async function openMissionThroughRealWake(input: {
  missionID: string
  sessionID: string
  source: "mission.dispatch" | "mission.wake"
  requestID: string
}) {
  const text = `Open Mission execution through ${input.requestID}`
  const model = "mission-open-fixture/wake-model"
  await Config.updateProjectPatch({
    model,
    provider: {
      "mission-open-fixture": {
        name: "Mission real-open fixture provider",
        npm: "@ai-sdk/openai-compatible",
        api: "http://127.0.0.1:1/v1",
        models: {
          "wake-model": {
            name: "Mission real-open fixture model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 32_000, output: 4_096 },
          },
        },
      },
    },
  })
  using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
  await openMissionExecutionWithWake({
    ...input,
    acceptedInput: {
      text,
      model,
      attachments: [],
      configPatch: { model },
      context: { surface: "test.real-mission-open" },
    },
    wake: (admission) =>
      SessionWake.wakeWithReceipt({
        sessionID: input.sessionID,
        messageID: admission.messageID,
        textPartID: admission.textPartID,
        controlID: admission.controlID,
        prompt: text,
        author: "user",
        agent: "mission",
        surface: "panel",
        userAuthored: true,
        reason: missionOperatorWakeReason(admission, input.missionID),
        commitBundle: admission.commitBundle,
        preflightBundle: admission.preflightBundle,
        ownerPreflight: admission.ownerPreflight,
        ownerLifecycle: admission.ownerLifecycle,
      }),
  })
  const opened = currentMissionExecutionClosure(input.sessionID)
  if (!opened || opened.state !== "opened") throw new Error(`Mission ${input.missionID} did not open`)
  return opened
}
