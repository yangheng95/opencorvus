import fs from 'node:fs'
import { performance } from 'node:perf_hooks'

/** Passive diagnostic for the existing synchronous driver's transaction boundary. */
export function measureTransactions(client: { transaction: (...args: any[]) => any }, output: string) {
  const original = client.transaction
  const samples: any[] = []
  const db = client as any
  const pragma = Object.fromEntries(['journal_mode','synchronous','wal_autocheckpoint','cache_size','auto_vacuum'].map(name => {const stmt=db.prepare('PRAGMA '+name);try{return [name,stmt.get()]}finally{stmt.finalize()}}))
  const wal = () => {try{const stat=fs.statSync(db.filename+'-wal');return {bytes:stat.size,modifiedAt:stat.mtimeMs}}catch{return undefined}}
  client.transaction = function (callback: (...args: any[]) => any, ...options: any[]) {
    const stack = new Error().stack?.split('\n').slice(2, 12).join('\n') ?? ''
    let current: { start: number; bodyStart?: number; bodyEnd?: number; beganAt: number; bodyCPU?: NodeJS.CpuUsage } | undefined
    const transaction = Reflect.apply(original, this, [function(this: unknown, ...args: any[]) {
      const sample = current
      if (sample) sample.bodyStart = performance.now()
      try { return Reflect.apply(callback, this, args) }
      finally { if (sample) { sample.bodyEnd = performance.now(); sample.bodyCPU=process.cpuUsage() } }
    }, ...options])
    const measure = (target: (...args: any[]) => any, receiver: unknown, args: any[]) => {
      const previous = current
      const sample = { start: performance.now(), beganAt: Date.now(), bodyStart: undefined as number | undefined, bodyEnd: undefined as number | undefined, bodyCPU: undefined as NodeJS.CpuUsage | undefined, walBefore:wal() }
      current = sample
      let outcome = 'returned'
      try { return Reflect.apply(target, receiver, args) }
      catch (error) { outcome = 'threw'; throw error }
      finally {
        const end = performance.now(); const cpu = sample.bodyCPU ? process.cpuUsage(sample.bodyCPU) : undefined
        samples.push({ beganAt: sample.beganAt, durationMs: end-sample.start, beginMs: (sample.bodyStart??end)-sample.start,
          bodyMs: sample.bodyStart===undefined?0:(sample.bodyEnd??end)-sample.bodyStart,
          commitMs: sample.bodyEnd===undefined?0:end-sample.bodyEnd, outcome, stack, commitCPU:cpu, walBefore:sample.walBefore, walAfter:wal() })
        current = previous
      }
    }
    // The driver's mode properties are non-configurable/non-writable. Build
    // callable wrappers with the same descriptors instead of a Proxy get trap.
    const functions = new Set([transaction, transaction.immediate, transaction.deferred, transaction.exclusive])
    const wrapped = new Map([...functions].map(fn => [fn, function(this: unknown, ...args: any[]) { return measure(fn, this, args) }]))
    for (const [fn, replacement] of wrapped) {
      const descriptors = Object.getOwnPropertyDescriptors(fn)
      for (const key of Reflect.ownKeys(descriptors)) {
        const descriptor = descriptors[key as string]
        if ('value' in descriptor && wrapped.has(descriptor.value)) descriptor.value = wrapped.get(descriptor.value)
      }
      Object.defineProperties(replacement, descriptors)
    }
    return wrapped.get(transaction)
  }
  process.once('exit', () => fs.writeFileSync(output, JSON.stringify({pragma,samples, boundary:'Actual synchronous transaction timing; no SQL parameters, result values, or business state are captured.'},null,2)+'\n',{flag:'wx'}))
}
