export function createBenchmarkAdmissionGate(label: string) {
  let signal: "SIGINT" | "SIGTERM" | undefined
  return {
    request(next: "SIGINT" | "SIGTERM") {
      signal ??= next
      return signal
    },
    assertOpen() {
      if (signal) throw new Error(`${label} received ${signal}`)
    },
    isOpen() {
      return signal === undefined
    },
    signal() {
      return signal
    },
  }
}

export async function acquireBenchmarkResourceWithAdmission<T>(input: {
  admission: ReturnType<typeof createBenchmarkAdmissionGate>
  acquire: () => Promise<T>
  isContended: (error: unknown) => boolean
  maxWaitMs: number
  retryMs?: number
  now?: () => number
  delay?: (milliseconds: number) => Promise<void>
}) {
  const now = input.now ?? Date.now
  const delay = input.delay ?? ((milliseconds: number) => Bun.sleep(milliseconds))
  const deadline = now() + input.maxWaitMs
  while (true) {
    input.admission.assertOpen()
    try {
      return await input.acquire()
    } catch (error) {
      if (!input.isContended(error)) throw error
      input.admission.assertOpen()
      if (now() >= deadline) throw new Error("Benchmark resource admission timed out")
      await delay(Math.min(input.retryMs ?? 250, Math.max(0, deadline - now())))
    }
  }
}

export const BENCHMARK_RUNNER_CLEANUP_TIMEOUT_MS = 10_000

/**
 * The runner can spend five bounded cleanup phases at the shared per-phase
 * timeout before database snapshot and isolated-runtime removal. Keep one
 * coordinator grace owner with explicit room for those final durable writes.
 */
export function benchmarkRunnerShutdownGraceMs(): number {
  return BENCHMARK_RUNNER_CLEANUP_TIMEOUT_MS * 5 + 40_000
}

export function createBenchmarkRunnerStopController<T extends object>(input: {
  isAlive: (child: T) => boolean
  signal: (child: T, signal: "SIGTERM" | "SIGKILL") => void
  exited: (child: T) => Promise<unknown>
  graceMs?: number
}) {
  const signalled = new WeakSet<T>()
  const operations = new WeakMap<T, Promise<void>>()
  const graceMs = input.graceMs ?? benchmarkRunnerShutdownGraceMs()
  const stop = (child: T): Promise<void> => {
    const existing = operations.get(child)
    if (existing) return existing
    const operation = (async () => {
      if (!input.isAlive(child)) {
        await input.exited(child).catch(() => undefined)
        return
      }
      if (!signalled.has(child)) {
        signalled.add(child)
        input.signal(child, "SIGTERM")
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      const graceful = await Promise.race([
        input.exited(child).then(() => true).catch(() => true),
        new Promise<false>((resolve) => {
          timer = setTimeout(() => resolve(false), graceMs)
        }),
      ])
      if (timer) clearTimeout(timer)
      if (graceful) return
      input.signal(child, "SIGKILL")
      await input.exited(child).catch(() => undefined)
    })()
    operations.set(child, operation)
    return operation
  }
  return { stop }
}

export function installBenchmarkTerminationHandlers(
  request: (signal: "SIGINT" | "SIGTERM") => void,
) {
  const onSIGINT = () => request("SIGINT")
  const onSIGTERM = () => request("SIGTERM")
  process.on("SIGINT", onSIGINT)
  process.on("SIGTERM", onSIGTERM)
  return () => {
    process.removeListener("SIGINT", onSIGINT)
    process.removeListener("SIGTERM", onSIGTERM)
  }
}
