import { describe, expect, test } from "bun:test"
import { parseChangelog, requireReleaseNotes, renderReleaseNotes, standaloneReleaseNotes } from "../src/changelog"

const source = `# 更新日志

## 未发布

## 0.0.35beta - 2026-08-07

### zh-CN

#### 新增

- 长程任务与专业协作。

### en-US

#### Added

- Long-horizon work and expert collaboration.

## 0.0.35-beta.1 - 2026-08-08

### zh-CN

#### 修复

- 修复安装程序。

### en-US

#### Fixed

- Fixed installers.

## 0.1.22 - 2026-09-30

### zh-CN

#### 新增

- 独立侧边对话与消息引用。

### en-US

#### Added

- Independent side conversations and message references.
`

describe("authored release history", () => {
  test("projects localized standalone heading levels while preserving fenced literal headings", () => {
    const entry = requireReleaseNotes(parseChangelog(source), "0.1.22")
    expect(standaloneReleaseNotes(entry, "en-US")).toBe("### Added\n\n- Independent side conversations and message references.")
    expect(standaloneReleaseNotes({ ...entry, notes: { ...entry.notes, "en-US": "#### Added\n\n```md\n#### Literal\n```" } }, "en-US")).toBe("### Added\n\n```md\n#### Literal\n```")
  })
  test("normalizes compact and numbered beta versions and orders the complete history", () => {
    expect(parseChangelog(source).map(({ version, date }) => ({ version, date }))).toEqual([
      { version: "0.1.22", date: "2026-09-30" },
      { version: "0.0.35-beta.1", date: "2026-08-08" },
      { version: "0.0.35-beta", date: "2026-08-07" },
    ])
  })
  test("publishes the exact authored dated content and its version history link", () => {
    expect(renderReleaseNotes(requireReleaseNotes(parseChangelog(source), "v0.1.22"))).toBe(
      "## 0.1.22 - 2026-09-30\n\n### 简体中文\n\n#### 新增\n\n- 独立侧边对话与消息引用。\n\n[完整版本历史](https://opencorvus.com/zh-cn/changelog/0.1.22/)\n\n### English\n\n#### Added\n\n- Independent side conversations and message references.\n\n[Version history](https://opencorvus.com/changelog/0.1.22/)",
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
    const text = "## 0.1.22 - 2026-09-30\n\n### zh-CN\n\n#### 新增\n\n- 新增使用示例。\n\n```md\n## 示例标题\n### en-US\n```\n\n### en-US\n\n- Example usage.\n"
    expect(parseChangelog(text)).toEqual([
      {
        version: "0.1.22",
        displayVersion: "0.1.22",
        date: "2026-09-30",
        notes: {
          "zh-CN": "#### 新增\n\n- 新增使用示例。\n\n```md\n## 示例标题\n### en-US\n```",
          "en-US": "- Example usage.",
        },
      },
    ])
  })
  test("reports a dated section without written content as a typed error", () => {
    expect(() => parseChangelog("## 0.1.22 - 2026-09-30\n\n### Fixed\n")).toThrow(
      expect.objectContaining({ code: "changelog_invalid" }),
    )
  })
  test("extracts independently authored bodies for both interface languages", () => {
    expect(requireReleaseNotes(parseChangelog(source), "0.1.22").notes).toEqual({
      "zh-CN": "#### 新增\n\n- 独立侧边对话与消息引用。",
      "en-US": "#### Added\n\n- Independent side conversations and message references.",
    })
  })
  test("reports the exact missing language as a typed error", () => {
    expect(() => parseChangelog("## 0.1.22 - 2026-09-30\n\n### zh-CN\n\n- 更新。\n")).toThrow(
      expect.objectContaining({ code: "release_notes_locale_missing", message: "Written en-US release notes are required for 0.1.22" }),
    )
  })
  test("reports empty localized content as a written-content error", () => {
    expect(() => parseChangelog("## 0.1.22 - 2026-09-30\n\n### zh-CN\n\n#### 修复\n\n### en-US\n\n- Fixed installers.")).toThrow(
      expect.objectContaining({ code: "changelog_invalid", message: "Changelog 0.1.22 requires written zh-CN change entries" }),
    )
  })
  test("reports duplicate languages as a typed format error", () => {
    expect(() => parseChangelog(source + "\n### en-US\n\n- Duplicate.")).toThrow(
      expect.objectContaining({ code: "changelog_invalid", message: "Invalid or duplicate changelog language for 0.1.22: en-US" }),
    )
  })
})
