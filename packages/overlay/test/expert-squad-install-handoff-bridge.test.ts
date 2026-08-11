import { afterEach, describe, expect, test } from "bun:test"
import { installExpertSquadInstallHandoffBridge } from "../src/services/expert-squad-install-handoff"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { createTauriTransport } from "../src/services/tauri-transport"

afterEach(() => __setHostTransportForTest(undefined))

describe("Expert Squad install handoff bridge", () => {
  test("browser hosts receive an inert cleanup handle", async () => {
    __setHostTransportForTest(createTauriTransport("browser"))

    const cleanup = await installExpertSquadInstallHandoffBridge()

    expect(cleanup).toBeTypeOf("function")
    expect(cleanup()).toBeUndefined()
  })
})
