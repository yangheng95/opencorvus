import { describe, expect, test } from "bun:test"
import { queueLimit } from "../src/channel-policy"

describe("channel policy", () => {
  test("queueLimit parses valid env and rejects invalid configured values", () => {
    expect(queueLimit({})).toBe(20)
    expect(queueLimit({ OPENCORVUS_CHANNEL_SESSION_QUEUE_LIMIT: "12" })).toBe(12)
    expect(() => queueLimit({ OPENCORVUS_CHANNEL_SESSION_QUEUE_LIMIT: "0" })).toThrow(
      "OPENCORVUS_CHANNEL_SESSION_QUEUE_LIMIT must be a positive integer",
    )
    expect(() => queueLimit({ OPENCORVUS_CHANNEL_SESSION_QUEUE_LIMIT: "abc" })).toThrow(
      "OPENCORVUS_CHANNEL_SESSION_QUEUE_LIMIT must be a positive integer",
    )
    expect(() => queueLimit({ OPENCORVUS_CHANNEL_SESSION_QUEUE_LIMIT: "12.5" })).toThrow(
      "OPENCORVUS_CHANNEL_SESSION_QUEUE_LIMIT must be a positive integer",
    )
  })
})
