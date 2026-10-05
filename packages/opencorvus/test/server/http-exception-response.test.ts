import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { basicAuth } from "hono/basic-auth"
import { HTTPException } from "hono/http-exception"
import { requestID, serverErrorResponse } from "../../src/server/error-handler"

describe("authored HTTP exception responses", () => {
  test("projects the actual Basic Auth public response and challenge", async () => {
    const app = new Hono()
      .onError(serverErrorResponse)
      .use(basicAuth({ username: "contract", password: crypto.randomUUID() }))
      .get("/protected", (c) => c.text("authorized"))
    const response = await app.request("/protected")
    expect(response.status).toBe(401)
    expect(response.headers.get("WWW-Authenticate")).toBe('Basic realm="Secure Area"')
    expect(await response.text()).toBe("Unauthorized")
    expect(response.headers.get("x-opencorvus-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  test("retains supplied entity and semantic headers with the canonical context identity", async () => {
    let identity = ""
    const app = new Hono()
      .onError(serverErrorResponse)
      .use(async (c, next) => {
        identity = requestID(c)
        c.header("x-context-contract", "preserved")
        c.header("Access-Control-Allow-Origin", "http://127.0.0.1:17885")
        await next()
      })
      .get("/limited", () => {
        throw new HTTPException(429, {
          res: Response.json(
            { code: "RATE_LIMITED", retrySeconds: 17 },
            {
              status: 503,
              headers: {
                "Content-Type": "application/problem+json",
                "Retry-After": "17",
                "x-opencorvus-request-id": "producer-value",
              },
            },
          ),
        })
      })
    const response = await app.request("/limited")
    expect(response.status).toBe(429)
    expect(response.headers.get("Content-Type")).toBe("application/problem+json")
    expect(response.headers.get("Retry-After")).toBe("17")
    expect(response.headers.get("x-context-contract")).toBe("preserved")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:17885")
    expect(response.headers.get("x-opencorvus-request-id")).toBe(identity)
    expect(await response.json()).toEqual({ code: "RATE_LIMITED", retrySeconds: 17 })
  })

  test.each([
    {
      status: 400 as const,
      message: "Invalid request",
      body: { data: { message: "Invalid request" }, error: [{ message: "Invalid request" }], success: false },
    },
    {
      status: 404 as const,
      message: "Missing item",
      body: { name: "NotFoundError", data: { message: "Missing item" } },
    },
    {
      status: 403 as const,
      message: "Action forbidden",
      body: { name: "UnknownError", data: { message: "Action forbidden" } },
    },
    {
      status: 503 as const,
      message: "Temporarily unavailable",
      body: { name: "UnknownError", data: { message: "Temporarily unavailable" } },
    },
  ])("projects the current message-authored $status envelope", async ({ status, message, body }) => {
    const app = new Hono().onError(serverErrorResponse).get("/operation", () => {
      throw new HTTPException(status, { message })
    })
    const response = await app.request("/operation")
    expect(response.status).toBe(status)
    expect(response.headers.get("Content-Type")).toBe("application/json")
    expect(await response.json()).toEqual(body)
  })
})
