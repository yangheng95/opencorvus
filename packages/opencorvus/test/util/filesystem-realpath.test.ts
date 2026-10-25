import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "../../src/global"
import { Filesystem } from "../../src/util/filesystem"

test("physical paths preserve exact native entries through a directory link", async () => {
  const root = await fs.realpath(await Global.createTemporaryDirectory("physical-path-"))
  const directory = path.join(root, process.platform === "win32" ? "Data folder" : "Data\\ folder \n")
  const file = path.join(directory, process.platform === "win32" ? " Source.md" : " Source\\name.md \n")
  const alias = path.join(root, "alias")
  try {
    await fs.mkdir(directory)
    await fs.writeFile(file, "exact physical bytes\n")
    await fs.symlink(directory, alias, process.platform === "win32" ? "junction" : "dir")
    expect(await Filesystem.realpath(directory)).toBe(directory)
    expect(await Filesystem.realpath(file)).toBe(file)
    const resolved = await Filesystem.realpath(path.join(alias, path.basename(file)))
    expect({ resolved, content: await fs.readFile(resolved, "utf8") }).toEqual({
      resolved: file,
      content: "exact physical bytes\n",
    })
    const missing = path.join(directory, "absent")
    await expect(Filesystem.realpath(missing)).rejects.toMatchObject({ code: "ENOENT", path: missing })
    await expect(Filesystem.realpath(file + "\0suffix")).rejects.toMatchObject({ code: "ERR_INVALID_ARG_VALUE" })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
