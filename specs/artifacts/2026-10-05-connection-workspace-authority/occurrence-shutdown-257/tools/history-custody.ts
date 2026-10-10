import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
const base = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/occurrence-shutdown-257-"
const output = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/occurrence-shutdown-257/history-01"
const original = new Database(path.join(base + "live-01", "runtime/data/opencorvus.db"), {readonly:true})
const clone = new Database(path.join(base + "history-01", "runtime/data/opencorvus.db"), {readonly:true})
try {
  original.exec("BEGIN"); clone.exec("BEGIN")
  const tables = ["session","message","part","tool_part_request","tool_part_outcome","provider_activity_request","provider_activity_outcome","memory_file","memory_chunk","session_control_record","session_control_event","permission_execution_result"]
  const comparison = tables.map(table => {
    const left = original.query(`SELECT * FROM "${table}"`).all().map(row=>JSON.stringify(row)).sort()
    const right = clone.query(`SELECT * FROM "${table}"`).all().map(row=>JSON.stringify(row)).sort()
    return {table,sourceRows:left.length,historyRows:right.length,fullRowContent:left.length===right.length&&left.every((row,index)=>row===right[index])?"equal":"different"}
  })
  const lifecycle = original.query("SELECT * FROM protocol_event WHERE type='agent.execution.lifecycle' ORDER BY id").all() as any[]
  const clonedLifecycle = clone.query("SELECT * FROM protocol_event WHERE type='agent.execution.lifecycle' ORDER BY id").all()
  const lifecycleContent = JSON.stringify(lifecycle)===JSON.stringify(clonedLifecycle)?"equal":"different"
  const source = JSON.parse(fs.readFileSync(path.join(output,"../history-readiness/result-startup.json"),"utf8"))
  const changedFiles = source.projects.flatMap((project:any)=>project.inventory).filter((item:any)=>item.type==="file").flatMap((item:any)=>{
    const current=fs.statSync(item.path)
    return current.size===item.bytes&&current.mtimeMs===item.mtimeMs?[]:[{path:item.path,before:item,after:{bytes:current.size,mtimeMs:current.mtimeMs}}]
  })
  const result={observedAtUtc:new Date().toISOString(),access:"Original and physically closed history clone readonly BEGIN/ROLLBACK; actual complete protected history rows and lifecycle values, original source-project file metadata; no hashes",comparison,lifecycleContent,originalLifecycleRows:lifecycle.length,clonedLifecycleRows:clonedLifecycle.length,changedSourceFiles:changedFiles,boundary:"History runtime's new process/Bus/read receipts are runtime-specific; original conversation/tool/provider/memory/permission content remains exact"}
  fs.writeFileSync(path.join(output,"actual-history-custody.json"),JSON.stringify(result,null,2)+"\n",{flag:"wx"})
  console.log(JSON.stringify(result,null,2))
  if(comparison.some(row=>row.fullRowContent!=="equal")||lifecycleContent!=="equal"||changedFiles.length) process.exitCode=1
} finally {original.exec("ROLLBACK");clone.exec("ROLLBACK");original.close();clone.close()}
