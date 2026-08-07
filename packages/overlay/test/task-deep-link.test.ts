import { describe, expect, test } from "bun:test"
import { TaskDeepLinkError, taskDeepLinkFromSearch } from "../src/services/task-deep-link"

describe("task deep link parsing", () => {
  test("parses the canonical taskID parameter", () => {
    expect(taskDeepLinkFromSearch("?taskID=tsk_123")).toEqual({
      taskID: "tsk_123",
    })
  })

  test("returns null when no task deep link parameters are present", () => {
    expect(taskDeepLinkFromSearch("?theme=dark")).toBeNull()
    expect(taskDeepLinkFromSearch("?directory=C%3A%2Frepo%2Fapp")).toBeNull()
    expect(taskDeepLinkFromSearch("")).toBeNull()
  })

  test("rejects empty task deep links instead of falling back to restore", () => {
    expect(() => taskDeepLinkFromSearch("?taskID=")).toThrow(TaskDeepLinkError)
  })

  test("rejects duplicate canonical parameters", () => {
    expect(() => taskDeepLinkFromSearch("?taskID=tsk_1&taskID=tsk_2")).toThrow(TaskDeepLinkError)
  })

  test("does not accept task parameter aliases or directory", () => {
    expect(() => taskDeepLinkFromSearch("?task=tsk_123&directory=C%3A%2Frepo%2Fapp")).toThrow(TaskDeepLinkError)
    expect(() => taskDeepLinkFromSearch("?taskId=tsk_123")).toThrow(TaskDeepLinkError)
    expect(() => taskDeepLinkFromSearch("?task_id=tsk_123")).toThrow(TaskDeepLinkError)
    expect(() => taskDeepLinkFromSearch("?taskID=tsk_123&directory=C%3A%2Frepo%2Fapp")).toThrow(TaskDeepLinkError)
  })
})
