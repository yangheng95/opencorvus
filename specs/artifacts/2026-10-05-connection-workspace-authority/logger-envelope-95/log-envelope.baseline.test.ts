import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { TextWriter, Uint8ArrayReader, ZipReader } from "@zip.js/zip.js"
import { APICallError } from "ai"
import z from "zod"
import { Log } from "../src/util/log"
import { buildLogSupportBundle } from "../src/util/log-support-bundle"
import { Session } from "../src/session"
import { SessionContext } from "../src/session/context"
import { Instance } from "../src/project/instance"
import { Server } from "../src/server/server"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Log.close()
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function capture(caseID: string, inputs: unknown) {
  await Log.flush()
  const raw = await fs.readFile(Log.file(), "utf8")
  const records = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => z.record(z.string(), z.unknown()).parse(JSON.parse(line)))
  console.log("LOGGER_ENVELOPE_95", JSON.stringify({ caseID, inputs, raw, records }))
  return { raw, records }
}

function requiredRecord(records: Record<string, unknown>[], message: string) {
  const record = records.find((entry) => entry.message === message)
  if (!record) throw new Error(`Expected actual log record ${message}`)
  return record
}

test("canonical event envelope retains conflicting caller tags and fields as subject data", async () => {
  await Log.init({ print: false, dev: true })
  const tags = {
    service: "envelope95",
    time: "tag-time",
    level: "tag-level",
    message: "tag-message",
    sessionID: "caller-session",
  }
  const extra = {
    time: { created: 31, updated: 37 },
    level: "subject-level",
    message: "subject-message",
    service: "subject-service",
    sessionID: "request-session",
    logDomain: "subject-domain",
    value: 7,
  }
  Log.create(tags).clone().tag("actor", "request-actor").info("envelope95-conflicts", extra)
  const { records } = await capture("conflicts", { tags, extra })
  expect(requiredRecord(records, "envelope95-conflicts")).toMatchObject({
    time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
    level: "info",
    message: "envelope95-conflicts",
    service: "envelope95",
    logDomain: "non-session",
    data: { ...extra, actor: "request-actor" },
  })
})

test("actual Session subjects and buffered contexts keep distinct ambient and caller identity", async () => {
  await using project = await memoryProject("logger-envelope95-context")
  await Log.init({ print: false, dev: true })
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Logger envelope context" })
      const caller = await Session.create({ kind: "assistant", title: "Logger caller identity" })
      const logger = Log.create({ service: "envelope95-context" }).tag("sessionID", caller.id)
      const initialization = Log.init({ print: false, dev: true })
      SessionContext.provide(session, () => logger.info("envelope95-buffered", { value: 11 }))
      await initialization
      logger.info("envelope95-caller-only", { value: 13 })
      await Log.close()
      await Log.init({ print: false, dev: true })
      SessionContext.provide(session, () => logger.info("envelope95-reinitialized", { value: 17 }))
      const persisted = await Session.get(session.id)
      const { records } = await capture("session-context", { session, caller, persisted })
      const created = records.find(
        (record) =>
          record.message === "created" &&
          typeof record.data === "object" &&
          record.data !== null &&
          "id" in record.data &&
          record.data.id === session.id,
      )
      // Observe all actual records before asserting, including baseline's flat Session subject.
      expect({ persistedID: persisted.id, persistedTime: persisted.time }).toEqual({
        persistedID: session.id,
        persistedTime: session.time,
      })
      expect(created).toMatchObject({
        service: "session",
        time: expect.any(String),
        data: { id: session.id, time: session.time },
      })
      expect(requiredRecord(records, "envelope95-buffered")).toMatchObject({
        service: "envelope95-context",
        logDomain: "session",
        sessionID: session.id,
        data: { sessionID: caller.id, value: 11 },
      })
      expect(requiredRecord(records, "envelope95-caller-only")).toMatchObject({
        service: "envelope95-context",
        logDomain: "non-session",
        data: { sessionID: caller.id, value: 13 },
      })
      expect(requiredRecord(records, "envelope95-reinitialized")).toMatchObject({
        logDomain: "session",
        sessionID: session.id,
        data: { sessionID: caller.id, value: 17 },
      })
    },
  })
})

