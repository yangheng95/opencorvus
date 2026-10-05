import { validator as openapiValidator } from "hono-openapi"
import { badRequestBody } from "./error"

export function validator<
  Target extends Parameters<typeof openapiValidator>[0],
  Schema extends Parameters<typeof openapiValidator>[1],
>(target: Target, schema: Schema) {
  return openapiValidator(target, schema, (result, c) => {
    if (!result.success) return c.json(badRequestBody("Request validation failed", result.error), 400)
  })
}
