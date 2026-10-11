import { describe, expect, test } from "bun:test"
import { relativePathFrom, shortRelativePath } from "../src/utils/tool"

describe("server-owned path relationships", () => {
  test.each([
    ["/srv/project", "/srv/project/src/Source.ts", "src/Source.ts"],
    ["/srv/project/", "/srv/project/src/Source.ts", "src/Source.ts"],
    ["/", "/var/source.ts", "var/source.ts"],
    ["/srv/project", "/srv/project/file\\name.ts", "file\\name.ts"],
    ["/srv/project\\", "/srv/project\\/source.ts", "source.ts"],
    ["C:\\Work\\Project", "c:/work/project/src/Source.ts", "src/Source.ts"],
    ["C:/Work/Project/", "c:\\work\\project\\src\\Source.ts", "src/Source.ts"],
    ["C:\\", "c:/src/Source.ts", "src/Source.ts"],
    ["\\\\Server\\Share\\Project", "//server/share/project/src/Source.ts", "src/Source.ts"],
    ["//Server/Share/Project", "\\\\server\\share\\project\\src\\Source.ts", "src/Source.ts"],
  ])("resolves %s → %s as the exact relative resource", (base, target, expected) => {
    expect(relativePathFrom(base, target)).toBe(expected)
    expect(shortRelativePath(target, base)).toBe(expected)
  })

  test.each([
    ["/srv/project", "/srv/Project/source.ts"],
    ["/srv/project", "/srv/project-other/source.ts"],
    ["/srv/project\\", "/srv/project/source.ts"],
    ["C:\\Work\\Project", "D:\\Work\\Project\\Source.ts"],
    ["C:\\Work\\Project", "C:/Work/Project-other/Source.ts"],
    ["\\\\Server\\Share\\Project", "\\\\Server\\Other\\Project\\Source.ts"],
  ])("retains the absolute external resource %s → %s", (base, target) => {
    expect(shortRelativePath(target, base)).toBe(target)
  })
})
