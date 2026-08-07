export * from "./client.js"
export * from "./server.js"

import {
  createOpenCorvusClient as createOpenCorvusClientImpl,
  type OpenCorvusClientConfig,
  OpenCorvusClient,
} from "./client.js"
import { createOpenCorvusServer as createOpenCorvusServerImpl, type ServerOptions } from "./server.js"

export type OpenCorvusOptions = ServerOptions &
  OpenCorvusClientConfig & {
    initGit?: boolean
  }

export type { OpenCorvusClientConfig, ServerOptions }
export { OpenCorvusClient }
export const createOpenCorvusClient = createOpenCorvusClientImpl
export const createOpenCorvusServer = createOpenCorvusServerImpl

export async function createOpenCorvus(options?: OpenCorvusOptions) {
  if (options?.initGit === true && !options.directory) {
    throw new Error("createOpenCorvus initGit=true requires a directory")
  }

  const {
    hostname,
    port,
    signal,
    timeout,
    config,
    directory,
    username,
    password,
    initGit,
    baseUrl: _ignoredBaseUrl,
    ...clientOptions
  } = options ?? {}
  const server = await createOpenCorvusServerImpl({
    hostname,
    port,
    signal,
    timeout,
    config,
  })

  const client = createOpenCorvusClientImpl({
    ...clientOptions,
    baseUrl: server.url,
    directory,
    username: username ?? process.env.OPENCORVUS_SERVER_USERNAME,
    password: password ?? process.env.OPENCORVUS_SERVER_PASSWORD,
  })

  if (initGit === true) {
    const result = await client.project.current2.initGit({ directory }, { responseStyle: "fields" })
    if (result.error) {
      await server.close()
      throw new Error(`createOpenCorvus initGit failed: ${JSON.stringify(result.error)}`)
    }
  }

  return {
    client,
    server,
  }
}
