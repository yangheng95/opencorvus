import { expect, test } from "bun:test"
import { sanitizeShellEnvironment } from "@/shell/environment"

test("product text shells project a UTF-8 standard-stream default", () => {
  expect(sanitizeShellEnvironment({ PATH: "original-path" }, { PROJECT_VALUE: "current-project" })).toEqual({
    PATH: "original-path",
    PROJECT_VALUE: "current-project",
    PYTHONIOENCODING: "utf-8",
  })
})

test("explicit host and project standard-stream encodings retain their precedence", () => {
  expect([
    sanitizeShellEnvironment({ PYTHONIOENCODING: "latin-1" }, {}),
    sanitizeShellEnvironment({ PYTHONIOENCODING: "latin-1" }, { PYTHONIOENCODING: "ascii" }),
  ]).toEqual([{ PYTHONIOENCODING: "latin-1" }, { PYTHONIOENCODING: "ascii" }])
})

test("environment-name identity follows the native platform while project values win", () => {
  const base = { PYTHONIOENCODING: "latin-1", Path: "host-path" }
  const override = { pythonioencoding: "ascii", PATH: "project-path" }
  expect(sanitizeShellEnvironment(base, override)).toEqual(
    process.platform === "win32"
      ? { pythonioencoding: "ascii", PATH: "project-path" }
      : { ...base, ...override },
  )
  expect({ base, override }).toEqual({
    base: { PYTHONIOENCODING: "latin-1", Path: "host-path" },
    override: { pythonioencoding: "ascii", PATH: "project-path" },
  })
})

test.skipIf(process.platform !== "win32")("the final execution-guard layer owns its native environment name", () => {
  const plugin = { BASH_ENV: "plugin-first", bash_env: "plugin-second" }
  const guard = { BASH_ENV: "execution-guard" }
  expect(sanitizeShellEnvironment({}, plugin, guard)).toEqual({
    BASH_ENV: "execution-guard",
    PYTHONIOENCODING: "utf-8",
  })
})
