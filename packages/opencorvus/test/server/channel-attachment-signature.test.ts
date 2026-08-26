import { afterEach, describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import { ChannelAttachment } from "../../src/channel/attachment"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { Instance } from "../../src/project/instance"

afterEach(async () => {
  delete process.env["OPENCORVUS_PUBLIC_URL_SECRET"]
  delete process.env["OPENCORVUS_PUBLIC_URL"]
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("the channel attachment route declares the signature it reads", () => {
  test("a signed URL's expiry and signature authorize the read through the declared query contract", async () => {
    const project = await memoryProject()
    process.env["OPENCORVUS_PUBLIC_URL"] = "http://opencorvus.internal"
    // Without a signing secret `authorize` short-circuits to true and the
    // signature is never read, which would make this assertion vacuous.
    process.env["OPENCORVUS_PUBLIC_URL_SECRET"] = "channel-attachment-signature-test"

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const created = await ChannelAttachment.create({
          filename: "signed.txt",
          mime: "text/plain",
          data: Buffer.from("channel attachment bytes").toString("base64"),
        })

        // The route now declares `e` and `s`; the signed URL the channel hands
        // out must still authorize through that declaration unchanged.
        const response = await Server.App().fetch(new Request(created.url))

        expect({ status: response.status, body: await response.text() }).toEqual({
          status: 200,
          body: "channel attachment bytes",
        })
      },
    })
  }, 60_000)
})
