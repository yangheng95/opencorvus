import { afterEach, beforeEach, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  MissingI18nKeyError,
  UnsupportedLocaleError,
  sanitizeLocale,
  setLocale,
  setLocaleData,
  t,
  tArray,
  tc,
} from "../src/utils/i18n"

const ROOT = path.resolve(import.meta.dir, "..")
const REAL_EN_US = JSON.parse(readFileSync(path.join(ROOT, "src/i18n/en-US.json"), "utf8")) as Record<string, unknown>
const REAL_ZH_CN = JSON.parse(readFileSync(path.join(ROOT, "src/i18n/zh-CN.json"), "utf8")) as Record<string, unknown>

const EN_US_FIXTURE = {
  "strict.only_en": "English only",
  "strict.title": "Title {{name}}",
  "strict.items": ["one", "two"],
  "strict.count": { one: "{{count}} item", other: "{{count}} items" },
  "strict.not_array": "not an array",
  "strict.not_plural": "not plural",
}

const ZH_CN_FIXTURE = {
  "strict.title": "标题 {{name}}",
  "strict.items": ["一", "二"],
  "strict.count": { one: "{{count}} 项", other: "{{count}} 项" },
  "strict.not_array": "不是数组",
  "strict.not_plural": "不是复数",
}

const originalConsoleError = console.error
let reportedErrors: unknown[] = []

beforeEach(async () => {
  reportedErrors = []
  console.error = (...args: unknown[]) => {
    reportedErrors.push(args[0])
  }
  setLocaleData("en-US", EN_US_FIXTURE)
  setLocaleData("zh-CN", ZH_CN_FIXTURE)
  await setLocale("zh-CN")
})

afterEach(async () => {
  console.error = originalConsoleError
  setLocaleData("en-US", REAL_EN_US)
  setLocaleData("zh-CN", REAL_ZH_CN)
  await setLocale("en-US")
})

test("t reads only the active locale and reports missing keys without crashing render", () => {
  expect(t("strict.title", { name: "OpenCorvus" })).toBe("标题 OpenCorvus")
  expect(t("strict.only_en")).toBe("strict.only_en")
  expect(t("strict.missing")).toBe("strict.missing")
  expect(t("frontend_design")).toBe("frontend_design")
  expect(reportedErrors).toHaveLength(3)
  expect(reportedErrors.every((error) => error instanceof MissingI18nKeyError)).toBe(true)
  expect(String((reportedErrors[2] as MissingI18nKeyError).message)).toContain("frontend_design")
})

test("tArray and tc report wrong locale value shapes without crashing render", () => {
  expect(tArray("strict.items")).toEqual(["一", "二"])
  expect(tc("strict.count", 2)).toBe("2 项")
  expect(tArray("strict.not_array")).toEqual(["strict.not_array"])
  expect(tc("strict.not_plural", 2)).toBe("strict.not_plural")
  expect(reportedErrors).toHaveLength(2)
  expect(reportedErrors.every((error) => error instanceof MissingI18nKeyError)).toBe(true)
})

test("unsupported locale input is rejected instead of silently becoming en-US", async () => {
  expect(sanitizeLocale("zh-Hans-CN")).toBe("zh-CN")
  expect(sanitizeLocale("en-GB")).toBe("en-US")
  expect(() => sanitizeLocale("fr-FR")).toThrow(UnsupportedLocaleError)
  await expect(setLocale("fr-FR")).rejects.toThrow(UnsupportedLocaleError)
  expect(() => setLocaleData("fr-FR", {})).toThrow(UnsupportedLocaleError)
})