test("real timers, serializers and support ZIP retain canonical chronology and redacted data", async () => {
  await Log.init({ print: false, dev: true })
  const logger = Log.create({ service: "envelope95-export" })
  const timer = logger.time("envelope95-timer", { operation: "actual-timer" })
  timer.stop()
  logger.error("envelope95-error", {
    error: new Error("Actual serialization error"),
    cause: new APICallError({
      message: "Local fixture response",
      url: "https://example.invalid/fixture",
      requestBodyValues: {},
      statusCode: 429,
      responseHeaders: { "set-cookie": "fixture-secret", "retry-after": "2" },
      responseBody: '{"error":{"message":"Local fixture response"}}',
      isRetryable: false,
    }),
    time: { created: 41, updated: 43 },
  })
  const observed = await capture("timer-export", {
    operation: "actual-timer",
    errorMessage: "Actual serialization error",
    providerDiagnostic: { statusCode: 429, responseHeaders: { "set-cookie": "<redacted>", "retry-after": "2" } },
  })
  const bundle = await buildLogSupportBundle()
  const current = bundle.manifest.files.find((entry) => entry.current)
  if (!current) throw new Error("Actual current log is required in support ZIP")
  const zip = new ZipReader(new Uint8ArrayReader(bundle.bytes))
  let exportedRaw = ""
  let formatted = ""
  try {
    for (const entry of await zip.getEntries()) {
      if (!("getData" in entry) || typeof entry.getData !== "function") continue
      if (entry.filename === current.rawPath) exportedRaw = await entry.getData(new TextWriter())
      if (entry.filename === current.formattedPath) formatted = await entry.getData(new TextWriter())
    }
  } finally {
    await zip.close()
  }
  console.log("LOGGER_ENVELOPE_95_EXPORT", JSON.stringify({ current, exportedRaw, formatted }))
  expect(exportedRaw).toBe(observed.raw)
  expect(observed.records.filter((entry) => entry.message === "envelope95-timer")).toMatchObject([
    { data: { status: "started", operation: "actual-timer" } },
    { data: { status: "completed", operation: "actual-timer", duration: expect.any(Number) } },
  ])
  expect(requiredRecord(observed.records, "envelope95-error")).toMatchObject({
    time: expect.any(String),
    level: "error",
    data: {
      error: { type: "Error", message: "Actual serialization error", stack: expect.any(String) },
      cause: { statusCode: 429, responseHeaders: { "set-cookie": "<redacted>", "retry-after": "2" } },
      time: { created: 41, updated: 43 },
    },
  })
  expect({ firstTimestamp: current.firstTimestamp, lastTimestamp: current.lastTimestamp, formatted }).toMatchObject({
    firstTimestamp: expect.any(String),
    lastTimestamp: expect.any(String),
    formatted: expect.stringContaining('"created": 41'),
  })
})

test("public log ingress retains its real accepted result and canonical subject envelope", async () => {
  await using project = await memoryProject("logger-envelope95-ingress")
  await Log.init({ print: false, dev: true })
  const input = {
    entries: [
      {
        service: "envelope95-ingress",
        level: "warn",
        message: "envelope95-public",
        extra: { time: { created: 47 }, service: "subject-ingress", sessionID: "request-ingress", status: "accepted" },
      },
    ],
  }
  const response = await Server.App().request(`/log?directory=${encodeURIComponent(project.path)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  const body: unknown = await response.json()
  const { records } = await capture("public-ingress", { input, response: { status: response.status, body } })
  expect({ status: response.status, body }).toEqual({ status: 200, body: true })
  expect(requiredRecord(records, "envelope95-public")).toMatchObject({
    time: expect.any(String),
    service: "envelope95-ingress",
    level: "warn",
    logDomain: "non-session",
    data: input.entries[0].extra,
  })
})
