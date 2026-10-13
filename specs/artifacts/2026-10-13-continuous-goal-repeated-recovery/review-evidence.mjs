import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// Read-only independent review of persisted physical and product facts.
const root = path.resolve(process.argv[2])
const read = async name => JSON.parse(await fs.readFile(path.join(root, name), 'utf8'))
const [result, final, settlement, transcripts] = await Promise.all(
  ['result.json', 'final-facts.json', 'settlement.json', 'transcripts.json'].map(read),
)
assert.equal(result.status, 'passed')
const count = result.crashCount
const childScenario = result.scenario === 'mission_child'
assert([1, 2].includes(count))
assert.equal(result.crashes.length, count)
assert.equal(result.recoveries.length, count)
assert.equal(result.goal.status, 'complete')
assert.equal(result.goal.id, final.created.id)
assert.equal(result.goal.turnsAccepted, childScenario ? final.continuations.length : 1)
assert(result.goal.turnsAccepted <= result.turnBudget)
assert.equal(settlement.processes.length, count + 1)
assert.equal(settlement.credentialPairRemoved, true)
for (const process of settlement.processes) assert.equal(process.exited, true)
for (const port of settlement.ports) assert.equal(port.reachable, false)
const audits = []
const generations = []
for (let generation = 1; generation <= count + 1; generation++) {
  const startup = await read(generation === 1 ? 'before-startup.json' : `generation-${generation}-startup.json`)
  const audit = await read(generation === count + 1 ? 'after-provider.json' : `generation-${generation}-provider.json`)
  assert.equal(startup.outcome, 'listening')
  assert.equal(startup.pid, audit.pid)
  audits.push(audit)
  generations.push({ generation, pid: startup.pid, requests: audit.requests.length })
}
assert.equal(new Set(generations.map(row => row.pid)).size, count + 1)
let originalInput
let originalContinuation
let originalOpened
let lastCrashed
for (let generation = 1; generation <= count; generation++) {
  const prefix = `generation-${generation}`
  const [cut, before, crashed, admission] = await Promise.all([
    `${prefix}-crash-cut.json`, `${prefix}-before-facts.json`, `${prefix}-crashed-facts.json`,
    `generation-${generation + 1}-recovery-admission.json`,
  ].map(read))
  const physical = result.crashes[generation - 1]
  const audit = audits[generation - 1]
  const request = audit.requests[cut.requestIndex]
  const dead = crashed.messages.find(row => row.id === cut.assistantID)
  assert.equal(cut.pid, generations[generation - 1].pid)
  assert.equal(physical.pid, cut.pid)
  assert.equal(physical.signalCode, 'SIGKILL')
  assert(physical.exitedAt >= physical.killAt)
  assert.equal(settlement.processes.find(row => row.pid === cut.pid).signalCode, 'SIGKILL')
  assert.equal(dead.data.role, 'assistant')
  assert.equal(dead.data.time.completed, undefined)
  assert.equal(crashed.created.id, final.created.id)
  assert.equal(crashed.promptOwners.find(row => row.session_id === cut.promptOwner.session_id).generation,
    cut.promptOwner.generation)
  assert.equal(cut.promptOwner.owner_pid, cut.pid)
  assert.equal(request.model, 'gpt-6.1-sol')
  assert.equal(request.streaming, true)
  assert.equal(request.status, 200)
  assert.equal(cut.reader.state, 'reading')
  assert(cut.reader.byteCount > 0)
  assert.equal(cut.reader.requestContext.activity.assistantMessageID, dead.id)
  assert.equal(cut.reader.requestContext.sessionID, dead.session_id)
  assert(cut.progress.some(part => part.characters > 0) || cut.toolIDs.length > 0)
  assert(before.messages.some(row => row.id === dead.id))
  const physicalInput = crashed.messages.find(row => row.id === cut.physicalInput.id)
  assert.deepEqual(physicalInput, cut.physicalInput)
  assert((dead.data.acceptedInputMessageIDs ?? [dead.data.parentID]).includes(physicalInput.id))
  originalInput ??= cut.inputID
  originalContinuation ??= cut.continuationID
  originalOpened ??= cut.opened.id
  assert.equal(cut.inputID, originalInput)
  assert.equal(cut.continuationID, originalContinuation)
  assert.equal(cut.opened.id, originalOpened)
  const terminalized = final.messages.find(row => row.id === dead.id)
  assert.equal(terminalized.data.error.name, 'ProcessExecutionInterruptedError')
  assert(terminalized.data.time.completed >= physical.exitedAt)
  assert.equal(admission.interruptedAssistantID, dead.id)
  assert.equal(admission.promptOwner.owner_pid, generations[generation].pid)
  assert(admission.promptOwner.generation !== cut.promptOwner.generation)
  assert.equal(admission.requestContext.activity.assistantMessageID, admission.assistantID)
  const recovered = final.messages.find(row => row.id === admission.assistantID)
  assert((recovered.data.acceptedInputMessageIDs ?? [recovered.data.parentID]).includes(admission.inputID))
  const recoveredInput = final.messages.find(row => row.id === admission.inputID)
  if (admission.kind === 'task_ingress') {
    assert.equal(physicalInput.data.extra.orchestrator_control_ingress.ingress_id, cut.ingress.id)
    assert.equal(recoveredInput.data.extra.orchestrator_control_ingress.ingress_id, cut.ingress.id)
    assert.deepEqual(final.ingresses.find(row => row.id === cut.ingress.id), cut.ingress)
  } else if (admission.kind === 'accepted_goal_input') {
    assert.equal(recoveredInput.id, originalInput)
  } else {
    const reason = recoveredInput.data.extra.wake_reason
    assert.equal(reason.source, 'mission.process_recovery')
    assert.equal(reason.openedEventID, originalOpened)
    if (admission.kind === 'mission_process_recovery_replay') {
      assert.equal(recoveredInput.id, physicalInput.id)
      assert.deepEqual(reason, physicalInput.data.extra.wake_reason)
      assert(generation > 1)
      const priorAdmission = await read(`generation-${generation}-recovery-admission.json`)
      assert.equal(priorAdmission.inputID, recoveredInput.id)
      assert.deepEqual(priorAdmission.reason, reason)
    } else {
      assert.equal(admission.kind, 'mission_process_recovery')
      assert.equal(reason.deadOwnerGeneration, cut.promptOwner.generation)
      assert(reason.interruptedAssistantMessageIDs.includes(dead.id))
    }
  }
  generations[generation - 1].interruptedAssistantID = dead.id
  generations[generation].recoveryKind = admission.kind
  generations[generation].recoveryInputID = admission.inputID
  lastCrashed = crashed
}
const controllers = final.messages.filter(row => row.data.author === 'goal-controller')
if (childScenario) {
  assert(final.continuations.some(row => row.id === originalContinuation))
  assert.equal(new Set(final.continuations.map(row => row.id)).size, final.continuations.length)
  assert.deepEqual(controllers.map(row => row.data.extra.wake_reason.requestID).sort(), final.continuations.map(row => row.id).sort())
  assert(controllers.some(row => row.id === originalInput))
  for (const controller of controllers) assert.equal(controller.data.extra.wake_reason.goalID, result.goal.id)
} else {
  assert.deepEqual(final.continuations.map(row => row.id), [originalContinuation])
  assert.deepEqual(controllers.map(row => row.id), [originalInput])
}
assert.equal(new Set(final.usage.map(row => row.id)).size, final.usage.length)
assert.equal(result.goal.tokensUsed, final.usage.reduce((sum, row) => sum + row.total_tokens, 0))
const priorUsage = new Set(lastCrashed.usage.map(row => row.id))
const lastAdmission = await read(`generation-${count + 1}-recovery-admission.json`)
const recoveredUsage = final.usage.filter(row => !priorUsage.has(row.id) && row.occurred_at >= lastAdmission.startedAt)
assert(recoveredUsage.length > 0)
for (const usage of recoveredUsage) {
  assert.equal(usage.provider_id, 'openai')
  assert.equal(usage.model_id, 'gpt-6.1-sol')
  assert(final.ids.includes(usage.session_id))
}
const requests = audits.flatMap(audit => audit.requests)
assert.equal(requests.length, result.totalRequests)
assert(requests.length <= result.maxRequests)
for (const request of requests) {
  assert.equal(request.model, 'gpt-6.1-sol')
  assert.equal(request.streaming, true)
}
if (result.kind === 'task') {
  const cut = result.crashes[0].cut
  const complete = final.events.filter(row => row.type === 'task.completed').at(-1)
  assert.equal(complete.payload.execution_epoch, cut.ingress.execution_epoch)
  assert.equal(result.publicOwnerOutcome.status, 'completed')
  assert.equal(result.publicOwnerOutcome.executionLifecycle.epoch, cut.ingress.execution_epoch)
} else {
  const cut = result.crashes[0].cut
  assert.equal(final.events.filter(row => row.type === 'mission.execution.opened').at(-1).id,
    childScenario ? cut.ownerOpened.id : originalOpened)
  const outcome = result.publicOwnerOutcome
  const receipt = result.completionReceipt
  assert.equal(outcome.kind, 'accepted')
  assert.equal(receipt.kind, 'mission_completed')
  assert.equal(receipt.mission_session_id, result.owner.sessionID)
  assert.equal(receipt.assistant_message_id, outcome.messageID)
  assert.equal(receipt.tool_part_id, outcome.toolPartID)
  assert.equal(receipt.tool_call_id, outcome.toolCallID)
  if (childScenario) {
    const task = final.tasks.find(row => row.id === cut.childTask.id)
    assert.deepEqual(final.tasks.map(row => row.id), [task.id])
    const metadata = JSON.parse(task.metadata)
    assert.equal(task.source, 'mission')
    assert.equal(task.project_id, final.session.project_id)
    assert.equal(metadata.actor, 'mission')
    assert.equal(metadata.mission.id, JSON.parse(final.session.metadata).mission.id)
    assert.equal(metadata.mission.session_id, result.owner.sessionID)
    assert.equal(task.creator_tool_part_id, cut.creationTool.id)
    const creator = final.messages.find(row => row.id === cut.creatorAssistantID)
    assert.equal(creator.session_id, result.owner.sessionID)
    assert((creator.data.acceptedInputMessageIDs ?? [creator.data.parentID]).includes(originalInput))
    assert.equal(cut.creationTool.message_id, creator.id)
    assert.equal(cut.creationTool.data.tool, 'panel_create_task')
    assert.equal(receipt.task_acceptances.length, 1)
    const acceptance = receipt.task_acceptances[0]
    assert.equal(acceptance.task_id, task.id)
    const terminal = final.taskEvents.find(row => row.id === acceptance.terminal_lifecycle_reference.terminalEventID)
    assert.equal(terminal.type, 'task.completed')
    assert.equal(terminal.aggregate_id, task.id)
    assert.equal(terminal.payload.execution_epoch, cut.ingress.execution_epoch)
    assert.equal(result.child.task.status, 'completed')
    assert.equal(result.child.task.executionLifecycle.epoch, cut.ingress.execution_epoch)
    const ownerTranscript = transcripts.find(row => row.sessionID === result.owner.sessionID)
    const completionPart = ownerTranscript.messages.flatMap(row => row.parts).find(row => row.id === outcome.toolPartID)
    assert.equal(completionPart.state.status, 'completed')
    assert.deepEqual(JSON.parse(completionPart.state.output), receipt)
    const references = completionPart.state.input.task_acceptances[0].evidence_read_refs
    assert(references.length > 0)
    const reads = ownerTranscript.messages.flatMap(row => row.parts)
      .filter(row => row.type === 'tool' && row.tool === 'panel_read_task_artifact' && row.state.status === 'completed')
      .flatMap(row => JSON.parse(row.state.output).results.map(entry => entry.value))
    assert(references.every(reference => reads.some(row => row.artifact_read_ref === reference)))
    assert(acceptance.evidence_locators.length > 0)
    const lineage = await read('parent-session-lineage.json')
    const scope = new Set([task.session_id])
    for (;;) {
      const before = scope.size
      for (const row of lineage) if (row.project_id === task.project_id && scope.has(row.parent_id)) scope.add(row.id)
      if (scope.size === before) break
    }
    const ledger = final.providerUsage.filter(row => scope.has(row.session_id))
    const associated = final.usage.filter(row => scope.has(row.session_id))
    assert(ledger.length > 0)
    assert.deepEqual(associated.map(row => row.id).sort(), ledger.map(row => row.id).sort())
    assert(associated.some(row => recoveredUsage.some(usage => usage.id === row.id)))
    assert.equal(result.child.tokens, associated.reduce((sum, row) => sum + row.total_tokens, 0))
  } else assert.deepEqual(receipt.task_acceptances, [])
  const latest = final.messages.filter(row => row.session_id === result.owner.sessionID && row.data.role === 'assistant').at(-1)
  assert.equal(latest.data.finish, 'stop')
  assert(latest.data.time.completed >= receipt.time_recorded)
}
const visible = transcripts.flatMap(session => session.messages.filter(message => message.info.role === 'assistant')
  .flatMap(message => message.parts.filter(part => part.type === 'text' && part.text.trim())
    .map(part => ({ sessionID: session.sessionID, messageID: message.info.id, text: part.text }))))
assert(visible.length > 0)
const review = { status: 'passed', kind: result.kind, goalID: result.goal.id, continuationID: originalContinuation,
  ...(childScenario ? { childTaskID: result.child.task.id ?? result.crashes[0].cut.childTask.id,
    childTokens: result.child.tokens, acceptedChildTerminal: result.child.acceptance.terminal_lifecycle_reference } : {}),
  generations, totalRequests: requests.length, tokensUsed: result.goal.tokensUsed,
  recoveredUsageIDs: recoveredUsage.map(row => row.id), visibleMessageIDs: [...new Set(visible.map(row => row.messageID))],
  interruptedUnreportedUsage: 'unknown', reviewedAt: new Date().toISOString() }
await fs.writeFile(path.join(root, 'parent-evidence-review.json'), JSON.stringify(review, null, 2) + '\n')
console.log(JSON.stringify(review))
