import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

const [root, port] = process.argv.slice(2)
const endpoint = "http://127.0.0.1:" + port
const response = await fetch(endpoint + "/global/projects/anonymous", {method:"POST"})
assert.equal(response.status,201)
const data = await response.json()
const owner = await fs.realpath(path.join(root,"profile-after","data","projects"))
const source = await fs.realpath(data.directory)
const relative = path.relative(owner,source)
assert.ok(relative && relative!==".." && !relative.startsWith(".."+path.sep) && !path.isAbsolute(relative))
const content = "Owned anonymous workspace original note 109.\n"
await fs.writeFile(path.join(source,"promotion-note.txt"),content,{flag:"wx"})
const parent=path.join(root,"promotion-parent")
await fs.mkdir(parent)
const sourceRead = await fetch(endpoint + "/file/content?" + new URLSearchParams({directory:source,path:"promotion-note.txt"}))
assert.equal(sourceRead.status,200)
assert.equal((await sourceRead.json()).content,content)
const fact={source,parent,content,response:data,requestID:response.headers.get("x-opencorvus-request-id"),sourceReadID:sourceRead.headers.get("x-opencorvus-request-id")}
await fs.writeFile(path.join(root,"anonymous-seed.json"),JSON.stringify(fact,null,2)+"\n")
console.log(JSON.stringify(fact))
