import fs from 'node:fs'
const input=JSON.parse(fs.readFileSync('D:/myhexin-local/opencorvus/.tmp-product-iteration/native-query-scope-490/input-private.json','utf8'))
const messages=new Map(input.original.message.map(m=>[m.id,m])),sessions=new Map(input.original.session.map(s=>[s.id,s]))
const rows=[]
for(const part of input.original.part){
 const data=typeof part.data==='string'?JSON.parse(part.data):part.data
 if(data.type!=='text'||typeof data.text!=='string'||data.text.length<5000)continue
 const message=messages.get(part.message_id),session=sessions.get(message?.session_id)
 const info=message&&(typeof message.data==='string'?JSON.parse(message.data):message.data)
 if(info?.role!=='assistant')continue
 rows.push({sessionID:session.id,parentID:session.parent_id,kind:session.kind,messageID:message.id,partID:part.id,length:data.text.length,paragraphs:data.text.split(/\n\s*\n/).length,fences:(data.text.match(/^```/gm)||[]).length,completed:info.time?.completed})
}
rows.sort((a,b)=>b.fences-a.fences||b.length-a.length)
fs.writeFileSync(import.meta.dirname+'/long-history-candidates.json',JSON.stringify(rows,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(rows.slice(0,9),null,2))
