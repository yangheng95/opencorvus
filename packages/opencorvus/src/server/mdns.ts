import { Log } from "@/util/log"
import { Bonjour } from "bonjour-service"

const log = Log.create({ service: "mdns" })

type MDNSService = {
  on(event: "up", listener: () => void): unknown
  on(event: "error", listener: (error: unknown) => void): unknown
}

export type MDNSBackend = {
  publish(options: {
    name: string
    type: string
    host: string
    port: number
    txt: { path: string }
  }): MDNSService
  unpublishAll(): void
  destroy(): void
}

type MDNSLogger = {
  info(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

/**
 * Owns one mDNS (multicast Domain Name System) publication and its backend.
 * The backend remains reachable until destroy proves that its resources are released.
 */
export function createMDNSPublisher(
  createBackend: () => MDNSBackend = () => new Bonjour(),
  logger: MDNSLogger = log,
) {
  let publication:
    | {
        backend: MDNSBackend
        port: number | undefined
        healthy: boolean
      }
    | undefined

  function unpublish() {
    if (!publication) return true

    const owned = publication
    const failures: unknown[] = []
    try {
      owned.backend.unpublishAll()
    } catch (error) {
      failures.push(error)
    }

    let destroyed = false
    try {
      owned.backend.destroy()
      destroyed = true
    } catch (error) {
      failures.push(error)
    }

    if (failures.length > 0) {
      const error = failures.length === 1 ? failures[0] : new AggregateError(failures, "mDNS unpublish failed")
      logger.error("mDNS unpublish failed", { error })
    }
    if (!destroyed) return false

    if (publication === owned) publication = undefined
    logger.info("mDNS service unpublished")
    return true
  }

  function publish(port: number, domain?: string) {
    if (publication?.port === port && publication.healthy) return true
    if (publication && !unpublish()) return false

    const host = domain ?? "opencorvus.local"
    const name = `opencorvus-${port}`
    let backend: MDNSBackend | undefined
    try {
      backend = createBackend()
      const service = backend.publish({
        name,
        type: "http",
        host,
        port,
        txt: { path: "/" },
      })
      const owned = {
        backend,
        port,
        healthy: true,
      }
      publication = owned

      service.on("up", () => {
        if (publication === owned && owned.healthy) logger.info("mDNS service published", { name, port })
      })
      service.on("error", (error) => {
        if (publication === owned) owned.healthy = false
        logger.error("mDNS service error", { error })
      })
      return true
    } catch (publishError) {
      const failures: unknown[] = [publishError]
      if (backend) {
        try {
          backend.destroy()
        } catch (destroyError) {
          failures.push(destroyError)
          publication = {
            backend,
            port: undefined,
            healthy: false,
          }
        }
      }
      const error =
        failures.length === 1 ? failures[0] : new AggregateError(failures, "mDNS publish and cleanup failed")
      logger.error("mDNS publish failed", { error })
      return false
    }
  }

  return {
    publish,
    unpublish,
  }
}

const publisher = createMDNSPublisher()

export namespace MDNS {
  export const publish = publisher.publish
  export const unpublish = publisher.unpublish
}
