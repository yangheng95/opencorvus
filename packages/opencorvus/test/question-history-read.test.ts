import { afterEach, expect, test } from "bun:test"
import { Bus } from "../src/bus"
import { Question } from "../src/question"
import { Session } from "../src/session"
import { Instance } from "../src/project/instance"
import { Identifier } from "../src/id/id"
import { ProtocolStore } from "../src/protocol/store"
import { ensureSessionProtocolBridge, standaloneQuestionSnapshot } from "../src/protocol/session-mirror"
import { SessionResolvedQuestion } from "../src/engine/model"
import { timelineOrderKey } from "../src/timeline/order"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("canonical resolved Question snapshots preserve all terminal provenance and original Requests without a physical waiter", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Resolved Question facts" })
      ensureSessionProtocolBridge()
      const live: any[] = []
      const stop = ProtocolStore.subscribeEvents(
        (event) => {
          if (event.sessionID === session.id && event.type.startsWith("question.")) live.push(event)
        },
        { aggregate: "session" },
      )
      const original: Question.PublicationFacts[] = [],
        base = Date.now()
      try {
        for (const [index, kind] of ["replied", "automatic", "rejected", "expired", "abandoned"].entries()) {
          const request: Question.Request = {
            id: Identifier.ascending("question"),
            sessionID: session.id,
            timeCreated: base + index,
            questions: [
              {
                header: "Original choice",
                question: "Keep the accepted answer?",
                custom: true,
                options: [{ value: "confirm", label: "确认", description: "保留原始选择和原文" }],
              },
            ],
            tool: { messageID: "msg_original", callID: "call_" + index },
          }
          await Bus.publishOwned(Question.Event.Asked, request).retry()
          const common = { sessionID: session.id, requestID: request.id, timeResolved: base + 100 + index }
          if (kind === "replied" || kind === "automatic") {
            await Bus.publishOwned(Question.Event.Replied, {
              ...common,
              answers: [["confirm", "原始回答，不改写。"]],
              ...(kind === "automatic" ? { automatic: true } : {}),
            }).retry()
          } else if (kind === "rejected") {
            await Bus.publishOwned(Question.Event.Rejected, { ...common, origin: "operator" }).retry()
          } else if (kind === "expired") {
            await Bus.publishOwned(Question.Event.Expired, {
              ...common,
              origin: "deadline",
              timeExpires: base + 50,
            }).retry()
          } else {
            await Bus.publishOwned(Question.Event.Abandoned, { ...common, origin: "infrastructure" }).retry()
          }
          original.push(
            Question.publicationFacts({ projectID: Instance.project.id, sessionID: session.id, requestID: request.id }),
          )
        }
        const history = Question.publicationHistory({ projectID: Instance.project.id, sessionIDs: [session.id] })
        expect(history.sort((a, b) => a.request.id.localeCompare(b.request.id))).toEqual(
          [...original].sort((a, b) => a.request.id.localeCompare(b.request.id)),
        )
        const projected = standaloneQuestionSnapshot(
          Instance.project.id,
          new Set([session.id]),
          [],
        ).resolvedQuestions.map((event) => SessionResolvedQuestion.parse(event))
        expect(
          projected.map((event) => ({ id: event.payload.request.id, type: event.type, time: event.emittedAt })),
        ).toEqual(
          original.map((facts) => ({
            id: facts.request.id,
            type: facts.terminal!.type,
            time: facts.terminal!.properties.timeResolved,
          })),
        )
        for (const [index, event] of projected.entries()) {
          const { orderKey, ...request } = event.payload.request
          expect(request).toEqual(original[index]!.request)
          expect(orderKey).toBe(timelineOrderKey({ domain: "interaction", time: request.timeCreated, id: request.id }))
          expect(event.event_id).toBe(original[index]!.terminal!.occurrenceID)
          expect(event.payload).toMatchObject(original[index]!.terminal!.properties)
        }
        expect(live.map((event) => event.payload?.request)).toEqual(projected.map((event) => event.payload.request))
        const stalePhysical = standaloneQuestionSnapshot(
          Instance.project.id,
          new Set([session.id]),
          original.map((facts) => facts.request),
        )
        expect(stalePhysical).toEqual({ pendingQuestions: [], resolvedQuestions: projected })
      } finally {
        stop()
      }
    },
  })
}, 30_000)

test("resolved Question reads use the admitted Project and exact Session set", async () => {
  await using first = await memoryProject("question-history-first")
  await using second = await memoryProject("question-history-second")
  const owners: Array<{ projectID: string; sessionID: string; requestID: string }> = []
  for (const project of [first, second])
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Exact history owner" })
        const request: Question.Request = {
          id: Identifier.ascending("question"),
          sessionID: session.id,
          timeCreated: Date.now(),
          questions: [{ header: "Owner", question: "Confirm this owner", options: [] }],
        }
        await Bus.publishOwned(Question.Event.Asked, request).retry()
        await Bus.publishOwned(Question.Event.Replied, {
          sessionID: session.id,
          requestID: request.id,
          timeResolved: Date.now(),
          answers: [[project.path]],
        }).retry()
        owners.push({ projectID: Instance.project.id, sessionID: session.id, requestID: request.id })
      },
    })
  await Instance.provide({
    directory: first.path,
    fn: async () => {
      const own = owners[0]!
      const set = new Set(owners.map((owner) => owner.sessionID))
      expect(
        standaloneQuestionSnapshot(own.projectID, set, []).resolvedQuestions.map((event) => ({
          sessionID: event.session_id,
          requestID: event.payload.request.id,
        })),
      ).toEqual([{ sessionID: own.sessionID, requestID: own.requestID }])
      expect(
        Question.publicationHistory({ projectID: own.projectID, sessionIDs: [...set] }).map(
          (facts) => facts.request.id,
        ),
      ).toEqual([own.requestID])
    },
  })
}, 30_000)
