// Read-only real runtime checker. It never launches a service, uses credentials,
// injects messages, changes a Task, or automates the UI.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { latestAuditSnapshotFiles } from '../../../packages/opencorvus/script/audit-snapshot.ts'

const [caseID, runRoot, baseURL, mode = 'observe'] = process.argv.slice(2)
assert(['data-analysis', 'meeting-knowledge', 'review-debug', 'context-audit'].includes(caseID), 'case ID required')
assert(runRoot && baseURL && ['observe', 'watch', 'check'].includes(mode), 'Usage: node check-case.mjs CASE RUN_ROOT LOCAL_URL [observe|watch|check]')
const base = new URL(baseURL)
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Only an isolated localhost runtime is supported')
const directory = path.join(runRoot, 'projects', caseID), evidence = path.join(runRoot, 'evidence')
const creation = JSON.parse(fs.readFileSync(path.join(evidence, caseID + '-task.json'), 'utf8'))
const taskID = creation.result.task_id
const readAudit = async () => {
  const files = await latestAuditSnapshotFiles(evidence, 'provider')
  assert.equal(files.length, 1, 'One actual immutable Provider publisher is required')
  return JSON.parse(fs.readFileSync(files[0], 'utf8'))
}
assert.equal(creation.status, 202)
const request = async route => {
  const url = new URL(route, base); url.searchParams.set('directory', directory)
  const signal = AbortSignal.timeout(180_000)
  try {
    const response = await fetch(url, { signal }); assert.equal(response.status, 200, route)
    return await response.json()
  } catch (error) {
    if (signal.aborted) {
      const audit = await readAudit()
      fs.writeFileSync(path.join(evidence, caseID + '-checker-error.json'), JSON.stringify({
        code: 'CHECKER_HTTP_OBSERVATION_TIMEOUT', route, observedAt: new Date().toISOString(),
        readers: audit.requests.map(request => request.response_reader),
        interpretation: 'HTTP observation failed; this does not establish model inactivity or Task failure',
      }, null, 2))
      throw new Error('CHECKER_HTTP_OBSERVATION_TIMEOUT: ' + route, { cause: error })
    }
    throw error
  }
}
const expectedTypes = {
  'data-analysis': ['analysis-charter', 'data-dossier', 'performance-analysis', 'segment-analysis', 'insight-brief', 'audit', 'report'],
  'meeting-knowledge': ['source-ledger', 'outcome-register', 'edited-minutes'],
  'review-debug': [],
  'context-audit': [],
}
let previous = '', lastActivity = Date.now()
for (;;) {
  const [task, conversation] = await Promise.all([request('/task/' + taskID), request('/task/' + taskID + '/conversation?tail_limit=2000')])
  const audit = await readAudit()
  const tools = conversation.transcript.flatMap(message => message.parts.filter(part => part.type === 'tool')
    .map(part => ({ agent: message.info.agent, id: part.id, tool: part.tool, status: part.state.status, error: part.state.error })))
  const observation = JSON.stringify({ task, conversation, readers: audit.requests.map(request => request.response_reader) })
  if (observation !== previous) { previous = observation; lastActivity = Date.now() }
  const summary = { caseID, taskID, status: task.status, lifecycle: task.executionLifecycle,
    maximumRequests: audit.maxRequests, requests: audit.requests.length, exhausted: audit.exhausted,
    artifactTypes: conversation.board.artifacts.map(item => item.payload?.artifact_type).filter(Boolean), tools: tools.slice(-7),
    observedAt: new Date().toISOString(), silenceMs: Date.now() - lastActivity }
  fs.writeFileSync(path.join(evidence, caseID + '-current.json'), JSON.stringify({ task, conversation }, null, 2))
  fs.writeFileSync(path.join(evidence, caseID + '-check.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary))
  if (mode === 'check') {
    fs.writeFileSync(path.join(evidence, 'provider-audit-current.json'), JSON.stringify(audit, null, 2))
    assert.equal(task.status, 'completed', 'A failed/cancelled/budget-interrupted Task is not accepted')
    for (const type of expectedTypes[caseID]) assert(summary.artifactTypes.includes(caseID + '/' + type), 'Missing actual domain Artifact ' + type)
    if (caseID === 'review-debug') {
      for (const role of ['planner', 'root-cause-investigator', 'repair-implementer', 'code-reviewer']) {
        assert(conversation.board.artifacts.some(item => item.payload?.producer?.agent_id === 'review-debug-' + role),
          'Missing actual domain publication by the declared independent role ' + role)
      }
    }
    assert.equal(audit.exhausted, false)
    assert(audit.requests.every(request => request.model === 'gpt-6.1-sol' && request.streaming === true), 'Every actual request must use the specified streaming model')
    const filename = { 'data-analysis': 'outputs/operating-report.md', 'meeting-knowledge': 'outputs/meeting.md', 'review-debug': 'src/invoice.mjs' }[caseID]
    if (filename) assert(fs.statSync(path.join(directory, filename)).size > 0, 'Actual delivery file required')
    // This proves structural completion only. Domain correctness, full exact
    // read/select chains, final independent review and resource/file identity
    // still require the recorded raw outcomes and independent adjudication.
    console.log(JSON.stringify({ structuralContract: 'passed', independentAdjudication: 'required' }))
    break
  }
  if (mode === 'observe' || ['completed', 'failed', 'cancelled'].includes(task.status)) break
  if (Date.now() - lastActivity > 180_000) throw new Error('REAL_TASK_ACTIVITY_INACTIVITY: no change in actual Task, transcript or original source-reader observations for 180 seconds')
  await new Promise(resolve => setTimeout(resolve, 10_000))
}
