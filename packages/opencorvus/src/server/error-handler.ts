import { NamedError } from "@opencorvus-ai/util/error"
import { HTTPException } from "hono/http-exception"
import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { Log } from "../util/log"
import { Database, NotFoundError } from "../storage/db"
import { badRequestBody } from "./error"

const log = Log.create({ service: "server" })
const requestIDs = new WeakMap<object, string>()
const REQUEST_ID_CONTEXT_KEY = "opencorvusRequestID"
const PUBLIC_UNKNOWN_ERROR_MESSAGE = "Internal server error. See x-opencorvus-request-id for diagnostics."

type NamedErrorLike = Error & {
  name: string
  toObject(): { name: string; data: unknown }
}

function isNamedErrorLike(err: unknown): err is NamedErrorLike {
  if (err instanceof NamedError) return true
  if (!err || typeof err !== "object") return false
  const candidate = err as { name?: unknown; toObject?: unknown }
  return typeof candidate.name === "string" && typeof candidate.toObject === "function"
}

export function requestID(c: { req: { header(name: string): string | undefined }; res: Response }) {
  const honoContext = c as typeof c & {
    get?(key: string): unknown
    set?(key: string, value: string): void
  }
  const contextValue = honoContext.get?.(REQUEST_ID_CONTEXT_KEY)
  if (typeof contextValue === "string" && contextValue) return contextValue
  const requestContext = (c.req as typeof c.req & { raw?: object }).raw ?? (c as object)
  const existing = requestIDs.get(requestContext)
  if (existing) return existing
  const id = crypto.randomUUID()
  requestIDs.set(requestContext, id)
  honoContext.set?.(REQUEST_ID_CONTEXT_KEY, id)
  return id
}

export function namedErrorStatus(err: { name: string }): ContentfulStatusCode {
  if (err.name === "NotFoundError") return 404
  if (err.name === "WorktreeOwnershipObservationError") return 503
  if (err.name === "DatabaseUnavailableError") return 503
  if (err.name === "AuthReadError") return 503
  if (err.name === "LogFileNotFoundError") return 404
  if (err.name === "ProviderModelNotFoundError") return 400
  if (err.name === "DirectoryRequiredError") return 400
  if (err.name === "RequestOriginForbiddenError") return 403
  if (err.name === "InvalidInitGitParameterError") return 400
  if (err.name === "OwnedPromptControllersError") return 409
  if (err.name === "AnonymousProjectPromotionError") return 400
  if (err.name === "InvalidDirectoryError") return 400
  if (err.name === "ProjectDirectoryIntegrityError") return 400
  if (err.name === "ProjectRegisteredDirectoryConflictError") return 409
  if (err.name === "ProjectDuplicateWorktreeIdentityError") return 409
  if (err.name === "ProjectDurableAdmissionClosedError") return 409
  if (err.name === "ProjectDeletePendingError") return 409
  if (err.name === "ProjectDeletionCleanupDatabaseMismatchError") return 409
  if (err.name === "ChildSessionConfigError") return 400
  if (err.name === "WorktreeNotGitError") return 412
  if (err.name === "VcsPrerequisiteError") return 412
  if (err.name.startsWith("Worktree")) return 400
  if (err.name === "OperatorSteerTargetError") return 400
  if (err.name === "SessionRuntimeContractMissingError") return 410
  if (err.name === "TaskEmptyMessageError") return 400
  if (err.name === "ExternalChildTaskLineageError") return 400
  if (err.name === "TaskCreatorAuthorityError") return 400
  if (err.name === "TaskCreatorSessionError") return 400
  if (err.name === "TaskGlobalProjectBindingError") return 409
  if (err.name === "TaskChannelBindingProjectConflictError") return 409
  if (err.name === "TaskCancellationIncompleteError") return 409
  if (err.name === "MissionExecutionClosingError") return 409
  if (err.name === "TaskBoundSessionDeletionError") return 409
  if (err.name === "TaskPackageRevisionBindingError") return 409
  if (err.name === "TaskExpectedPackageDigestConflictError") return 409
  if (err.name === "TaskCreationIdempotencyConflictError") return 409
  if (err.name === "TaskPromptProfileImmutableError") return 409
  if (err.name === "TaskControlIntentLifecycleConflictError") return 409
  if (err.name === "MissingModelConfigError") return 400
  if (err.name === "NonCanonicalConfigFileError") return 409
  if (err.name === "PtyCreateFailedError") return 400
  if (err.name === "FileUploadConflictError") return 409
  if (err.name.startsWith("FileUpload")) return 400
  if (err.name === "FileNotFoundError") return 404
  if (err.name === "FileConflictError") return 409
  if (err.name === "AutomationRunningConflictError") return 409
  if (err.name === "InvalidAutomationRecurrenceError") return 400
  if (err.name === "FileInvalidPathError") return 400
  if (err.name === "PluginServiceNotFoundError") return 404
  if (err.name === "PluginServiceRegistrationError") return 500
  if (err.name === "PluginServiceDuplicateIDError") return 500
  if (err.name === "MCPOAuthStateError") return 400
  if (err.name === "McpAppHostForbiddenError") return 403
  if (err.name === "ExpertSquadPackageError") return 400
  if (err.name === "ExpertSquadPackageMutationConflictError") return 409
  return 500
}

export function serverErrorResponse(err: Error | unknown, c: Context): Response | Promise<Response> {
  const id = requestID(c)
  c.header("x-opencorvus-request-id", id)
  const normalized = Database.normalizeError(err, `HTTP ${c.req.method} ${c.req.path}`)
  const namedError = isNamedErrorLike(normalized)
  const status = namedError
    ? namedErrorStatus(normalized)
    : normalized instanceof HTTPException
      ? normalized.status
      : 500
  log.error("request failed", {
    requestID: id,
    method: c.req.method,
    path: c.req.path,
    statusCode: status,
    error: normalized,
  })
  if (namedError) {
    if (normalized.name === "UnknownError") {
      return c.json(new NamedError.Unknown({ message: publicUnknownErrorMessage() }).toObject(), { status })
    }
    return c.json(normalized.toObject(), { status })
  }
  if (normalized instanceof HTTPException) {
    const message = normalized.message
    if (normalized.status === 400) {
      return c.json(badRequestBody(message), { status: 400 })
    }
    if (normalized.status === 404) {
      return c.json(new NotFoundError({ message }).toObject(), { status: 404 })
    }
    return c.json(new NamedError.Unknown({ message }).toObject(), { status })
  }
  return c.json(new NamedError.Unknown({ message: publicUnknownErrorMessage() }).toObject(), {
    status: 500,
  })
}

export function publicUnknownErrorMessage(): string {
  return PUBLIC_UNKNOWN_ERROR_MESSAGE
}

export function publicUnknownStreamError() {
  return { type: "error" as const, message: publicUnknownErrorMessage() }
}
