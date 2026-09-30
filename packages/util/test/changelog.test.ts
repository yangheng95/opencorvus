import { describe, expect, test } from "bun:test"
import { parseChangelog, requireReleaseNotes, renderReleaseNotes } from "../src/changelog"

const source = `# 更新日志

## 未发布

## 0.0.35beta - 2026-08-07

### Added

- 长程任务与专业协作。

## 0.0.35-beta.1 - 2026-08-08

### Fixed

- 修复安装程序。

## 0.1.22 - 2026-09-30

### Added

- 独立侧边对话与消息引用。
`

describe("authored release history", () => {
  test("normalizes compact and numbered beta versions and orders the complete history", () => {
    expect(parseChangelog(source).map(({ version, date }) => ({ version, date }))).toEqual([
      { version: "0.1.22", date: "2026-09-30" },
      { version: "0.0.35-beta.1", date: "2026-08-08" },
      { version: "0.0.35-beta", date: "2026-08-07" },
    ])
  })
  test("publishes the exact authored dated content and its version history link", () => {
    expect(renderReleaseNotes(requireReleaseNotes(parseChangelog(source), "v0.1.22"))).toBe(
      "## 0.1.22 - 2026-09-30\n\n### Added\n\n- 独立侧边对话与消息引用。\n\n[完整版本历史 / Version history](https://opencorvus.com/zh-cn/changelog/0.1.22/)",
    )
  })
  test("reports the missing dated version as a typed publication error", () => {
    expect(() => requireReleaseNotes(parseChangelog(source), "0.1.23")).toThrow(
      expect.objectContaining({ code: "release_notes_missing" }),
    )
  })
  test("reports duplicate canonical identities as a typed error", () => {
    expect(() => parseChangelog(source + "\n## 0.0.35-beta - 2026-08-07\n\n- 重复记录。\n")).toThrow(
      expect.objectContaining({ code: "changelog_duplicate_version" }),
    )
  })
  test("reports impossible calendar dates as a typed error", () => {
    expect(() => parseChangelog("## 0.1.22 - 2026-02-30\n\n- 更新。\n")).toThrow(
      expect.objectContaining({ code: "changelog_invalid" }),
    )
  })
  test("retains literal headings inside fenced code examples in the authored body", () => {
    const text = "## 0.1.22 - 2026-09-30\n\n### Added\n\n- 新增使用示例。\n\n```md\n## 示例标题\n```\n"
    expect(parseChangelog(text)).toEqual([
      {
        version: "0.1.22",
        displayVersion: "0.1.22",
        date: "2026-09-30",
        markdown: "### Added\n\n- 新增使用示例。\n\n```md\n## 示例标题\n```",
      },
    ])
  })
  test("reports a dated section without written content as a typed error", () => {
    expect(() => parseChangelog("## 0.1.22 - 2026-09-30\n\n### Fixed\n")).toThrow(
      expect.objectContaining({ code: "changelog_invalid" }),
    )
  })
})
