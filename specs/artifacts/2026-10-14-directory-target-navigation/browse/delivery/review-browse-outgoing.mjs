import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {gunzipSync} from 'node:zlib'
const scratch=path.resolve('.tmp-codex-directory-target-01a133')
function git(args){const r=spawnSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:128*1024*1024});if(r.status!==0)throw Error(r.stderr);return r.stdout}
const json=file=>JSON.parse(fs.readFileSync(file,'utf8')),raw=file=>gunzipSync(fs.readFileSync(file)).toString()
const owned=json(path.join(scratch,'browse-commit.json')),prepared=json(path.join(scratch,'browse-prepared-index.json')),head=git(['rev-parse','HEAD']).trim(),upstream=git(['rev-parse','@{upstream}']).trim(),pending=git(['rev-list','--reverse',upstream+'..'+head]).trim().split('\n').filter(Boolean)
const known=[owned.commit,'e3c3d1aa73bfc2b071180d85a21773bdcc4b79b7','79ee5303953bdb14bd71683d96796535a3f00c12','0fe812062088fc2aa6bc5f388d6e03b6ac078ae6']
if(pending.some(id=>!known.includes(id)))throw Error('New outgoing commit requires independent review')
git(['diff','--check',upstream,head])
const ownProducts=owned.files.filter(file=>file.startsWith('packages/'))
if(git(['diff',owned.commit,head,'--',...ownProducts]).trim())throw Error('Accepted own source changed since commit')
const scopeStatus=git(['status','--short','--',...ownProducts,'specs/records/2026-10/2026-10-14-directory-target-navigation.md','specs/artifacts/2026-10-14-directory-target-navigation'])
if(scopeStatus.trim())throw Error('Own delivery scope retains changes')
const originalRecords=[]
for(const item of json('specs/artifacts/2026-10-14-directory-target-navigation/browse/archive-manifest.json').files){
 const file='specs/artifacts/2026-10-14-directory-target-navigation/browse/'+item.target,stored=fs.readFileSync(file),source=fs.readFileSync(item.source),decoded=item.gzip?gunzipSync(stored):stored,r=spawnSync('git',['show',owned.commit+':'+file],{windowsHide:true,maxBuffer:32*1024*1024})
 if(r.status!==0||!r.stdout.equals(stored)||!decoded.equals(source))throw Error('Fixed original evidence identity differs: '+file)
 originalRecords.push({file,originalBytes:decoded.length,committedEqualsArchive:true,decodedEqualsOriginalCapture:true})
}
const ownReview=json(path.join(scratch,'browse-delivery-root-review-final.json'))
if(json(path.join(scratch,'browse-delivery-root-review-final.exit.json')).exitCode!==0||ownReview.runtime.native.terminal.exitCode!==0)throw Error('Actual original qualification incomplete')
const provider='specs/artifacts/2026-10-14-provider-local-identity/',providerChecks=Object.fromEntries(['business-after','overlay-typecheck','ui-build','config-after','privacy-before','privacy-after','docs-check','architecture-index'].map(name=>[name,Number(raw(provider+'checks/'+name+'.exit.gz').trim())]))
if(Object.values(providerChecks).some(code=>code!==0))throw Error('Provider original qualification failed')
const providerCleanup=['before','after'].map(phase=>({phase,...json(provider+'runs/'+phase+'/physical-pair-cleanup.json')}))
if(providerCleanup.some(row=>row.actualExit!==0||row.listeners!==0||row.pair.some(file=>!file.removed)))throw Error('Provider original process/pair cleanup incomplete')
const ipv6='specs/artifacts/2026-10-14-provider-ipv6-segments/',ipv6Checks=Object.fromEntries(['business-red','business-after','overlay-typecheck','ui-build','config-after','privacy-before','privacy-after','docs-check','architecture-index'].map(name=>[name,Number(raw(ipv6+'checks/'+name+'.exit.gz').trim())]))
if(ipv6Checks['business-red']!==1||Object.entries(ipv6Checks).some(([name,code])=>name!=='business-red'&&code!==0))throw Error('IPv6 red/final qualification must stay original')
const ipv6Cleanup=['before','after'].map(phase=>({phase,...json(ipv6+'runs/'+phase+'/physical-pair-cleanup.json')}))
if(ipv6Cleanup.some(row=>row.actualExit!==0||row.listeners!==0||row.pair.some(file=>!file.removed)))throw Error('IPv6 original process/pair cleanup incomplete')
const plan='specs/artifacts/2026-10-14-execution-owner-recovery-406/plan-checks/',planChecks=Object.fromEntries(['api-doc-sync','plan-docs','plan-docs02'].map(name=>[name,Number(raw(plan+name+'.exit.gz').trim())]))
if(planChecks['api-doc-sync']!==0||planChecks['plan-docs02']!==0||planChecks['plan-docs']!==1)throw Error('Documentation failure/corrected qualification must stay original')
const commits=pending.map(id=>({id,subject:git(['show','-s','--format=%s',id]).trim(),files:git(['diff-tree','--no-commit-id','--name-only','-r',id]).trim().split('\n').filter(Boolean),completeProductionAndPublicDiff:git(['show','--format=fuller',id,'--','packages','CHANGELOG.md','specs/current/architecture']),completeRecordDiff:git(['show','--format=',id,'--','specs/records'])}))
const report={reviewer:'Root only; no delegated acceptance or new credential/model use',atUtc:new Date().toISOString(),head,upstream,pending,commits,own:{commit:owned.commit,preparedFiles:prepared.files,originalRecords,fullOriginalReview:ownReview,qualification:'87 positive contracts/896 assertions/310 actual functional HTTP, 21 UI-script HTTP plus eight manual UI mutations; nine original JPEGs viewed by Root; source and Native owners qualified'},otherAuthorizedDeliveries:{provider:{originalChecks:providerChecks,originalBusinessLog:raw(provider+'checks/business-after.log.gz'),config:json(provider+'runs/after/config-qualified.json'),cleanup:providerCleanup,visualReview:'Root personally viewed original screenshot 11-after-two-local-providers-zh.png and reviewed full three-source implementation/test diff. Original owner qualifies its actual before/after UI; this review does not claim a new rerun.',limits:'localhost/IPv6 previews only, no network/model connectivity qualification; normalization collisions outside the local address/port scope remain covered by explicit conflict contract'},documentation:{checks:planChecks,scope:'35 documentation/index/original evidence files only; no product source changes. Original failed docs check1 and corrected0 retained. Permission owner recovery is an implementation plan, not an achieved fix.',previous405PushExit:Number(raw('specs/artifacts/2026-10-14-task-question-recovery-405/delivery/delivery-push01.exit.gz').trim())}},boundaries:['No new UI automated tests, model requests or user-process operations','Non-Windows, unknown target IO, full race matrix and external drop remain unqualified','Actual first failed functional/type/parser/tool records retained','Continuous iteration remains active; no release/tag/PR authority inferred']}
report.otherAuthorizedDeliveries.ipv6={checks:ipv6Checks,originalBusinessLog:raw(ipv6+'checks/business-after.log.gz'),config:json(ipv6+'runs/after/config-qualified.json'),cleanup:ipv6Cleanup,review:'Root reviewed complete production/test diff and personally viewed original screenshot09. Canonical IPv6 colon positions are encoded as allowed underscores in the one existing identity function; original38/13 red and final51/91 are separate. Real UI/config identity is qualified, network/inference is not. Prior normal push failures remain original failures.'}
const filename=path.join(scratch,'browse-outgoing-review-'+Date.now()+'.json');fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(scratch,'browse-outgoing-latest.json'),JSON.stringify({filename,head,upstream,pending,atUtc:report.atUtc},null,2)+'\n')
console.log(JSON.stringify({head,upstream,pending,originals:originalRecords.length,reviewComplete:true,filename}))
