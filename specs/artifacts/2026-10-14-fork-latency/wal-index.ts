import fs from 'node:fs'
import os from 'node:os'
/** Passive header observation only; it never takes locks or changes SQLite state. */
export function readWalIndex(filename:string) {
 const buffer=Buffer.alloc(100);let fd:number|undefined
 try {
  fd=fs.openSync(filename+'-shm','r')
  if(fs.readSync(fd,buffer,0,buffer.length,0)!==buffer.length)return {state:'short-header'}
  const uint=(offset:number)=>os.endianness()==='LE'?buffer.readUInt32LE(offset):buffer.readUInt32BE(offset)
  return {state:'observed',mxFrame:uint(16),nPage:uint(20),nBackfill:uint(96),headerCopiesAgree:buffer.subarray(0,48).equals(buffer.subarray(48,96)),salt:buffer.subarray(32,40).toString('hex')}
 }catch(error:any){if(error.code==='ENOENT')return {state:'file-retired'};throw error}
 finally{if(fd!==undefined)fs.closeSync(fd)}
}
