import { resolver } from "hono-openapi"
import z from "zod"
import { NotFoundError } from "../storage/db"

function namedErrorSchema(name: string) {
  return resolver(
    z
      .object({
        name: z.literal(name),
        data: z.record(z.string(), z.any()),
      })
      .meta({ ref: name }),
  )
}

function namedErrorUnionSchema(first: string, ...rest: string[]) {
  const branch = (name: string) =>
    z.object({
      name: z.literal(name),
      data: z.record(z.string(), z.any()),
    })
  if (rest.length === 0) return resolver(branch(first))
  return resolver(z.union([branch(first), ...rest.map(branch)]))
}

const BAD_REQUEST_SCHEMA = z
  .object({
    data: z.any(),
    error: z.array(z.record(z.string(), z.any())),
    success: z.literal(false),
  })
  .meta({ ref: "BadRequestError" })

const WORKTREE_OWNERSHIP_OBSERVATION_SCHEMA = z
  .object({
    name: z.literal("WorktreeOwnershipObservationError"),
    data: z
      .object({
        operation: z.string(),
        code: z.string(),
        scope: z.string(),
        message: z.string(),
      })
      .strict(),
  })
  .strict()
  .meta({ ref: "WorktreeOwnershipObservationError" })

const AUTH_READ_ERROR_SCHEMA = z
  .object({
    name: z.literal("AuthReadError"),
    data: z
      .object({
        operation: z.literal("read_saved_credentials"),
        reason: z.enum(["io", "malformed_json", "invalid_credential"]),
        message: z.string(),
      })
      .strict(),
  })
  .strict()
  .meta({ ref: "AuthReadError" })

export const ERRORS = {
  400: {
    description: "Bad request",
    content: {
      "application/json": {
        schema: resolver(BAD_REQUEST_SCHEMA),
      },
    },
  },
  404: {
    description: "Not found",
    content: {
      "application/json": {
        schema: namedErrorUnionSchema("NotFoundError", "LogFileNotFoundError"),
      },
    },
  },
  409: {
    description: "Conflict",
    content: {
      "application/json": {
        schema: namedErrorUnionSchema("TaskCancellationIncompleteError"),
      },
    },
  },
  410: {
    description: "Session runtime contract no longer present",
    content: {
      "application/json": {
        schema: namedErrorSchema("SessionRuntimeContractMissingError"),
      },
    },
  },
  500: {
    description: "Internal server error",
    content: {
      "application/json": {
        schema: namedErrorSchema("UnknownError"),
      },
    },
  },
  502: {
    description: "Upstream service failure",
    content: {
      "application/json": {
        schema: namedErrorSchema("SkillMarketUpstreamError"),
      },
    },
  },
  503: {
    description: "Required ownership authority could not be observed safely",
    content: {
      "application/json": {
        schema: resolver(WORKTREE_OWNERSHIP_OBSERVATION_SCHEMA),
      },
    },
  },
} as const

export function errors(...codes: number[]) {
  return Object.fromEntries(codes.map((code) => [code, ERRORS[code as keyof typeof ERRORS]]))
}

export function badRequestBody(message: string) {
  return {
    data: { message },
    error: [{ message }],
    success: false as const,
  }
}

export function namedErrorResponse(description: string, first: string, ...rest: string[]) {
  return {
    description,
    content: {
      "application/json": {
        schema: namedErrorUnionSchema(first, ...rest),
      },
    },
  }
}

export function badRequestOrNamedErrorResponse(description: string, first: string, ...rest: string[]) {
  const branch = (name: string) =>
    z.object({
      name: z.literal(name),
      data: z.record(z.string(), z.any()),
    })
  return {
    description,
    content: {
      "application/json": {
        schema: resolver(z.union([BAD_REQUEST_SCHEMA, branch(first), ...rest.map(branch)])),
      },
    },
  }
}

const OPERATOR_STEER_400_RESPONSE = badRequestOrNamedErrorResponse(
  "Operator steer target or request body rejected",
  "OperatorSteerTargetError",
)

export const OwnedPromptControllersResponse = namedErrorResponse(
  "Owned prompt controllers prevent this operation",
  "OwnedPromptControllersError",
)

export const AuthReadUnavailableResponse = {
  description: "Saved Provider credentials could not be observed safely",
  content: {
    "application/json": {
      schema: resolver(AUTH_READ_ERROR_SCHEMA),
    },
  },
} as const

export function operatorSteerRouteErrors(...codes: number[]) {
  return Object.fromEntries(
    codes.map((code) => [code, code === 400 ? OPERATOR_STEER_400_RESPONSE : ERRORS[code as keyof typeof ERRORS]]),
  )
}
