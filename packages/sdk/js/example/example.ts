import { createOpenCorvusClient, createOpenCorvusServer } from "@opencorvus-ai/sdk"
import { pathToFileURL } from "bun"

const server = await createOpenCorvusServer()
const client = createOpenCorvusClient({ baseUrl: server.url })

try {
  const input = await Array.fromAsync(new Bun.Glob("packages/core/*.ts").scan())

  const tasks: Promise<void>[] = []
  for await (const file of input) {
    console.log("processing", file)
    const session = await client.session.create()
    tasks.push(
      client.session.prompt({
        path: { id: session.data.id },
        body: {
          messageID: `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`,
          parts: [
            {
              type: "file",
              mime: "text/plain",
              url: pathToFileURL(file).href,
            },
            {
              type: "text",
              text: `Write tests for every public function in this file.`,
            },
          ],
        },
      }),
    )
    console.log("done", file)
  }

  await Promise.all(
    input.map(async (file) => {
      const session = await client.session.create()
      console.log("processing", file)
      await client.session.prompt({
        path: { id: session.data.id },
        body: {
          messageID: `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`,
          parts: [
            {
              type: "file",
              mime: "text/plain",
              url: pathToFileURL(file).href,
            },
            {
              type: "text",
              text: `Write tests for every public function in this file.`,
            },
          ],
        },
      })
      console.log("done", file)
    }),
  )
} finally {
  await server.close()
}
