#!/usr/bin/env bun

import { generateOpenApiSpec, serializeOpenApiSpec } from "../src/cli/cmd/generate"

const json = serializeOpenApiSpec(await generateOpenApiSpec())

await new Promise<void>((resolve, reject) => {
  process.stdout.write(json, (error) => {
    if (error) reject(error)
    else resolve()
  })
})
