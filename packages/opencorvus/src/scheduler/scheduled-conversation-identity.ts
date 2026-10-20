import type { Database as SQLite } from "bun:sqlite"
import { rightSidebarConversationExperience } from "@/chat/identity"
import { queryAllFinalized } from "@/storage/sqlite-statement"
import { deterministicAutomationID } from "./automation-identity"

type Root = { id: string; project_id: string; metadata: string | null }
type IdentityIssue = { sessionID: string; projectID: string } & (
  | { kind: "missing"; metadata: Record<string, unknown> }
  | { kind: "invalid" }
)

function identityIssue(row: Root): IdentityIssue | undefined {
  let metadata: unknown
  try {
    metadata = row.metadata === null ? {} : JSON.parse(row.metadata)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return { sessionID: row.id, projectID: row.project_id, kind: "invalid" }
  }
  if (metadata === null) metadata = {}
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return { sessionID: row.id, projectID: row.project_id, kind: "invalid" }
  }
  if (rightSidebarConversationExperience({ kind: "assistant", metadata })) return
  const value = metadata as Record<string, unknown>
  return value.conversation === undefined || value.conversation === null
    ? { sessionID: row.id, projectID: row.project_id, kind: "missing", metadata: value }
    : { sessionID: row.id, projectID: row.project_id, kind: "invalid" }
}

/** Exact standalone result ownership. Valid conversations need no historical run scan. */
export function standaloneScheduledConversationIdentityIssues(sqlite: SQLite): IdentityIssue[] {
  const roots = queryAllFinalized<Root>(
    sqlite,
    "SELECT id,project_id,metadata FROM session WHERE kind='assistant' AND parent_id IS NULL",
  ).flatMap((row) => {
    const issue = identityIssue(row)
    return issue ? [issue] : []
  })
  if (roots.length === 0) return []
  const issues = new Map<string, IdentityIssue>()
  const event = sqlite.query<{ id: string }, [string, string]>(`
    SELECT f.created_session_id AS id FROM event_job_fire f
    INNER JOIN event_job j ON j.id=f.event_job_revision_id
    WHERE f.created_session_id=? AND j.project_id=? AND j.session_id IS NULL LIMIT 1
  `)
  try {
    for (const root of roots) if (event.get(root.sessionID, root.projectID)) issues.set(root.sessionID, root)
  } finally {
    event.finalize()
  }
  // The immutable namespace only bounds the lookup. The exact derived run ID
  // and captured Project below, rather than the prefix, establish ownership.
  const automationRoots = new Map(
    roots.filter((row) => /^ses_automation_[0-9a-f]{32}$/.test(row.sessionID)).map((row) => [row.sessionID, row]),
  )
  if (automationRoots.size === 0) return [...issues.values()]
  const runs = sqlite.query<{ id: string; target_project_id: string }, [string]>(`
    SELECT r.id,r.target_project_id FROM automation_run r
    INNER JOIN automation a ON a.id=r.automation_revision_id
    WHERE r.target_project_id=? AND a.scope='project'
  `)
  try {
    for (const projectID of new Set([...automationRoots.values()].map((row) => row.projectID))) {
      for (const run of runs.all(projectID)) {
        const root = automationRoots.get(deterministicAutomationID("ses", run.id))
        if (root && root.projectID === run.target_project_id) issues.set(root.sessionID, root)
      }
    }
  } finally {
    runs.finalize()
  }
  return [...issues.values()]
}
