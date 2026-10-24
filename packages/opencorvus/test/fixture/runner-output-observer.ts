const write = process.stdout.write.bind(process.stdout)
process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
  if (Buffer.from(chunk).includes(Buffer.from("RUNNER_EVIDENCE_AFTER_DURABLE_EFFECT")))
    throw new Error("controlled runner stdout observer failure after synthetic durable effect")
  return Reflect.apply(write, process.stdout, [chunk, ...args])
}) as typeof process.stdout.write
