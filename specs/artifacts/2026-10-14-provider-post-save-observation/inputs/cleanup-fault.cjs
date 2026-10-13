const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('.tmp-codex-provider-post-save-01a133/final');
const ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'));
const file=root+'/runtime/config/opencorvus.jsonc',providerID='owned-configzero',targetName='Owned cleanup write fault',mode=process.argv[2];
const input=root+'/cleanup-readonly-input.json';
if(mode==='restore'){
 const saved=JSON.parse(fs.readFileSync(input,'utf8'));assert.equal(saved.pid,ready.pid);assert.equal(saved.file,file);fs.chmodSync(file,saved.originalMode);console.log('Own config file permissions restored');process.exit(0);
}
assert.equal(mode,'arm');assert.equal(fs.existsSync(input),false,'One fresh owned cleanup occurrence');
const originalMode=fs.statSync(file).mode;
fs.writeFileSync(input,JSON.stringify({pid:ready.pid,file,providerID,targetName,originalMode,boundary:'Only own canonical input watched; actual filesystem permission changes after first production publication, no transport interception'},null,2));
let fired=false;
const watcher=fs.watch(path.dirname(file),()=>{
 if(fired)return;
 try{
  const source=JSON.parse(fs.readFileSync(file,'utf8'));
  if(source.provider?.[providerID]?.name!==targetName)return;
  fs.chmodSync(file,0o444);fired=true;
  fs.writeFileSync(root+'/cleanup-readonly-fired.json',JSON.stringify({pid:ready.pid,file,providerID,targetName,at:Date.now(),sourceOptionsKeyPresent:typeof source.provider[providerID].options?.apiKey==='string'},null,2));
  console.log('Own canonical publication observed; readonly cleanup input applied');watcher.close();clearTimeout(deadline);
 }catch{}
});
const deadline=setTimeout(()=>{watcher.close();console.error('Owned cleanup input was not qualified');process.exitCode=1},300000);
console.log('Owned cleanup watcher ready');
