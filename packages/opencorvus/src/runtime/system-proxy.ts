import { execFileSync } from "node:child_process"

type Environment = NodeJS.ProcessEnv

export namespace SystemProxy {
  // HTTP (Hypertext Transfer Protocol), HTTPS (HTTP Secure), SOCKS (Socket
  // Secure), and NO_PROXY are projected into their standard process variables.
  export type Projection = Readonly<{
    source: "windows" | "macos" | "gnome" | "kde"
    http?: string
    https?: string
    all?: string
    noProxy?: string
    pacUrl?: string
  }>

  type Exec = (file: string, args: readonly string[]) => string

  const defaultExec: Exec = (file, args) =>
    execFileSync(file, [...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2_000,
    }).toString()

  function proxyUrl(raw: string, scheme = "http") {
    const value = raw.trim()
    if (!value) return undefined
    return value.includes("://") ? value : `${scheme}://${value}`
  }

  function hostPort(host: string | undefined, port: string | undefined, scheme = "http") {
    const normalizedHost = host?.trim()
    const normalizedPort = port?.trim()
    if (!normalizedHost || !normalizedPort || !/^\d+$/.test(normalizedPort)) return undefined
    return proxyUrl(`${normalizedHost}:${normalizedPort}`, scheme)
  }

  function expandLocalBypass(values: readonly string[]) {
    const result: string[] = []
    for (const value of values.map((item) => item.trim()).filter(Boolean)) {
      if (value === "<local>") result.push("localhost", "127.0.0.1", "::1", "*.local")
      else result.push(value)
    }
    return [...new Set(result)].join(",") || undefined
  }

  function firstEnvironmentValue(env: Environment, names: readonly string[]) {
    for (const name of names) {
      const value = env[name]?.trim()
      if (value) return value
    }
    return undefined
  }

  function writeEnvironmentValue(env: Environment, name: string, value: string) {
    env[name] = value
    const descriptor = Object.getOwnPropertyDescriptor(env, name)
    if (descriptor?.configurable && descriptor.enumerable === false) {
      Object.defineProperty(env, name, {
        value: env[name],
        writable: true,
        enumerable: true,
        configurable: true,
      })
    }
  }

  function setMissingEnvironmentValue(env: Environment, names: readonly string[], value: string | undefined) {
    const explicit = firstEnvironmentValue(env, names)
    if (explicit) {
      writeEnvironmentValue(env, names[0]!, explicit)
      return
    }
    if (!value) return
    writeEnvironmentValue(env, names[0]!, value)
  }

  export function apply(env: Environment, projection: Projection | undefined) {
    if (!projection) return
    setMissingEnvironmentValue(env, ["HTTP_PROXY", "http_proxy"], projection.http)
    setMissingEnvironmentValue(env, ["HTTPS_PROXY", "https_proxy"], projection.https ?? projection.http)
    setMissingEnvironmentValue(env, ["ALL_PROXY", "all_proxy"], projection.all)
    setMissingEnvironmentValue(env, ["NO_PROXY", "no_proxy"], projection.noProxy)
  }

  export function parseWindowsRegistry(output: string): Projection | undefined {
    const grab = (name: string, type: string) => {
      const match = new RegExp(`^\\s*${name}\\s+${type}\\s+(.*?)\\s*$`, "mi").exec(output)
      return match?.[1]?.trim() ?? ""
    }
    const enabledRaw = grab("ProxyEnable", "REG_DWORD")
    const enabled = enabledRaw ? Number.parseInt(enabledRaw, 16) !== 0 : false
    const proxyServer = grab("ProxyServer", "REG_SZ")
    const pacUrl = grab("AutoConfigURL", "REG_SZ") || undefined
    if (!enabled || !proxyServer) return pacUrl ? { source: "windows", pacUrl } : undefined

    let http: string | undefined
    let https: string | undefined
    let all: string | undefined
    if (proxyServer.includes("=")) {
      for (const part of proxyServer.split(";")) {
        const separator = part.indexOf("=")
        if (separator <= 0) continue
        const protocol = part.slice(0, separator).trim().toLowerCase()
        const address = part.slice(separator + 1).trim()
        if (protocol === "http") http = proxyUrl(address)
        if (protocol === "https") https = proxyUrl(address)
        if (protocol === "socks") all = proxyUrl(address, "socks5")
      }
    } else {
      http = proxyUrl(proxyServer)
      https = http
    }

    return {
      source: "windows",
      http,
      https: https ?? http,
      all,
      noProxy: expandLocalBypass(grab("ProxyOverride", "REG_SZ").split(";")),
      pacUrl,
    }
  }

