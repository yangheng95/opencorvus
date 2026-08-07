import { afterEach, describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"

afterEach(() => {
  Server.resetProjectRoutesAppForTest()
})

describe("Server cross-origin response contract", () => {
  test("exposes the archive filename header to an allowed Overlay origin", async () => {
    const response = await Server.App().request("/global/health", {
      headers: {
        Origin: "http://127.0.0.1:5175",
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Expose-Headers")).toBe("Content-Disposition")
  })
})
