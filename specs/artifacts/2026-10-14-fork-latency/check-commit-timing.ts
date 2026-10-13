import assert from 'node:assert/strict'
import path from 'node:path'
import {Database} from 'bun:sqlite'
import {measureTransactions} from './transaction-commit-timing'
const db=new Database(':memory:')
db.run('CREATE TABLE timing_probe (id INTEGER PRIMARY KEY, value TEXT)')
measureTransactions(db,path.resolve(import.meta.dir,'commit-timing-preflight.json'))
try{
 const write=db.transaction(function(this: {prefix:string}, id:number){db.query('INSERT INTO timing_probe VALUES (?, ?)').run(id,this.prefix+id);return id*2})
 const context={prefix:'owned-'}
 const results=[write.call(context,1),write.immediate.call(context,2),write.deferred.call(context,3),write.exclusive.call(context,4)]
 assert.deepEqual(results,[2,4,6,8])
 const failed=db.transaction(()=>{db.run("INSERT INTO timing_probe VALUES (5,'rolled back')");throw new Error('owned rollback')})
 assert.throws(()=>failed.immediate(),{message:'owned rollback'})
 assert.deepEqual(db.query('SELECT id,value FROM timing_probe ORDER BY id').all(),[1,2,3,4].map(id=>({id,value:'owned-'+id})))
 console.log('Actual driver default/immediate/deferred/exclusive preserve this, arguments, return, committed rows and explicit rollback.')
}finally{db.close(true)}
