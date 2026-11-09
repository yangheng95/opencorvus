import { expect, test } from "bun:test"
import { ApiError } from "../src/services/api"
import { isMissingProjectDirectoryError } from "../src/services/workspace"

test("missing-directory recovery accepts the current project's normalized Windows identity", () => {
  const error = new ApiError(400, "path", {
    name: "ProjectDirectoryIntegrityError",
    data: {
      directory: "C:\\Workspace\\Project",
      reason: "missing",
      message: "Project directory does not exist: C:\\Workspace\\Project",
    },
  }, {}, "GET")

  expect(isMissingProjectDirectoryError(error, "c:/workspace/project/")).toBe(true)
})
