import { expect, test } from "bun:test"
import { ApiError } from "../src/services/api"
import { compareConfigMergePatch, projectConfigWriteEvidence } from "../src/services/config"

const path = "config?directory=C%3A%2FProject-A"

test("a project reconciliation failure carries its accepted configuration", () => {
  const config = { local_environment: { name: "Review" } }
  const receipt = new ApiError(409, path, {
    name: "ProjectConfigCommittedReconcileError",
    data: { committed: true, message: "Applying the configuration failed", config, failures: ["Runtime could not reload"] },
  }, { "x-opencorvus-request-id": "project-config-committed" }, "PATCH")

  expect(projectConfigWriteEvidence(receipt)).toEqual({ kind: "committed", config })
})

test("the canonical invalid draft response records a rejected write", () => {
  const invalid = new ApiError(400, path, {
    data: { message: "The environment name is required" },
    error: [{ path: ["local_environment", "name"], message: "The environment name is required" }],
    success: false,
  }, { "x-opencorvus-request-id": "invalid-project-config" }, "PATCH")

  expect(projectConfigWriteEvidence(invalid)).toEqual({ kind: "rejected" })
})

test("an interrupted response and a generic gateway response both leave the outcome unconfirmed", () => {
  const gateway = new ApiError(502, path, "Gateway closed the connection", {}, "PATCH")

  expect(projectConfigWriteEvidence(new TypeError("response interrupted"))).toEqual({ kind: "unconfirmed" })
  expect(projectConfigWriteEvidence(gateway)).toEqual({ kind: "unconfirmed" })
})

test("a current read confirms edited fields including removals while retaining independently written fields", () => {
  const patch = { local_environment: { variables: { RENAMED: "value", OLD: null }, setup_script: null } }
  const saved = {
    local_environment: { name: "Changed elsewhere", variables: { ADDED: "outside", RENAMED: "value" } },
    locale: "zh-CN",
  }

  expect(compareConfigMergePatch(saved, patch)).toBe("matches")
})

test("a current read gives the different outcome when a submitted field changed again", () => {
  const patch = { local_environment: { variables: { EDITED: "original draft", OLD: null } } }
  const saved = { local_environment: { name: "Review", variables: { EDITED: "newer writer" } } }

  expect(compareConfigMergePatch(saved, patch)).toBe("different")
})
