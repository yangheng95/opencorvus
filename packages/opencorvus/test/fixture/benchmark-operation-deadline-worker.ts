import { awaitBenchmarkOperationDeadline } from "../../script/benchmark/external-agent/contract"

const withSignal = await awaitBenchmarkOperationDeadline({
  operation: Promise.resolve("bridge-ready"),
  signal: new AbortController().signal,
  timeoutMs: 600_000,
  timeoutMessage: "bridge deadline expired",
})
const cleanup = await awaitBenchmarkOperationDeadline({
  operation: Promise.resolve("cleanup-settled"),
  timeoutMs: 600_000,
  timeoutMessage: "cleanup deadline expired",
})
process.stdout.write(JSON.stringify({ with_signal: withSignal, cleanup }) + "\n")
