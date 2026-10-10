import fs from "node:fs/promises"
const base = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/side-reading-return-279"
const phases = [
  { phase: "01", messageID: "msg_g0VXdn2ja00jgo1HwLxM", before: "06-live-before-close-geometry.json", closed: "07-live-dock-closed-time.json", after: "08-live-dock-reopened-geometry.json", foreground: 47530 },
  { phase: "02", messageID: "msg_g0VXdpyUp00M1OJW3Dih", before: "03-live-before-close-geometry.json", closed: "04-live-dock-closed-time.json", after: "05-live-dock-reopened-geometry.json", foreground: 48511 },
]
const read = async (root: string, name: string) => JSON.parse(await fs.readFile(`${root}/${name}`, "utf8"))
for (const phase of phases) {
  const root = `${base}/live-${phase.phase}`
  const audit = await read(root, `side-reading-return-279-live-${phase.phase}-final-provider-audit.json`)
  const canonical = await read(root, "canonical-current-conversations.json")
  const matchingRequests = audit.requests.filter((request: any) => request.response_reader?.requestContext?.activity?.assistantMessageID === phase.messageID && request.response_reader.requestContext.streamRequest.agentID === "chat")
  if (matchingRequests.length !== 1) throw new Error("Exact long-reply Provider identity requires one original request")
  const request = matchingRequests[0]
  const reader = request.response_reader
  const message = canonical.messages.find((message: any) => message.id === phase.messageID)
  const part = canonical.parts.find((part: any) => part.messageID === phase.messageID && part.type === "text")
  if (!message || !part) throw new Error("Actual completed canonical long reply required")
  const before = await read(root, phase.before)
  const closed = await read(root, phase.closed)
  const after = await read(root, phase.after)
  const closure = await read(root, "closure-readback.json")
  const owner = await read(root, `side-reading-return-279-live-${phase.phase}-launch-owner.json`)
  const uiTimes = { before: Date.parse(before.at), closed: Date.parse(closed.at), reopened: Date.parse(after.at) }
  const facts = {
    sessionID: reader.requestContext.sessionID,
    assistantMessageID: phase.messageID,
    textPartID: part.id,
    completedTextChars: part.text.length,
    model: request.model,
    streaming: request.streaming,
    readerFirstAtMs: reader.firstByteReadAt,
    readerEOFAtMs: reader.terminal.at,
    messageCompletedAt: message.time?.completed,
    uiTimes,
    timesInsideActualReader: Object.fromEntries(Object.entries(uiTimes).map(([key, at]) => [key, at >= reader.firstByteReadAt && at < reader.terminal.at])),
    beforeGeometry: before,
    afterGeometry: after,
    sources: canonical.parts.filter((part: any) => part.type === "source-url").map((source: any) => ({ sourceId: source.sourceId, messageID: source.messageID, title: source.title, url: source.url, snippetChars: source.snippet?.length })),
    originalForegroundSession: phase.foreground,
    originalForegroundActualExit: 0,
    native: owner.nativeTarget,
    host: owner.host,
    nativeActualExit: closure.native.terminal.exitCode,
    physicalSettledAt: closure.native.observedAtUtc,
    deadlineAtMs: closure.native.deadlineAt,
    bufferMs: closure.native.deadlineAt - Date.parse(closure.native.observedAtUtc),
    minimumPlannedBufferMs: 240000,
    boundary: "Original live UI time records linked to exactly one actual Provider chat reader and completed canonical message. Geometry is observation only; no DOM/browser/screenshot assertions or automation tests. Root reviews screenshots manually.",
  }
  await fs.writeFile(`${root}/reader-ui-facts.json`, JSON.stringify(facts, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ phase: phase.phase, sessionID: facts.sessionID, messageID: phase.messageID, textChars: facts.completedTextChars, uiTimesInsideReader: facts.timesInsideActualReader, bufferMs: facts.bufferMs }))
}
