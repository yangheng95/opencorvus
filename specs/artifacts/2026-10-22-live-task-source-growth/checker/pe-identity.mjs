import fs from 'node:fs'
import path from 'node:path'
for(const file of process.argv.slice(2)){
 const data=fs.readFileSync(file),pe=data.readUInt32LE(0x3c),sections=data.readUInt16LE(pe+6),optionalSize=data.readUInt16LE(pe+20),optional=pe+24
 if(data.readUInt16LE(optional)!==0x20b)throw Error('Expected PE32+ binary')
 const debugRVA=data.readUInt32LE(optional+112+6*8),debugSize=data.readUInt32LE(optional+112+6*8+4)
 const map=(rva)=>{for(let i=0;i<sections;i++){const s=optional+optionalSize+i*40,start=data.readUInt32LE(s+12),size=Math.max(data.readUInt32LE(s+8),data.readUInt32LE(s+16));if(rva>=start&&rva<start+size)return data.readUInt32LE(s+20)+rva-start}throw Error('RVA outside binary sections')}
 const entries=[]
 for(let n=0;n<debugSize;n+=28){const p=map(debugRVA)+n;if(data.readUInt32LE(p+12)!==2)continue;const q=data.readUInt32LE(p+24);if(data.subarray(q,q+4).toString()!=='RSDS')continue;entries.push({signature:data.subarray(q+4,q+20).toString('hex'),age:data.readUInt32LE(q+20),pdb:path.basename(data.subarray(q+24,data.indexOf(0,q+24)).toString().replaceAll('\\','/'))})}
 console.log(JSON.stringify({file,bytes:data.length,machine:data.readUInt16LE(pe+4),imageSize:data.readUInt32LE(optional+56),codeView:entries}))
}
