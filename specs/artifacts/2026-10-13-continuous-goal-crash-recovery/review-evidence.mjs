import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

// Independent review of saved real-run evidence; no Provider, process or product mutation.
const directory = path.resolve(process.argv[2])
const read = async (name) => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'))
const [result, before, final, cut, firstAudit, secondAudit, firstStart, secondStart, settlement, transcripts] =
  await Promise.all(['result.json', 'before-facts.json', 'final-facts.json', 'crash-cut.json',
    'before-provider.json', 'after-provider.json', 'before-startup.json', 'after-startup.json',
    'settlement.json', 'transcripts.json'].map(read))
assert.equal(result.status, 'passed')
assert.equal(firstStart.pid, result.crash.pid)
assert.equal(firstAudit.pid, firstStart.pid)
assert.equal(secondAudit.pid, secondStart.pid)
assert(secondStart.pid !== firstStart.pid, 'A distinct physical process performed recovery')
assert.equal(settlement.processes.find(p => p.pid === firstStart.pid).signalCode, 'SIGKILL')
assert(settlement.processes.every(p => p.exited === true))
assert.equal(settlement.credentialPairRemoved, true)
assert.equal(settlement.ports.at(-1).reachable, false)
assert.equal(final.created.id, before.created.id)
assert.equal(result.goal.id, final.created.id)
assert.equal(result.goal.status, 'complete')
assert.equal(result.goal.turnsAccepted, 1)
assert.deepEqual(final.continuations.map(e => e.id), [cut.continuationID])
assert.deepEqual(final.messages.filter(m => m.data.author === 'goal-controller').map(m => m.id), [cut.inputID])
const interrupted = final.messages.find(m => m.id === cut.assistantID)
assert.equal(interrupted.data.error.name, 'ProcessExecutionInterruptedError')
assert(interrupted.data.time.completed > cut.at, 'Production recovery terminalized the interrupted assistant after physical exit')
const firstRecoveryResponse = Math.min(...secondAudit.requests.map(r => r.response_reader.receivedAt))
const priorUsage = new Set(before.usage.map(u => u.id))
const recoveredUsage = final.usage.filter(u => !priorUsage.has(u.id) && u.occurred_at >= firstRecoveryResponse)
assert(recoveredUsage.length > 0, 'New process produced settled usage for the exact goal scope')
for (const usage of recoveredUsage) {
  assert.equal(usage.provider_id, 'openai')
  assert.equal(usage.model_id, 'gpt-6.1-sol')
  assert(final.ids.includes(usage.session_id))
}
assert.equal(new Set(final.usage.map(u => u.id)).size, final.usage.length)
assert.equal(result.goal.tokensUsed, final.usage.reduce((sum,u) => sum + u.total_tokens, 0))
const requests = [...firstAudit.requests, ...secondAudit.requests]
assert.equal(result.totalRequests, requests.length)
assert(requests.length <= result.maxRequests)
for (const request of requests) {
  assert.equal(request.model, 'gpt-6.1-sol')
  assert.equal(request.streaming, true)
  assert.equal(request.status, 200)
}
assert(secondAudit.requests.every(r => r.response_reader.state === 'settled' && r.response_reader.terminal.kind === 'eof'))
const visible = transcripts.flatMap(s => s.messages).flatMap(m => m.info.role === 'assistant'
  ? m.parts.filter(p => p.type === 'text').map(p => ({messageID:m.info.id,text:p.text})) : [])
assert(visible.some(v => v.text.trim().length > 0))
let ownerCompletion
if (result.kind === 'task') {
  const completion = final.events.filter(e => e.type === 'task.completed').at(-1)
  assert.equal(completion.payload.execution_epoch, cut.ingress.execution_epoch)
  assert(completion.emitted_at >= firstRecoveryResponse)
  assert.deepEqual(final.ingresses.find(i => i.id === cut.ingress.id),cut.ingress)
  const inputs = interrupted.data.acceptedInputMessageIDs.map(id => final.messages.find(m => m.id === id))
  assert(inputs.some(m => m?.data.extra?.orchestrator_control_ingress?.ingress_id === cut.ingress.id))
  ownerCompletion = { eventID:completion.id, epoch:completion.payload.execution_epoch }
} else {
  const admission = result.recoveryEvidence
  assert.equal(admission.promptOwner.owner_pid,secondStart.pid)
  assert(admission.promptOwner.generation !== cut.promptOwner.generation)
  assert.equal(admission.interruptedAssistantID,cut.assistantID)
  const acceptedReply=final.messages.find(m=>m.id===admission.assistantID)
  assert(acceptedReply.data.acceptedInputMessageIDs.includes(admission.inputID))
  const recovery = final.messages.find(m => {
    const reason=m.data.extra?.wake_reason
    return reason?.source === 'mission.process_recovery' && reason.openedEventID === cut.opened.id &&
      reason.deadOwnerGeneration === cut.promptOwner.generation && reason.interruptedAssistantMessageIDs.includes(cut.assistantID)
  })
  if (admission.kind === 'mission_process_recovery') {
    assert(recovery, 'Mission recovery message binds the exact dead owner and interrupted frontier')
    assert.equal(admission.inputID,recovery.id)
  } else {
    assert.equal(admission.kind,'accepted_goal_input')
    assert.equal(admission.inputID,cut.inputID)
  }
  assert.equal(final.events.filter(e=>e.type==='mission.execution.opened').at(-1).id,cut.opened.id)
  assert.equal(result.publicOwnerOutcome.kind, 'accepted')
  const receipt=result.completionReceipt
  assert.equal(receipt.kind,'mission_completed')
  assert.equal(receipt.mission_session_id,result.owner.sessionID)
  assert.equal(receipt.assistant_message_id,result.publicOwnerOutcome.messageID)
  assert.equal(receipt.tool_call_id,result.publicOwnerOutcome.toolCallID)
  assert.equal(receipt.tool_part_id,result.publicOwnerOutcome.toolPartID)
  const reply=final.messages.filter(m=>m.session_id===result.owner.sessionID && m.data.role==='assistant').at(-1)
  assert.equal(reply.data.finish,'stop')
  assert(reply.data.time.completed >= receipt.time_recorded)
  ownerCompletion={ recoveryKind:admission.kind,recoveryInputID:admission.inputID, ...result.publicOwnerOutcome }
}
const review={ status:'passed',kind:result.kind,goalID:result.goal.id,continuationID:cut.continuationID,
  originalPID:firstStart.pid,recoveredPID:secondStart.pid,interruptedAssistantID:cut.assistantID,
  ownerCompletion,providerRequests:requests.length,tokensUsed:result.goal.tokensUsed,
  recoveredUsageIDs:recoveredUsage.map(u=>u.id),visibleMessageIDs:[...new Set(visible.map(v=>v.messageID))],
  interruptedUnreportedUsage:'unknown',reviewedAt:new Date().toISOString() }
await fs.writeFile(path.join(directory,'parent-evidence-review.json'),JSON.stringify(review,null,2)+'\n')
console.log(JSON.stringify(review))
