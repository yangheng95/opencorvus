import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {Database as SQLite} from 'bun:sqlite'
const {bootstrapIsolatedTestRuntime}=await import('@opencorvus-ai/util/test-runtime-environment')
const [mode,arg,destination]=process.argv.slice(2)
if(mode!=='child') await bootstrapIsolatedTestRuntime('test')
if(mode==='child') {
  process.env.OPENCORVUS_HOME=arg
  const {Database}=await import('@/storage/db')
  let id:string
  try { id=Database.Identity() } catch(error:any) {
    if(error.code!=='SQLITE_BUSY')throw error
    Database.close()
    console.log(JSON.stringify({contract:'concurrent-upgrade-child',outcome:'busy',code:error.code}))
    process.exit(0)
  }
  const receipts=Database.allFinalized("SELECT outcome FROM bus_publication_delivery_receipt WHERE subscriber_id='engine.interaction.permission-replied' AND outcome='succeeded'")
  const entries=Database.allFinalized("SELECT c.content FROM memory_file f JOIN memory_chunk c ON c.file_id=f.id WHERE f.kind='user_message'")
  assert.equal(receipts.length,1);assert.equal(entries.length,1)
  const entry=JSON.parse((entries[0] as any).content)
  assert.equal(entry.recovery.previousCapture,'unknown')
  Database.close()
  console.log(JSON.stringify({contract:'concurrent-upgrade-child',outcome:'current',id,receipts:receipts.length,pending:entries.length,version:6}))
} else {
  assert(mode==='parent'&&arg&&destination)
  const root=path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!,'shared-runtime'),file=path.join(root,'data','opencorvus.db')
  fs.mkdirSync(path.dirname(file),{recursive:true})
  {using original=new SQLite(path.resolve(arg),{readonly:true,create:false});original.exec('PRAGMA query_only=ON; BEGIN');fs.writeFileSync(file,original.serialize());original.exec('ROLLBACK')}
  const {DATABASE_MIGRATIONS}=await import('@/storage/migrations')
  const {migrateSchema}=await import('@/storage/schema-migration')
  const snapshot=(db:SQLite)=>db.query("SELECT name,wr FROM pragma_table_list WHERE schema='main' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((t:any)=>({name:t.name,rows:db.query(`SELECT ${t.wr?'':'rowid AS __rowid,'}* FROM "${t.name}"`).all()}))
  let original:any
  {
    using owned=new SQLite(file)
    owned.exec('PRAGMA journal_mode=WAL')
    original=snapshot(owned)
    const migrations=DATABASE_MIGRATIONS.map(m=>m.version===6?{...m,migrate:()=>{throw new Error('REAL_GAP_AFTER_PREPARE_FAULT')}}:m)
    assert.throws(()=>migrateSchema({sqlite:owned,databasePath:file,migrations,currentDDL:DATABASE_MIGRATIONS.at(-1)!.ddl,validate:()=>{}}),/REAL_GAP_AFTER_PREPARE_FAULT/)
    assert.deepEqual(owned.query('PRAGMA user_version').get(),{user_version:4})
    assert.deepEqual(snapshot(owned),original)
  }
  async function child() {
    const proc=spawn(process.execPath,[import.meta.path,'child',root],{cwd:process.cwd(),env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']})
    let stdout='',stderr='';proc.stdout.on('data',chunk=>stdout+=chunk);proc.stderr.on('data',chunk=>stderr+=chunk)
    const code=await new Promise<number|null>((resolve,reject)=>{proc.once('exit',resolve);proc.once('error',reject)})
    assert.equal(code,0,stderr.slice(-3000))
    const result=stdout.split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{return null}}).find(row=>row?.contract==='concurrent-upgrade-child')
    assert(result)
    return result
  }
  const initial=await Promise.all([child(),child(),child()])
  const children=[]
  for(const result of initial)children.push(result.outcome==='busy'?await child():result)
  assert(children.every(c=>c.outcome==='current'))
  assert.equal(new Set(children.map(c=>c.id)).size,1)
  using upgraded=new SQLite(file,{readonly:true})
  const after=snapshot(upgraded)
  let retained=0
  for(const table of original) {
    const actual=after.find((t:any)=>t.name===table.name)!
    const keyed=new Map(actual.rows.map((r:any)=>[r.__rowid??r.id??JSON.stringify(r),r]))
    for(const row of table.rows) {assert.deepEqual(keyed.get(row.__rowid??row.id??JSON.stringify(row)),row);retained++}
  }
  const backups=fs.readdirSync(path.join(path.dirname(file),'migration-backups')).filter(f=>f.endsWith('.sqlite'))
  assert.equal(backups.length,2)
  for(const name of backups) {using db=new SQLite(path.join(path.dirname(file),'migration-backups',name),{readonly:true});assert.deepEqual(snapshot(db),original)}
  const result={contract:'real-gap-failure-concurrent-upgrade',faultRollbackVersion:4,faultRowsEqual:true,originalTables:original.length,retainedRows:retained,backupCount:backups.length,allBackupsEqual:true,initial,children,sharedDatabasePath:file}
  const target=path.resolve(destination)
  if(!fs.existsSync(target))fs.mkdirSync(target,{recursive:true})
  fs.writeFileSync(path.join(target,'concurrent-result.json'),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result))
}
