import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const evidence=path.resolve('specs/artifacts/2026-10-05-connection-workspace-authority/source-search-result-checker-173')
const isolated=path.resolve('.tmp-product-iteration/search-sources-173-isolated')
fs.mkdirSync(isolated,{recursive:true})
for(const key of ['HOME','USERPROFILE','OPENCORVUS_HOME','OPENCORVUS_TEST_HOME','OPENCORVUS_TEST_PROCESS_ROOT','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_CACHE_HOME'])process.env[key]=path.join(isolated,key.toLowerCase())
const save=(name:string,v:unknown)=>fs.writeFileSync(path.join(evidence,name),JSON.stringify(v,null,2),{flag:'wx'})
try{
 const {qualifyBatch,SearchSourceQualificationError}=await import('./verify-current-search-sources-173')
 save('import-probe.json',{state:'initialized',execPath:process.execPath,boundary:'Installed Bun source-resolved Sharp and Message BusEvent registration; explicitly not pure import',isolatedRoot:isolated,applicationBootstrap:'none',databaseAccess:'none',network:'none'})
 const a={type:'source-url',sourceId:'actual-data-a',url:'https://example.test/a',title:'Data A',snippet:'Actual fixture snippet',author:'Fixture author',publishedAt:'2026-10-08',provider:'exa',providerMetadata:{fixture:true}}
 const b={type:'source-url',sourceId:'actual-data-b',url:'https://example.test/b',title:'Data B',provider:'exa'}
 const batch={partID:'prt_fixture_search',messageID:'msg_fixture',sessionID:'ses_fixture',outcome:'completed',sources:[a,b]}
 const rowA={partID:'prt_fixture_a',messageID:'msg_fixture',sessionID:'ses_fixture',orderKey:'v1:0000000000000001:0000000000000031:0000000000000000:part:prt_fixture_a',payload:a}
 const rowB={partID:'prt_fixture_b',messageID:'msg_fixture',sessionID:'ses_fixture',orderKey:'v1:0000000000000002:0000000000000031:0000000000000000:part:prt_fixture_b',payload:b}
 const result=qualifyBatch(batch,[rowA,rowB],[batch]);save('membership-fullmetadata-order.json',result)
 assert.equal(result.state,'valid_batch_durable_projection');assert.ok('memberships' in result);assert.equal(result.distinctCount,2);assert.deepEqual(result.memberships.map(m=>m.partID),['prt_fixture_a','prt_fixture_b']);assert.deepEqual(result.memberships[0]!.persisted,a)
 const repeat={...batch,sources:[a,a,b]};const repeated=qualifyBatch(repeat,[rowA,rowB],[repeat]);save('first-wins.json',repeated);assert.equal(repeated.state,'repeated_identity_first_winner');assert.ok('returnedCount' in repeated);assert.equal(repeated.returnedCount,3);assert.equal(repeated.distinctCount,2)
 const previous={...batch,partID:'prt_prior_tool',sources:[a]};const changed={...batch,sources:[{...a,title:'Later candidate'},b]};const ambiguous=qualifyBatch(changed,[rowA,rowB],[previous,changed]);save('ambiguous-producer.json',ambiguous);assert.equal(ambiguous.state,'ambiguous_multi_producer_batch');assert.ok('memberships' in ambiguous);assert.deepEqual(ambiguous.memberships[0]!.persisted,a);assert.deepEqual(ambiguous.memberships[0]!.otherProducers,['prt_prior_tool'])
 const failure={name:'FixtureNetworkFailure',code:'NETWORK_READ_FAILED'};const failed=qualifyBatch({...batch,outcome:'failed',sources:undefined,failure},[rowA,rowB],[batch]);save('actual-error-contract.json',failed);assert.deepEqual(failed,{state:'actual_tool_error',partID:'prt_fixture_search',failure})
 const errors=[]
 for(const [name,input,rows,code] of [
  ['schema',{...batch,sources:[{...a,url:'not-http-url'}]},[rowA,rowB],'SEARCH_SOURCE_PAYLOAD_INVALID'],
  ['order',batch,[{...rowA,orderKey:rowB.orderKey},{...rowB,orderKey:rowA.orderKey}],'SEARCH_DURABLE_SOURCE_ORDER_MISMATCH'],
  ['metadata',batch,[{...rowA,payload:{...a,title:'Different persisted title'}},rowB],'SEARCH_DURABLE_SOURCE_PAYLOAD_MISMATCH'],
 ] as const){let caught:unknown;try{qualifyBatch(input,rows,[input])}catch(error){caught=error};assert.ok(caught instanceof SearchSourceQualificationError);assert.equal(caught.code,code);errors.push({name,errorType:caught.name,code:caught.code})}
 save('typed-errors.json',errors)
 save('data-contract-result.json',{status:'qualified',cases:7,scope:'Local DATA contracts and import viability only; not Provider, UI, network, DB or genuine171 E2E'})
 console.log('173: 7 positive DATA contracts qualified; installed Bun/Sharp/BusEvent import initialized; no DB/network/Provider/UI')
}catch(error){save('data-contract-error.json',{errorType:error instanceof Error?error.name:'UnknownError',message:error instanceof Error?error.message:'unknown'});throw error}
