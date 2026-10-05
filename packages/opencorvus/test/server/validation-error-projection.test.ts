import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { describeRoute, generateSpecs, resolver } from "hono-openapi"
import z from "zod"
import { Auth } from "../../src/auth"
import { GlobalChatStartInput } from "../../src/chat/global-chat-start"
import { badRequestBody, errors } from "../../src/server/error"
import { requestID, serverErrorResponse } from "../../src/server/error-handler"
import { validator } from "../../src/server/validator"

function app() {
  return new Hono().onError(serverErrorResponse).use(async (c, next) => {
    c.header("x-opencorvus-request-id", requestID(c))
    await next()
  })
}

function json(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
}

describe("public validation error projection", () => {
  test.each([
    {
      name: "OAuth expiry",
      input: {
        type: "oauth",
        access: "DUMMY_NON_CREDENTIAL_ACCESS",
        refresh: "DUMMY_NON_CREDENTIAL_REFRESH",
        expires: "invalid-number",
      },
      issue: { code: "invalid_type", path: ["expires"], message: "Invalid input: expected number, received string" },
    },
    {
      name: "API metadata",
      input: { type: "api", key: "DUMMY_NON_CREDENTIAL_APIKEY", metadata: { label: 123 } },
      issue: {
        code: "invalid_type",
        path: ["metadata", "label"],
        message: "Invalid input: expected string, received number",
      },
    },
  ])("projects the canonical $name error with its response identity", async ({ input, issue }) => {
    const route = app().post("/auth", validator("json", Auth.Info), (c) => c.json({ accepted: true }))
    const response = await route.request("/auth", json(input))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      data: { message: "Request validation failed" },
      error: [issue],
      success: false,
    })
    expect(response.headers.get("x-opencorvus-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  test.each([
    {
      name: "root union",
      schema: z.union([z.string(), z.number()]),
      input: { value: "DUMMY_NON_CREDENTIAL_VALUE" },
      issue: { code: "invalid_union", path: [], message: "Invalid input" },
    },
    {
      name: "dynamic record key",
      schema: z.record(z.string(), z.string()),
      input: { DUMMY_DYNAMIC_FIELD: 123 },
      issue: {
        code: "invalid_type",
        path: ["DUMMY_DYNAMIC_FIELD"],
        message: "Invalid input: expected string, received number",
      },
    },
    {
      name: "strict object",
      schema: z.object({ name: z.string() }).strict(),
      input: { name: "valid", DUMMY_DYNAMIC_FIELD: "DUMMY_NON_CREDENTIAL_VALUE" },
      issue: { code: "unrecognized_keys", path: [], message: 'Unrecognized key: "DUMMY_DYNAMIC_FIELD"' },
    },
    {
      name: "authored custom prose",
      schema: z.string().superRefine((value, ctx) => {
        ctx.addIssue({ code: "custom", message: `Authored diagnostic: ${value}` })
      }),
      input: "DUMMY_AUTHORED_VALUE",
      issue: { code: "custom", path: [], message: "Authored diagnostic: DUMMY_AUTHORED_VALUE" },
    },
  ])("retains the explicit diagnostic contract for $name", async ({ schema, input, issue }) => {
    const route = app().post("/value", validator("json", schema), (c) => c.json({ accepted: true }))
    const response = await route.request("/value", json(input))
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 400,
      body: { data: { message: "Request validation failed" }, error: [issue], success: false },
    })
  })

  test("normalizes Standard Schema property-key locations and message-only errors", () => {
    expect(
      badRequestBody("Request validation failed", [
        { message: "Located issue", code: "custom", path: [{ key: "items" }, { key: 2 }, Symbol("field")] },
      ]),
    ).toEqual({
      data: { message: "Request validation failed" },
      error: [{ code: "custom", path: ["items", 2, "Symbol(field)"], message: "Located issue" }],
      success: false,
    })
    expect(badRequestBody("Manual explanation")).toEqual({
      data: { message: "Manual explanation" },
      error: [{ message: "Manual explanation" }],
      success: false,
    })
  })

  test("passes transformed query, param and JSON values to the typed handler", async () => {
    const route = app().post(
      "/item/:id",
      validator("param", z.object({ id: z.string().transform((value) => value.toUpperCase()) })),
      validator("query", z.object({ page: z.coerce.number().int() })),
      validator("json", z.object({ label: z.string().transform((value) => value.length) })),
      (c) => {
        const page: number = c.req.valid("query").page
        const labelLength: number = c.req.valid("json").label
        const id: string = c.req.valid("param").id
        return c.json({ id, page, labelLength })
      },
    )
    const response = await route.request("/item/example?page=7", json({ label: "length" }))
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 200,
      body: { id: "EXAMPLE", page: 7, labelLength: 6 },
    })
  })

  test("retains optional JSON inference and the parsed empty object", async () => {
    const route = app().post(
      "/optional",
      validator("json", z.object({ note: z.string().optional() }).optional()),
      (c) => {
        const body: { note?: string } | undefined = c.req.valid("json")
        return c.json({ note: body?.note ?? "unset" })
      },
    )
    const response = await route.request("/optional", { method: "POST" })
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 200, body: { note: "unset" } })
  })

  test.each([
    { target: "query" as const, url: "/value?a=x", schema: z.object({ a: z.string().min(2) }), path: ["a"] },
    { target: "param" as const, url: "/value/x", schema: z.object({ a: z.string().min(2) }), path: ["a"] },
  ])("uses the shared projection for $target failures", async ({ target, url, schema, path }) => {
    const route = app().get(target === "param" ? "/value/:a" : "/value", validator(target, schema), (c) =>
      c.json({ accepted: true }),
    )
    const response = await route.request(url)
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 400,
      body: {
        data: { message: "Request validation failed" },
        error: [{ code: "too_small", path, message: "Too small: expected string to have >=2 characters" }],
        success: false,
      },
    })
  })

  test("retains the parser-authored malformed JSON response", async () => {
    const route = app().post("/value", validator("json", z.object({ value: z.string() })), (c) =>
      c.json({ accepted: true }),
    )
    const response = await route.request("/value", { ...json({}), body: '{"value":' })
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 400,
      body: {
        data: { message: "Malformed JSON in request body" },
        error: [{ message: "Malformed JSON in request body" }],
        success: false,
      },
    })
  })

  test("projects the canonical Global Chat attachment MIME location", async () => {
    const route = app().post("/chat", validator("json", GlobalChatStartInput), (c) => c.json({ accepted: true }))
    const response = await route.request(
      "/chat",
      json({
        requestID: "validation-dummy-attachment",
        text: "DUMMY_PRIVATE_REQUEST",
        attachments: [{ data: Buffer.from("dummy fixture").toString("base64"), mime: "" }],
      }),
    )
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 400,
      body: {
        data: { message: "Request validation failed" },
        error: [
          {
            code: "too_small",
            path: ["attachments", 0, "mime"],
            message: "Too small: expected string to have >=1 characters",
          },
        ],
        success: false,
      },
    })
  })

  test("publishes the actual request metadata and explicit BadRequestError schema", async () => {
    const route = app().post(
      "/documented",
      describeRoute({
        operationId: "contract.documented",
        responses: {
          200: { description: "Accepted", content: { "application/json": { schema: resolver(z.boolean()) } } },
          ...errors(400),
        },
      }),
      validator("json", z.object({ label: z.string() }).strict()),
      (c) => c.json(true),
    )
    const spec = await generateSpecs(route)
    expect(spec.paths?.["/documented"]?.post).toMatchObject({
      operationId: "contract.documented",
      requestBody: {
        content: { "application/json": { schema: { properties: { label: { type: "string" } }, required: ["label"] } } },
      },
      responses: { "200": { content: { "application/json": { schema: { type: "boolean" } } } } },
    })
    expect(spec.components?.schemas?.BadRequestError).toEqual({
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
          additionalProperties: false,
        },
        error: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              path: { type: "array", items: { anyOf: [{ type: "string" }, { type: "number" }] } },
              message: { type: "string" },
            },
            required: ["message"],
            additionalProperties: false,
          },
        },
        success: { type: "boolean", const: false },
      },
      required: ["data", "error", "success"],
      additionalProperties: false,
    })
  })
})
