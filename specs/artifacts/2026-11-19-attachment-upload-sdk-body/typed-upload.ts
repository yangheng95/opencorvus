import { createOpenCorvusClient, type AttachmentCreateData } from "D:/myhexin-local/opencorvus/packages/sdk/js/src/client.ts"
export async function typedUpload() {
 const sdk = createOpenCorvusClient({ baseUrl: "http://127.0.0.1:40114", directory: "C:/owned-review" })
 const data: AttachmentCreateData = { body: new File([], "empty.txt"), query: { filename: "empty.txt" }, url: "/attachment" }
 const result = await sdk.attachment.create({ filename: data.query.filename, body: data.body }, { throwOnError: true, headers: { "Content-Type": "text/plain" } })
 return { name: result.data.filename, size: result.data.size }
}
