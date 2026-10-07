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

test("Astro TOML parser preserves dotted, quoted, array-table and bounded many-key data", () => {
  const { parse, TomlError } = astroRequire("smol-toml")
  const data = parse(
    'title="观察🙂"\n"a.b"="literal"\nowner.name="Ada"\nvalues=[1,2]\nenabled=true\n[[rows]]\nname="one"\n[[rows]]\nname="two"',
  )
  expect(data).toEqual({
    title: "观察🙂",
    "a.b": "literal",
    owner: { name: "Ada" },
    values: [1, 2],
    enabled: true,
    rows: [{ name: "one" }, { name: "two" }],
  })
  const expected = Object.fromEntries(Array.from({ length: 256 }, (_, index) => [`key${index}`, index]))
  const document = Object.entries(expected)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
  expect(parse(document)).toEqual(expected)
  let error
  try {
    parse("a=[1 #")
  } catch (caught) {
    error = caught
  }
  expect({ typed: error instanceof TomlError, line: error?.line }).toEqual({ typed: true, line: 1 })
})
