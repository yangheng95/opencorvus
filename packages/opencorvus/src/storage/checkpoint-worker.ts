import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads"

export type CheckpointResult = { busy: number; log: number; checkpointed: number; duration: number }
type Completion = {
  released: boolean
  result?: CheckpointResult
  error?: { message: string; code?: string; errno?: number }
}

// Kept inline so the same worker runs from source and the compiled executable.
// It opens only an existing database and releases every SQLite resource before
// acknowledging the file boundary. The parent separately observes thread exit.
const source = `
const { workerData } = require("node:worker_threads");
const control = new Int32Array(workerData.control);
const completion = { released: false };
let sqlite;
function failure(error) {
  return { message: String(error?.message ?? error), code: error?.code, errno: error?.errno };
}
try {
  const { Database } = require("bun:sqlite");
  sqlite = new Database(workerData.filename, { readwrite: true });
  sqlite.run("PRAGMA synchronous = NORMAL");
  const started = performance.now();
  const statement = sqlite.prepare("PRAGMA wal_checkpoint(PASSIVE)");
  try {
    const result = statement.get();
    if (!result) throw new Error("SQLite checkpoint returned no result");
    completion.result = { ...result, duration: performance.now() - started };
  } finally { statement.finalize(); }
} catch (error) { completion.error = failure(error); }
try {
  if (sqlite) sqlite.close(true);
  completion.released = true;
} catch (error) { completion.error = failure(error); }
workerData.port.postMessage(completion);
workerData.port.close();
Atomics.store(control, 0, completion.released ? 1 : 2);
Atomics.notify(control, 0);
`

function completionError(completion: Completion) {
  return Object.assign(new Error(completion.error?.message ?? "SQLite checkpoint connection was not released"), {
    code: completion.error?.code ?? "SQLITE_CHECKPOINT_FAILED",
    errno: completion.error?.errno,
  })
}

export function startCheckpoint(filename: string) {
  const control = new Int32Array(new SharedArrayBuffer(4))
  const { port1, port2 } = new MessageChannel()
  let worker: Worker
  try {
    worker = new Worker(source, {
      eval: true,
      workerData: { filename, control: control.buffer, port: port2 },
      transferList: [port2],
    })
  } catch (error) {
    port1.close()
    port2.close()
    throw error
  }
  let completion: Completion | undefined
  let workerError: Error | undefined
  let terminated = false
  function readCompletion() {
    completion ??= receiveMessageOnPort(port1)?.message as Completion | undefined
    return completion
  }
  // A ref'ed worker owns the operation until its actual exit, including after a
  // synchronous close has already obtained the SQLite resource-release receipt.
  const exited = new Promise<CheckpointResult>((resolve, reject) => {
    worker.on("error", error => { workerError = error })
    worker.once("exit", code => {
      terminated = true
      const value = readCompletion()
      port1.close()
      if (workerError) return reject(workerError)
      if (code !== 0 || !value) return reject(new Error(`SQLite checkpoint worker exited with code ${code} without its completion`))
      if (!value.released || value.error || !value.result) return reject(completionError(value))
      resolve(value.result)
    })
  })
  // Callers may synchronously close before attaching their asynchronous waiter.
  void exited.catch(() => {})
  return {
    exited,
    release() {
      if (Atomics.load(control, 0) === 0 && !terminated) Atomics.wait(control, 0, 0, 60_000)
      const status = Atomics.load(control, 0)
      if (status !== 1) throw Object.assign(new Error("SQLite checkpoint connection release could not be confirmed"), {
        code: status === 0 && !terminated ? "SQLITE_CHECKPOINT_RELEASE_TIMEOUT" : "SQLITE_CHECKPOINT_RELEASE_FAILED",
      })
      const value = readCompletion()
      if (!value?.released) throw new Error("SQLite checkpoint completion receipt is missing")
      return value.error ? completionError(value) : undefined
    },
  }
}
