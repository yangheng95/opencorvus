import { expect, test } from "bun:test"
import { configDraftMergePatch } from "../src/services/config"

test("renaming and deleting environment keys sends the precise project merge patch", () => {
  const original = {
    locale: "en-US",
    local_environment: { name: "Review", variables: { KEEP: "original", REMOVE: "remove", OLD: "rename" } },
  }
  const edited = {
    locale: "en-US",
    local_environment: { name: "Review", variables: { KEEP: "original", RENAMED: "rename" } },
  }

  expect(configDraftMergePatch(original, edited)).toEqual({
    local_environment: { variables: { REMOVE: null, OLD: null, RENAMED: "rename" } },
  })
})

test("clearing the last environment variable and setup source expresses both deletions", () => {
  const original = {
    local_environment: { name: "Review", variables: { LAST: "original" }, setup_script: "echo reviewed" },
  }

  expect(configDraftMergePatch(original, { local_environment: { name: "Review", variables: {} } })).toEqual({
    local_environment: { variables: { LAST: null }, setup_script: null },
  })
})

test("creating an environment carries its exact new name and empty variable value", () => {
  const edited = { local_environment: { name: "Review", variables: { EMPTY: "" } } }

  expect(configDraftMergePatch({}, edited)).toEqual(edited)
})