  export function parseMacScutil(output: string): Projection | undefined {
    const values = new Map<string, string>()
    const exceptions: string[] = []
    let inExceptions = false
    for (const line of output.split(/\r?\n/)) {
      if (/^\s*ExceptionsList\s*:\s*<array>\s*\{/.test(line)) {
        inExceptions = true
        continue
      }
      if (inExceptions) {
        const item = /^\s*\d+\s*:\s*(.*?)\s*$/.exec(line)
        if (item?.[1]) {
          exceptions.push(item[1])
          continue
        }
        if (/^\s*}/.test(line)) inExceptions = false
        continue
      }
      const scalar = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*(.*?)\s*$/.exec(line)
      if (scalar?.[1] && scalar[2] !== undefined) values.set(scalar[1], scalar[2])
    }

    const http =
      values.get("HTTPEnable") === "1" ? hostPort(values.get("HTTPProxy"), values.get("HTTPPort")) : undefined
    const https =
      values.get("HTTPSEnable") === "1" ? hostPort(values.get("HTTPSProxy"), values.get("HTTPSPort")) : undefined
    const all =
      values.get("SOCKSEnable") === "1"
        ? hostPort(values.get("SOCKSProxy"), values.get("SOCKSPort"), "socks5")
        : undefined
    const pacUrl = values.get("ProxyAutoConfigEnable") === "1" ? values.get("ProxyAutoConfigURLString") : undefined
    if (!http && !https && !all) return pacUrl ? { source: "macos", pacUrl } : undefined
    return {
      source: "macos",
      http,
      https: https ?? http,
      all,
      noProxy: expandLocalBypass(exceptions),
      pacUrl,
    }
  }

  function gvariantString(raw: string | undefined) {
    const value = raw?.trim()
    if (!value) return undefined
    const quoted = /^'(.*)'$/.exec(value)
    return quoted ? quoted[1]?.replaceAll("\\'", "'") : value
  }

