import type { Argv, InferredOptionTypes } from "yargs"
import { Config } from "../config/config"
import { DEFAULT_MDNS_DOMAIN, DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT } from "../server/defaults"

const options = {
  port: {
    type: "number" as const,
    describe: "port to listen on",
    defaultDescription: String(DEFAULT_SERVER_PORT),
  },
  hostname: {
    type: "string" as const,
    describe: "hostname to listen on",
    defaultDescription: DEFAULT_SERVER_HOST,
  },
  mdns: {
    type: "boolean" as const,
    describe: "enable mDNS service discovery (defaults hostname to 0.0.0.0)",
    defaultDescription: "false",
  },
  "mdns-domain": {
    type: "string" as const,
    describe: "custom domain name for mDNS service",
    defaultDescription: DEFAULT_MDNS_DOMAIN,
  },
  cors: {
    type: "string" as const,
    array: true,
    describe: "additional domains to allow for CORS",
    default: [] as string[],
  },
}

export type NetworkOptions = InferredOptionTypes<typeof options>

export function withNetworkOptions<T>(yargs: Argv<T>) {
  return yargs.options(options)
}

export async function resolveNetworkOptions(args: NetworkOptions) {
  const { server } = await Config.global()
  const mdns = args.mdns ?? server?.mdns ?? false
  const mdnsDomain = args["mdns-domain"] ?? server?.mdnsDomain ?? DEFAULT_MDNS_DOMAIN
  const port = args.port ?? server?.port ?? DEFAULT_SERVER_PORT
  const hostname = args.hostname ?? server?.hostname ?? (mdns ? "0.0.0.0" : DEFAULT_SERVER_HOST)
  const configCors = server?.cors ?? []
  const argsCors = Array.isArray(args.cors) ? args.cors : args.cors ? [args.cors] : []
  const cors = [...configCors, ...argsCors]

  return { hostname, port, mdns, mdnsDomain, cors }
}
