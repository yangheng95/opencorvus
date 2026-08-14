#!/usr/bin/env bun

import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
} from "@opencorvus-ai/util/test-runtime-environment"

const runtime = await bootstrapIsolatedTestRuntime("runner")
try {
  Object.assign(process.env, isolatedTestChildEnvironment(runtime))
  const { generateOpenApiSpec, serializeOpenApiSpec } = await import("../src/cli/cmd/generate")
  const json = serializeOpenApiSpec(await generateOpenApiSpec())

  await new Promise<void>((resolve, reject) => {
    process.stdout.write(json, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
} finally {
  await removeIsolatedTestRuntime(runtime)
}
