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
    ["/repo", "/repo/folder/../README.md", "README.md"],
    ["/repo", "/repo-other/../repo/README.md", "README.md"],
    ["/repo/sub/..", "/repo/README.md", "README.md"],
    ["/", "/../../README.md", "README.md"],
    ["/repo", "/repo/../repo/资料/ Note.md ", "资料/ Note.md "],
    ["/repo", "/repo/folder\\/../file\\name.md", "file\\name.md"],
    ["C:/repo", "c:/REPO/folder/../README.md", "README.md"],
    ["C:/repo", "C:/repo-other/../repo/README.md", "README.md"],
    ["C:/repo/sub/..", "C:/repo/README.md", "README.md"],
    ["C:/", "C:/../../README.md", "README.md"],
    ["//host/share/repo", "//HOST/SHARE/repo-other/../repo/README.md", "README.md"],
    ["//host/share", "//host/share/../../../README.md", "README.md"],
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
    ["/repo", "/repo/../outside.md"],
    ["/repo", "/repo/../../outside.md"],
    ["C:/repo", "C:/repo/../outside.md"],
    ["//host/share/repo", "//host/share/repo/../outside.md"],
  ])("retains the absolute external resource %s → %s", (base, target) => {
    expect(shortRelativePath(target, base)).toBe(target)
  })
})
