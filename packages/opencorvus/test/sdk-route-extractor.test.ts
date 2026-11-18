import { expect, test } from "bun:test"
import { extractSdkRoutesFromText } from "../script/check/sdk-route-extractor"

test("SDK route inventory reads actual URLs after raw body and request options", () => {
  const source = `
    client.post<Response, Error, true>({
      bodySerializer: null,
      url: "/attachment",
      ...options,
      ...params,
    })
    client.get({ headers: { url: "header-label" }, url: "/provider" })
    client.put({ ...options, url: "/file/content" })
    client.patch({ body: parameters, "url": "/config" })
    client.delete({ headers: requestHeaders, url: "/session/{sessionID}" })
  `
  expect([...extractSdkRoutesFromText(source)].sort()).toEqual([
    "DELETE /session/{sessionID}",
    "GET /provider",
    "PATCH /config",
    "POST /attachment",
    "PUT /file/content",
  ])
})

test("SDK route inventory reads generated streaming calls and literal template URLs", () => {
  const source = [
    'client.sse.get<Event>({ signal, url: "/event", ...options })',
    "client.sse.post<Event>({ body, url: `/session/{sessionID}/prompt`, ...options })",
  ].join("\n")
  expect([...extractSdkRoutesFromText(source)]).toEqual(["GET /event", "POST /session/{sessionID}/prompt"])
})