  function gvariantList(raw: string | undefined) {
    const value = raw?.trim()
    if (!value?.startsWith("[") || !value.endsWith("]")) return []
    return [...value.matchAll(/'((?:\\'|[^'])*)'/g)].map((match) => match[1]!.replaceAll("\\'", "'"))
  }

  export function parseGnomeSettings(output: string): Projection | undefined {
    const values = new Map<string, string>()
    for (const line of output.split(/\r?\n/)) {
      const row = /^org\.gnome\.system\.proxy(?:\.([a-z]+))?\s+([a-z-]+)\s+(.+)$/.exec(line.trim())
      if (!row?.[2] || row[3] === undefined) continue
      values.set(`${row[1] ?? "root"}.${row[2]}`, row[3])
    }
    const mode = gvariantString(values.get("root.mode"))
    const pacUrl = mode === "auto" ? gvariantString(values.get("root.autoconfig-url")) : undefined
    if (mode !== "manual") return pacUrl ? { source: "gnome", pacUrl } : undefined

    const endpoint = (protocol: "http" | "https" | "socks", scheme = "http") =>
      hostPort(gvariantString(values.get(`${protocol}.host`)), values.get(`${protocol}.port`), scheme)
    const http = endpoint("http")
    const sameProxy = values.get("root.use-same-proxy")?.trim() === "true"
    return {
      source: "gnome",
      http,
      https: sameProxy ? http : (endpoint("https") ?? http),
      all: endpoint("socks", "socks5"),
      noProxy: expandLocalBypass(gvariantList(values.get("root.ignore-hosts"))),
    }
  }

  function normalizeKdeProxy(raw: string | undefined, scheme = "http") {
    const value = raw?.trim()
    if (!value) return undefined
    const separatedPort = /^(.*\S)\s+(\d+)$/.exec(value)
    return proxyUrl(separatedPort ? `${separatedPort[1]}:${separatedPort[2]}` : value, scheme)
  }

  export function parseKdeSettings(values: Readonly<Record<string, string>>): Projection | undefined {
    const proxyType = Number.parseInt(values.ProxyType ?? "0", 10)
    const pacUrl = proxyType === 2 ? values.ProxyConfigScript?.trim() || undefined : undefined
    if (proxyType !== 1) return pacUrl ? { source: "kde", pacUrl } : undefined
    const http = normalizeKdeProxy(values.httpProxy)
    return {
      source: "kde",
      http,
      https: normalizeKdeProxy(values.httpsProxy) ?? http,
      all: normalizeKdeProxy(values.socksProxy, "socks5"),
      noProxy: expandLocalBypass((values.NoProxyFor ?? "").split(/[;,]/)),
    }
  }

  function readKdeSettings(exec: Exec, env: Environment) {
    const command = env.KDE_SESSION_VERSION === "5" ? "kreadconfig5" : "kreadconfig6"
    const read = (key: string) =>
      exec(command, ["--file", "kioslaverc", "--group", "Proxy Settings", "--key", key]).trim()
    return parseKdeSettings({
      ProxyType: read("ProxyType"),
      httpProxy: read("httpProxy"),
      httpsProxy: read("httpsProxy"),
      socksProxy: read("socksProxy"),
      NoProxyFor: read("NoProxyFor"),
      ProxyConfigScript: read("Proxy Config Script"),
    })
  }

  export function discover(input?: { platform?: NodeJS.Platform; env?: Environment; exec?: Exec }) {
    const platform = input?.platform ?? process.platform
    const env = input?.env ?? process.env
    const exec = input?.exec ?? defaultExec
    if (platform === "win32") {
      return parseWindowsRegistry(
        exec("reg.exe", ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"]),
      )
    }
    if (platform === "darwin") return parseMacScutil(exec("scutil", ["--proxy"]))
    if (platform !== "linux") return undefined

    // XDG (X Desktop Group) identifies the selected Linux desktop. GNOME
    // (GNU Network Object Model Environment) and KDE (K Desktop Environment)
    // expose different canonical proxy stores.
    const desktops = `${env.XDG_CURRENT_DESKTOP ?? ""};${env.DESKTOP_SESSION ?? ""}`
      .toLowerCase()
      .split(/[;:]/)
      .map((value) => value.trim())
      .filter(Boolean)
    if (desktops.some((desktop) => /^(gnome|unity|cinnamon)/.test(desktop))) {
      return parseGnomeSettings(
        [
          "org.gnome.system.proxy",
          "org.gnome.system.proxy.http",
          "org.gnome.system.proxy.https",
          "org.gnome.system.proxy.socks",
        ]
          .map((schema) => exec("gsettings", ["list-recursively", schema]))
          .join("\n"),
      )
    }
    if (desktops.some((desktop) => desktop === "kde" || desktop.startsWith("plasma"))) {
      return readKdeSettings(exec, env)
    }
    return undefined
  }

  export function install(input?: { platform?: NodeJS.Platform; env?: Environment; exec?: Exec }) {
    const env = input?.env ?? process.env
    const projection = discover({ ...input, env })
    apply(env, projection)
    return projection
  }
}
