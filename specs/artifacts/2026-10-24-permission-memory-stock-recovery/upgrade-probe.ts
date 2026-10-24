import assert from 'node:assert/strict'
import {isDeepStrictEqual} from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import {Database as SQLite} from 'bun:sqlite'
const [sourceInput, destinationInput, mode]=process.argv.slice(2)
assert(sourceInput&&destinationInput&&mode)
const source=path.resolve(sourceInput),destination=path.resolve(destinationInput)
const {bootstrapIsolatedTestRuntime}=await import('@opencorvus-ai/util/test-runtime-environment')
await bootstrapIsolatedTestRuntime('test')
const {Database}=await import('@/storage/db')
const {DATABASE_MIGRATIONS}=await import('@/storage/migrations')
const {ProjectMemory}=await import('@/memory/project-memory')
const {readPermissionRequestFacts}=await import('@/permission/ledger-facts')
const {Instance}=await import('@/project/instance')
const {Bus}=await import('@/bus')
const {PermissionAuthority}=await import('@/permission/authority')
function snapshot(db:SQLite) {
  const tableNames=db.query("SELECT name,wr FROM pragma_table_list WHERE schema='main' AND name NOT LIKE 'sqlite_%' AND type IN ('table','virtual','shadow') ORDER BY name").all() as {name:string,wr:number}[]
  return {version:db.query('PRAGMA user_version').get(),tables:tableNames.map(t=>({name:t.name,rows:db.query(`SELECT ${t.wr?'':'rowid AS __rowid,'}* FROM "${t.name}"`).all()}))}
}
fs.mkdirSync(path.dirname(Database.Path()),{recursive:true})
let before:any
{
  using original=new SQLite(source,{readonly:true,create:false})
  original.exec('PRAGMA query_only=ON; BEGIN')
  before=snapshot(original)
  fs.writeFileSync(Database.Path(),original.serialize())
  original.exec('ROLLBACK')
}
if(mode.startsWith('project-')) {
  const sidecar=path.join(path.dirname(source),'project-deletion-cleanup')
  assert(fs.existsSync(sidecar))
  fs.cpSync(sidecar,path.join(path.dirname(Database.Path()),'maintenance','project-deletion-cleanup'),{recursive:true})
}
if(mode==='project-descendant') {
  const metadata=JSON.parse(fs.readFileSync(path.join(path.dirname(source),'before.json'),'utf8'))
  const publication=before.tables.find((t:any)=>t.name==='bus_publication_outbox').rows.find((r:any)=>r.event_type==='permission.replied')
  assert.equal(publication.project_id,metadata.projectID)
  assert.equal(publication.directory,metadata.directory)
  const root=path.join(path.dirname(source),'project-deletion-cleanup','completed',metadata.authority)
  const names=fs.readdirSync(root).filter(name=>name.endsWith('.json'))
  assert.equal(names.length,1)
  const manifest=JSON.parse(fs.readFileSync(path.join(root,names[0]),'utf8'))
  assert.equal(manifest.projectID,publication.project_id)
  assert.equal(manifest.registeredDirectories.length,1)
  assert.equal(manifest.registeredDirectories[0].path,manifest.directory)
  const relative=path.relative(manifest.directory,publication.directory)
  assert(relative.length>0&&!relative.startsWith('..')&&!path.isAbsolute(relative),'publication is a strict registered-root descendant')
  assert(manifest.registeredDirectories.every((item:any)=>path.resolve(item.path)!==path.resolve(publication.directory)))
}
if(mode==='project-wrong-directory') {
  const root=path.join(path.dirname(Database.Path()),'maintenance','project-deletion-cleanup','completed')
  for(const authority of fs.readdirSync(root))for(const name of fs.readdirSync(path.join(root,authority))) {
    const file=path.join(root,authority,name),manifest=JSON.parse(fs.readFileSync(file,'utf8'))
    manifest.registeredDirectories=manifest.registeredDirectories.map((item:any)=>{
      const misleadingRoot=item.path.slice(0,-1)
      assert(item.path.startsWith(misleadingRoot))
      assert(path.relative(misleadingRoot,item.path).startsWith('..'))
      return {...item,path:misleadingRoot}
    })
    fs.writeFileSync(file,JSON.stringify(manifest))
  }
  let caught:any
  try{Database.Identity()}catch(error){caught=error}
  assert.equal(caught?.data?.code,'SCHEMA_MIGRATION_REQUIRED')
  {using db=new SQLite(Database.Path(),{readonly:true});assert(isDeepStrictEqual(snapshot(db),before),'original rows and schema preserved')}
  const backupRoot=path.join(path.dirname(Database.Path()),'migration-backups')
  const backups=fs.readdirSync(backupRoot).filter(n=>n.endsWith('.sqlite'))
  assert.equal(backups.length,1)
  {using backup=new SQLite(path.join(backupRoot,backups[0]),{readonly:true});assert(isDeepStrictEqual(snapshot(backup),before),'backup rows and schema equal')}
  if(!fs.existsSync(destination))fs.mkdirSync(destination,{recursive:true})
  const result={mode,sourceVersion:before.version,observedCode:caught.data.code,originalRowsPreserved:true,backupRowsEqual:true,adjacentPrefixRejected:true}
  fs.writeFileSync(path.join(destination,'upgrade-result.json'),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result));process.exit(0)
}
const began=Date.now()
const identity=Database.Identity()
assert.equal((Database.allFinalized('PRAGMA user_version')[0] as any).user_version,DATABASE_MIGRATIONS.at(-1)!.version)
let after:any
{using upgraded=new SQLite(Database.Path(),{readonly:true});after=snapshot(upgraded)}
let originalRows=0
for(const table of before.tables) {
  const actual=after.tables.find((t:any)=>t.name===table.name)
  assert(actual)
  const rows=new Map(actual.rows.map((row:any)=>[row.__rowid??row.id??JSON.stringify(row),row]))
  for(const row of table.rows) {
    assert(isDeepStrictEqual(rows.get(row.__rowid??row.id??JSON.stringify(row)),row),`preserve ${table.name} original row`)
    originalRows++
  }
}
const beforeReceipts=before.tables.find((t:any)=>t.name==='bus_publication_delivery_receipt')!.rows
const newReceipts=after.tables.find((t:any)=>t.name==='bus_publication_delivery_receipt')!.rows.filter((r:any)=>!beforeReceipts.some((b:any)=>b.id===r.id))
const pending=Database.allFinalized("SELECT f.id,c.content FROM memory_file f JOIN memory_chunk c ON c.file_id=f.id WHERE f.kind='user_message'") as any[]
const recovered=pending.map(r=>JSON.parse(r.content)).filter(r=>r.recovery)
if(mode==='gap'||mode==='ready'||mode==='pending') {
  assert.equal(newReceipts.length,1)
  assert.equal(recovered.length,mode==='pending'?0:1)
  const entry=mode==='pending'?JSON.parse(pending[0].content):recovered[0]
  if(mode!=='pending') {
    assert.equal(entry.recovery.previousCapture,'unknown')
    assert.equal(entry.recovery.schemaVersion,6)
    assert(entry.recovery.recoveredAt>=began)
    assert.deepEqual(entry.context,[])
  }
  assert.equal(entry.text,'Keep this authentic old input.')
  const publication:any=Database.allFinalized('SELECT * FROM bus_publication_outbox').find((r:any)=>r.event_type==='permission.replied')
  assert(publication)
  assert.equal(JSON.parse(publication.properties).userInput.text,entry.text)
  const project:any=Database.allFinalized('SELECT * FROM project').find((p:any)=>p.id===entry.projectID)
  await Instance.provide({directory:publication.directory,fn:async()=>{
    assert.equal(Instance.project.id,project.id)
    // The original immutable publication is still accepted by the real Bus;
    // its present recovery receipt settles its exact subscriber once.
    const {EngineInteraction}=await import('@/engine/interaction')
    EngineInteraction.subscribe()
    await Bus.publishOwnedExact(PermissionAuthority.Event.Replied,JSON.parse(publication.properties),publication.occurrence_id).retry()
    assert.equal(ProjectMemory.pending(project.id).filter(e=>e.occurrenceID===entry.occurrenceID).length,1)
    Database.immediateTransaction(db=>{
      const current=ProjectMemory.read(project.id),leaseID='real-upgrade-recovery-consumption'
      ProjectMemory.beginOrganizerAttemptInTransaction(db,{projectID:project.id,leaseID,expectedRevision:current.revision,timeUpdated:Date.now()})
      const committed=ProjectMemory.commitOrganizationInTransaction(db,{projectID:project.id,leaseID,baseRevision:current.revision,
        coveredOccurrenceIDs:ProjectMemory.pending(project.id).map(e=>e.occurrenceID),markdown:current.content||'# Preserved recovered input\n',timeUpdated:Date.now()+1})
      assert(committed)
    })
    assert.equal(ProjectMemory.read(project.id).pendingCount,0)
    await Bus.publishOwnedExact(PermissionAuthority.Event.Replied,JSON.parse(publication.properties),publication.occurrence_id).retry()
    assert.equal(ProjectMemory.read(project.id).pendingCount,0)
    const {Session}=await import('@/session')
    const {Identifier}=await import('@/id/id')
    const messageID=Identifier.ascending('message'),text='New human input after preserved history recovery.'
    await Session.persistMessage({info:{id:messageID,sessionID:entry.sessionID,role:'user',author:'user',agent:'work',
      model:{providerID:'test',modelID:'recovery'},time:{created:Date.now()},extra:ProjectMemory.userInputExtra({surface:'test.stock-recovery',literalText:text})},
      parts:[{id:Identifier.ascending('part'),messageID,sessionID:entry.sessionID,type:'text',text,kind:'user_content',source:'user'}]})
    assert.deepEqual(ProjectMemory.pending(project.id).map(e=>({id:e.occurrenceID,text:e.text,recovery:e.recovery??null})),[{id:messageID,text,recovery:null}])
    const facts=Database.use(db=>readPermissionRequestFacts(db,JSON.parse(publication.properties).requestID))!
    assert.equal(facts.decision,'allow_once')
  }})
  await Instance.disposeAll()
}
else assert.equal(newReceipts.length,['known-covered','project-retired','project-recreated','project-descendant'].includes(mode)?1:0)
if(mode==='project-recreated') {
  assert.equal(recovered.length,1)
  const entry=recovered[0]
  assert.equal(entry.recovery.ownerResolution,'unresolved')
  assert.equal(entry.text,'Keep this authentic old input.')
  const publication:any=Database.allFinalized('SELECT * FROM bus_publication_outbox').find((r:any)=>r.occurrence_id===entry.recovery.publicationID)
  assert(publication)
  const requestFacts=Database.use(db=>readPermissionRequestFacts(db,JSON.parse(publication.properties).requestID))!
  const originalInteraction:any=Database.allFinalized('SELECT * FROM engine_interaction_request').find((row:any)=>row.source_kind==='permission_request'&&row.source_id===requestFacts.requested.id)
  assert.equal(entry.occurrenceID,originalInteraction?.id??publication.occurrence_id)
  await Instance.provide({directory:publication.directory,fn:async()=>{
    const active=ProjectMemory.pending(entry.projectID)
    assert.equal(active.length,1)
    assert.equal(active[0].text,'Fresh human input in the recreated Project.')
    const originalMetadata=JSON.parse(fs.readFileSync(path.join(path.dirname(source),'before.json'),'utf8'))
    assert.equal(active[0].sessionID,originalMetadata.newSessionID)
    assert.equal(ProjectMemory.read(entry.projectID).unresolvedCount,1)
    const {MemoryTool}=await import('@/tool/memory')
    const tool=await MemoryTool.init()
    const context={sessionID:active[0].sessionID,messageID:active[0].occurrenceID,callID:'read-original-recovery',agent:'work',abort:AbortSignal.any([]),messages:[],metadata:()=>{},ask:async()=>{}} as never
    let content='',offset=0
    for(;;) {
      const result=await tool.execute({action:'project_read',recoveryOccurrenceID:entry.occurrenceID,offset,limit:80},context)
      const page=JSON.parse(result.output)
      assert.equal(page.status,'available');content+=page.content
      if(page.nextOffset===null)break
      offset=page.nextOffset
    }
    assert.deepEqual(JSON.parse(content),entry)
    const {EngineInteraction}=await import('@/engine/interaction')
    EngineInteraction.subscribe()
    await Bus.publishOwnedExact(PermissionAuthority.Event.Replied,JSON.parse(publication.properties),publication.occurrence_id).retry()
    Database.immediateTransaction(db=>{
      const current=ProjectMemory.read(entry.projectID),leaseID='new-generation-real-consumption'
      ProjectMemory.beginOrganizerAttemptInTransaction(db,{projectID:entry.projectID,leaseID,expectedRevision:current.revision,timeUpdated:Date.now()})
      ProjectMemory.commitOrganizationInTransaction(db,{projectID:entry.projectID,leaseID,baseRevision:current.revision,coveredOccurrenceIDs:active.map(e=>e.occurrenceID),
        markdown:'# New Project context\n\nFresh human input in the recreated Project.\n',timeUpdated:Date.now()+1})
    })
    assert.equal(ProjectMemory.read(entry.projectID).pendingCount,0)
    assert.equal(ProjectMemory.read(entry.projectID).unresolvedCount,1)
    let retained='',next=0
    for(;;) {const page=ProjectMemory.readRecovery(entry.projectID,{occurrenceID:entry.occurrenceID,offset:next,limit:4000});assert.equal(page.status,'available');if(page.status!=='available')throw Error('read evidence');retained+=page.content;if(page.nextOffset===null)break;next=page.nextOffset}
    assert.equal(retained,content)
  }})
  await Instance.disposeAll()
}
await Database.awaitEffectIdle(30_000)
Database.close()
const reopened=Database.Identity()
assert.equal(reopened,identity)
const backups=fs.readdirSync(path.join(path.dirname(Database.Path()),'migration-backups')).filter(n=>n.endsWith('.sqlite'))
assert.equal(backups.length,1)
{using backup=new SQLite(path.join(path.dirname(Database.Path()),'migration-backups',backups[0]),{readonly:true});assert(isDeepStrictEqual(snapshot(backup),before),'backup rows and schema equal')}
const result={mode,sourceVersion:before.version,targetVersion:DATABASE_MIGRATIONS.at(-1)!.version,originalTables:before.tables.length,originalRows,
  originalRowsPreserved:true,backupRowsEqual:true,newRecoveryReceipts:newReceipts.length,recoveredUnknown:recovered.length,
  recoveryTimeCurrent:recovered.every(e=>e.recovery.recoveredAt>=began),restartIdentityPreserved:reopened===identity,
  ...(['gap','ready','pending'].includes(mode)?{realBusRedelivery:true,realOrganizerCommit:true,consumedRedeliveryPending:0,freshHumanPending:1}:{}),databasePath:Database.Path()}
if(mode==='project-recreated')Object.assign(result,{unresolvedOwnerPreserved:true,pagedMemoryToolRead:true,newGenerationConsumed:true,originalInputRetainedAfterCommit:true,realBusRedelivery:true})
if(mode==='project-descendant')Object.assign(result,{strictDescendantPublication:true,registeredDirectoryCount:1,sourceProjectMatchesManifest:true})
Database.close()
if(!fs.existsSync(destination)) fs.mkdirSync(destination,{recursive:true})
fs.writeFileSync(path.join(destination,'upgrade-result.json'),JSON.stringify(result,null,2))
console.log(JSON.stringify(result))
