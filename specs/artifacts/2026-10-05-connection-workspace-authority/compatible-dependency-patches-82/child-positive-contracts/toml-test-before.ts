import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"

const require = createRequire(import.meta.url)
const astroRequire = createRequire(require.resolve("astro/package.json"))
const parserPath = astroRequire.resolve("smol-toml")

test("Astro's TOML parser reads data and reports an unfinished array at EOF", () => {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const { parse, TomlError } = require(${JSON.stringify(parserPath)});
    const data = parse('title = "OpenCorvus"\\nvalues = [1, 2]');
    let isTomlError;
    try { parse('a=[1 #'); } catch (error) { isTomlError = error instanceof TomlError; }
    console.log(JSON.stringify({ data, isTomlError }));
  `,
    ],
    { encoding: "utf8", timeout: 5000 },
  )
  expect(result.status).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({
    data: { title: "OpenCorvus", values: [1, 2] },
    isTomlError: true,
  })
}, 10_000)
