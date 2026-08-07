import { expect, test } from "bun:test"

import {
  closeBrowserFixture,
  ownBrowserFixtureResource,
  startBrowserFixture,
} from "./browser/http-fixture.ts"
import { waitForObservedActivity } from "./launch.ts"

test("browser fixture cancels a streaming response body when its client disconnects", async () => {
  let cancelled = false
  const server = await startBrowserFixture(
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(":\n\n"))
          },
          cancel() {
            cancelled = true
          },
        }),
        { headers: { "content-type": "text/event-stream; charset=utf-8" } },
      ),
  )
  const controller = new AbortController()
  try {
    const response = await fetch(`${server.origin}/events`, { signal: controller.signal })
    expect(response.status).toBe(200)
    await response.body?.getReader().read()
    controller.abort()

    await waitForObservedActivity({
      label: "fixture response-body cancellation",
      observe: async () => cancelled,
      activityKey: String,
      isComplete: Boolean,
      describe: (value) => String(value),
    })
  } finally {
    controller.abort()
    await server.close()
  }
})

test("browser fixture close destroys active streaming HTTP connections", async () => {
  const server = await startBrowserFixture(() => {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(":\n\n"))
        },
      }),
      {
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      },
    )
  })
  const controller = new AbortController()
  try {
    const response = await fetch(`${server.origin}/events`, { signal: controller.signal })
    expect(response.status).toBe(200)
    const started = Date.now()
    await server.close()
    expect(Date.now() - started).toBeLessThan(1_000)
  } finally {
    controller.abort()
  }
})

test("browser fixture repeated close returns the same successful settlement", async () => {
  const server = await startBrowserFixture(() => new Response("ok"))

  const firstClose = server.close()
  const secondClose = server.close()

  expect(secondClose).toBe(firstClose)
  await firstClose
  expect(server.close()).toBe(firstClose)
})

test("browser fixture resource repeated close preserves the failed settlement identity", async () => {
  const closeFailure = new Error("fixture close failed")
  let closeCalls = 0
  const owner = ownBrowserFixtureResource(async () => {
    closeCalls += 1
    throw closeFailure
  })

  const firstClose = owner.close()
  const secondClose = owner.close()

  expect(secondClose).toBe(firstClose)
  await expect(firstClose).rejects.toBe(closeFailure)
  await expect(owner.close()).rejects.toBe(closeFailure)
  expect(owner.close()).toBe(firstClose)
  expect(closeCalls).toBe(1)
})

test("browser fixture cleanup still closes the server when browser close reports an error", async () => {
  let serverClosed = false
  const browserError = new Error("browser collector failure")
  const browser = {
    async close() {
      throw browserError
    },
  }
  const server = {
    origin: "http://127.0.0.1:1",
    port: 1,
    async acquireBrowser<T>(launch: () => Promise<T>) {
      return launch()
    },
    async close() {
      serverClosed = true
    },
  }

  await expect(closeBrowserFixture(browser, server)).rejects.toBe(browserError)
  expect(serverClosed).toBe(true)
})

test("browser fixture acquisition closes the server and preserves launch and close failures", async () => {
  const launchFailure = new Error("browser launch failed")
  const closeFailure = new Error("server close failed")
  const owner = ownBrowserFixtureResource(async () => {
    throw closeFailure
  })
  const error = await owner
    .acquire(async () => {
      throw launchFailure
    })
    .catch((failure) => failure)

  expect(error).toBeInstanceOf(AggregateError)
  expect((error as AggregateError).errors).toEqual([launchFailure, closeFailure])
})

test("browser fixture acquisition closes a running server when browser launch fails", async () => {
  const launchFailure = new Error("browser launch failed")
  const server = await startBrowserFixture(() => new Response("ok"))

  await expect(server.acquireBrowser(async () => {
    throw launchFailure
  })).rejects.toBe(launchFailure)
  const firstClose = server.close()
  expect(server.close()).toBe(firstClose)
  await firstClose
})

test("browser fixture resource preserves falsy acquisition and close failures", async () => {
  const owner = ownBrowserFixtureResource(async () => {
    throw false
  })

  const error = await owner
    .acquire(async () => {
      throw 0
    })
    .catch((failure) => failure)

  expect(error).toBeInstanceOf(AggregateError)
  expect((error as AggregateError).errors).toEqual([0, false])
})

test("browser fixture cleanup preserves body, browser, and server failures in order", async () => {
  const bodyFailure = new Error("test body failed")
  const browserFailure = new Error("browser close failed")
  const serverFailure = new Error("server close failed")
  const error = await closeBrowserFixture(
    {
      close: async () => {
        throw browserFailure
      },
    },
    {
      origin: "http://127.0.0.1:1",
      port: 1,
      async acquireBrowser<T>(launch: () => Promise<T>) {
        return launch()
      },
      close: async () => {
        throw serverFailure
      },
    },
    bodyFailure,
  ).catch((failure) => failure)

  expect(error).toBeInstanceOf(AggregateError)
  expect((error as AggregateError).errors).toEqual([bodyFailure, browserFailure, serverFailure])
  expect((error as AggregateError).message).toContain("1. Error: test body failed")
  expect((error as AggregateError).message).toContain("2. Error: browser close failed")
  expect((error as AggregateError).message).toContain("3. Error: server close failed")
})
