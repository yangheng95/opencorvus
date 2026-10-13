import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {Database} from 'bun:sqlite';import {readWalIndex} from './wal-index';
const file=path.join(import.meta.dir,'wal-index-probe.db');if(fs.existsSync(file))throw Error('Fresh owned probe path required');const db=new Database(file);
try{db.run('PRAGMA journal_mode=WAL');db.run('PRAGMA synchronous=NORMAL');db.run('CREATE TABLE probe(id INTEGER PRIMARY KEY,body TEXT)');const stmt=db.prepare('INSERT INTO probe VALUES (?,?)');
 const write=db.transaction((start:number,count:number)=>{for(let i=start;i<start+count;i++)stmt.run(i,'a'.repeat(4096))});
 write(1,20);const before=readWalIndex(file);write(21,1200);const after=readWalIndex(file);stmt.finalize();
 assert.equal(before.state,'observed');assert.equal(after.state,'observed');assert.equal(after.headerCopiesAgree,true);assert.ok(after.mxFrame!>=1000);assert.equal(after.nBackfill,after.mxFrame);const q=db.prepare('SELECT COUNT(*) AS rows FROM probe');assert.deepEqual(q.get(),{rows:1220});q.finalize();
 const result={before,after,rows:1220,boundary:'SQLite mechanism probe in a new owned disposable file; default auto-checkpoint, no product database writes.'};fs.writeFileSync(path.join(import.meta.dir,'wal-index-preflight.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}finally{db.close(true)}
