import { Database } from "bun:sqlite"
for (const name of ["live-sol-edit-03", "live-sol-review-04"]) {
  const filename = `C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-06/${name}/runtime/data/opencorvus.db`
  const db = new Database(filename, { readonly: true })
  try {
    db.exec("BEGIN")
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tool_part_request','tool_part_outcome','part','session','session_prompt_owner','engine_artifact') ORDER BY name").all()
    const sessions = db.query(`SELECT s.id,s.project_id,s.parent_id,s.kind,s.directory,s.title,s.time_archived,json_extract(s.metadata,'$.conversation.experience') experience,json_extract(s.metadata,'$.conversation.surface') surface,(SELECT count(*) FROM message m WHERE m.session_id=s.id) messages FROM session s ORDER BY s.time_created`).all()
    const tools = db.query(`SELECT s.id sessionID,json_extract(p.data,'$.tool') tool,json_extract(o.data,'$.outcome') outcomeType,count(*) count,json_type(o.data,'$.metadata.filediff') filediffType,json_type(o.data,'$.metadata.files') filesType FROM tool_part_request p JOIN message m ON m.id=p.message_id JOIN session s ON s.id=m.session_id LEFT JOIN tool_part_outcome o ON o.request_part_id=p.id GROUP BY s.id,tool,outcomeType,filediffType,filesType`).all()
    const owners = db.query("SELECT session_id FROM session_prompt_owner").all()
    const projects = db.query("SELECT id,worktree FROM project").all()
    console.log(JSON.stringify({ access: "readonly exact closed owned original database; explicit transaction; no body/credential fields",filename,tables,sessions,tools,projects,owners },null,2))
    db.exec("ROLLBACK")
  } finally { db.close() }
}

