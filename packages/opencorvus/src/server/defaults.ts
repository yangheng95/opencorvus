import raw from "../../server-defaults.json" with { type: "json" }

export const DEFAULT_SERVER_HOST: string = raw.host
export const DEFAULT_SERVER_PORT: number = raw.port
export const DEFAULT_SERVER_URL: string = `http://${raw.host}:${raw.port}`
