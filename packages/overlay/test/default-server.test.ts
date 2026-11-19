import { expect, test } from "bun:test"
import { DEFAULT_LOCAL_SERVER_URL, defaultServerFromModule } from "../src/services/default-server"

const publishedModules = [
  ["http://127.0.0.1:40216/ui/assets/main.js", "http://127.0.0.1:40216"],
  ["https://example.test/team/edge/ui/assets/main.js", "https://example.test/team/edge"],
  ["https://example.test/team/ui/edge/ui/assets/chunk.js?version=2", "https://example.test/team/ui/edge"],
  ["https://example.test/team%20name/ui/assets/main.js", "https://example.test/team%20name"],
] as const

for (const [source, server] of publishedModules) {
  test(`selects ${server} from its published module`, () => {
    const moduleUrl = new URL(source)
    expect(defaultServerFromModule(moduleUrl.origin, moduleUrl)).toBe(server)
  })
}

const independentHosts = [
  ["http://localhost:5173", "http://localhost:5173/services/default-server.ts"],
  ["https://example.test", "https://example.test/assets/main.js"],
  ["https://example.test", "https://other.example.test/edge/ui/assets/main.js"],
  ["null", "tauri://localhost/assets/main.js"],
  [undefined, "file:///opt/opencorvus/default-server.ts"],
] as const

for (const [origin, source] of independentHosts) {
  test(`selects the shared loopback server for ${source}`, () => {
    expect(defaultServerFromModule(origin, new URL(source))).toBe(DEFAULT_LOCAL_SERVER_URL)
  })
}
