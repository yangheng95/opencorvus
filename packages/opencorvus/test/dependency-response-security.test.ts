import { expect, test } from "bun:test"
import { execFile } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

test("an excessive encoding response returns its rejection and the same proxy owner delivers the next stream", async () => {
  const result = await new Promise<string>((resolve, reject) => {
    let inactivity: ReturnType<typeof setTimeout>
    let inactivityError: Error | undefined
    const child = execFile(
      "node",
      [
        "--experimental-transform-types",
        fileURLToPath(new URL("./fixture/dependency-encoding-contract.mjs", import.meta.url)),
      ],
      { windowsHide: true },
      (error, stdout) => {
        clearTimeout(inactivity)
        if (inactivityError || error) reject(inactivityError ?? error)
        else resolve(stdout)
      },
    )
    const activity = () => {
      clearTimeout(inactivity)
      inactivity = setTimeout(() => {
        inactivityError = new Error("Dependency transport checker made no progress for 20 seconds")
        child.kill()
      }, 20_000)
    }
    child.stdout?.on("data", activity)
    child.stderr?.on("data", activity)
    activity()
  })
  expect(JSON.parse(result)).toEqual({
    rejected: {
      name: "TypeError",
      message: "fetch failed",
      cause: "too many content-encodings in response: 6, maximum allowed is 5",
    },
    subsequent: { status: 201, body: "first:second" },
    dispatcher: "disposed",
    servers: "closed",
  })
}, 45_000)

for (const [name, packageFile] of [
  ["backend", "../package.json"],
  ["website", "../../web/package.json"],
] as const) {
  const { z } = createRequire(new URL(packageFile, import.meta.url))("zod")
  test(`${name} collection schemas return one upper-bound issue and preserve valid parsed values`, () => {
    const cases = [
      { schema: z.array(z.number()).max(2), oversized: Array(128).fill("invalid"), valid: [1, 2], origin: "array" },
      { schema: z.array(z.number()).length(2), oversized: Array(128).fill("invalid"), valid: [1, 2], origin: "array" },
      {
        schema: z.set(z.number()).max(2),
        oversized: new Set(Array.from({ length: 128 }, (_, i) => `invalid${i}`)),
        valid: new Set([1, 2]),
        origin: "set",
      },
      {
        schema: z.map(z.string(), z.number()).max(2),
        oversized: new Map(Array.from({ length: 128 }, (_, i) => [`key${i}`, "invalid"])),
        valid: new Map([
          ["first", 1],
          ["second", 2],
        ]),
        origin: "map",
      },
    ]
    for (const { schema, oversized, valid, origin } of cases) {
      expect(schema.parse(valid)).toEqual(valid)
      const result = schema.safeParse(oversized)
      expect(result.success).toBe(false)
      expect(
        result.error.issues.map((issue: any) => ({
          code: issue.code,
          path: issue.path,
          maximum: issue.maximum,
          inclusive: issue.inclusive,
          origin: issue.origin,
        })),
      ).toEqual([{ code: "too_big", path: [], maximum: 2, inclusive: true, origin }])
    }
  })
}
