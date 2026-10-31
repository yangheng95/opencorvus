import { describe, expect, test } from "bun:test"
import { projectDisplayName, projectLedgerDisplayName } from "../src/utils/project-directory"

const windowsDirectory = "C:\\workspace\\projects\\2026\\10\\31\\c7f4bfe2-c2d7-4a56-986d-7d2430cf37a3"

describe("project ledger display names", () => {
  test("identifies a Windows anonymous project by its existing directory suffix", () => {
    expect(projectLedgerDisplayName({
      directory: windowsDirectory,
      customName: "",
      unknownName: "Unknown project",
      implicitProjectName: "Anonymous",
    })).toBe("Anonymous cf37a3")
  })

  test("uses the current language for a POSIX anonymous project", () => {
    expect(projectLedgerDisplayName({
      directory: "/workspace/projects/2026/10/31/0846c455-8af5-4b13-87e9-ec231726d6bb",
      unknownName: "未知项目",
      implicitProjectName: "匿名项目",
    })).toBe("匿名项目 26d6bb")
  })

  test("retains the authored title for a named project", () => {
    expect(projectLedgerDisplayName({
      directory: "D:\\work\\support-report",
      customName: " 客户支持审阅 ",
      unknownName: "未知项目",
      implicitProjectName: "匿名项目",
    })).toBe("客户支持审阅")
  })

  test("uses the real directory name for an unnamed ordinary project", () => {
    expect(projectLedgerDisplayName({
      directory: "D:\\work\\support-report",
      unknownName: "Unknown project",
      implicitProjectName: "Anonymous",
    })).toBe("support-report")
  })

  test("uses the supplied unassigned label for an empty directory", () => {
    expect(projectLedgerDisplayName({
      directory: "",
      unknownName: "未分配项目",
      implicitProjectName: "匿名项目",
    })).toBe("未分配项目")
  })

  test("keeps the generic homepage display contract", () => {
    expect(projectDisplayName({
      directory: windowsDirectory,
      unknownName: "Unknown project",
      implicitProjectName: "Anonymous project",
    })).toBe("Anonymous project")
  })
})
