const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('.tmp-codex-provider-post-save-01a133/final'),ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
const config=root+'/runtime/config/opencorvus.jsonc',auth=root+'/runtime/data/auth.json',models=root+'/runtime/data/models.json';
const input=root+'/partial-read-input',mode=process.argv[2];
if(mode==='restore'){
 const metadata=JSON.parse(fs.readFileSync(input+'/owner.json','utf8'));assert.equal(metadata.pid,ready.pid);
 fs.copyFileSync(input+'/auth.json',auth);fs.copyFileSync(input+'/models.json',models);console.log('Original own paired credential and catalog input restored');process.exit(0);
}
assert.equal(mode,'arm');assert.equal(fs.existsSync(input),false,'One fresh owned partial-read input');fs.mkdirSync(input);
fs.copyFileSync(auth,input+'/auth.json');fs.copyFileSync(models,input+'/models.json');
fs.writeFileSync(input+'/owner.json',JSON.stringify({pid:ready.pid,occurrenceID:ready.occurrence.occurrenceID,scope:'Original own generated credentials and complete adjacent sample catalog; no real Provider credential'},null,2));
let fired=false;
const watcher=fs.watch(path.dirname(config),()=>{
 if(fired)return;
 try{
  const source=JSON.parse(fs.readFileSync(config,'utf8'));
  if(source.provider?.['owned-global-partial']?.name!=='Owned partial-read publication')return;
  fs.writeFileSync(auth,'{');fired=true;
  fs.writeFileSync(root+'/partial-read-fired.json',JSON.stringify({pid:ready.pid,at:Date.now(),providerID:'owned-global-partial',targetName:'Owned partial-read publication',fault:'Only own credential-free JSON syntax { after canonical config published'},null,2));
  watcher.close();clearTimeout(deadline);console.log('Actual own config published; independent directory reader input applied');
 }catch{}
});
const deadline=setTimeout(()=>{watcher.close();console.error('Owned partial-reader input was not qualified');process.exitCode=1},300000);
console.log('Owned partial-read watcher ready');
