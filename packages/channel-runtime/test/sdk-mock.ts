async function* emptyStream() {}

function createNoopClient() {
  return {
    auth: {
      set: async () => ({ data: {}, error: undefined }),
    },
    channel: {
      message: async () => ({
        data: {
          kind: "message" as const,
          message: "",
        },
        error: undefined,
      }),
    },
    event: {
      subscribe: async () => ({
        stream: emptyStream(),
      }),
    },
    permission: {
      reply: async () => ({ data: {}, error: undefined }),
    },
    task: {
      bindings: async () => ({ data: [], error: undefined }),
    },
    session: {
      create: async () => ({ data: { id: "session_mock" }, error: undefined }),
      get: async () => ({ data: undefined, error: undefined }),
      message: async () => ({ data: { parts: [] }, error: undefined }),
      promptAsync: async () => ({ data: { taskID: "task_mock" }, error: undefined }),
      promptAsyncStatus: async () => ({
        data: {
          taskID: "task_mock",
          sessionID: "session_mock",
          status: "completed" as const,
          retryCount: 0,
          maxRetries: 0,
          source: "test",
          prompt: "",
          error: null,
          startedAt: 1,
          completedAt: 2,
          updatedAt: 2,
        },
        error: undefined,
      }),
    },
  }
}

function createNoopServer() {
  return {
    url: "http://127.0.0.1:0",
    close() {},
  }
}

export class OpenCorvusClientMock {
  auth = createNoopClient().auth
  channel = createNoopClient().channel
  event = createNoopClient().event
  permission = createNoopClient().permission
  task = createNoopClient().task
  session = createNoopClient().session
}

export const OpencodeClientMock = OpenCorvusClientMock

export const sdkMock = {
  createOpenCorvus: async () => ({
    client: createNoopClient(),
    server: createNoopServer(),
  }),
  createOpencode: async () => ({
    client: createNoopClient(),
    server: createNoopServer(),
  }),
  createOpenCorvusClient: () => createNoopClient(),
  createOpencodeClient: () => createNoopClient(),
  createOpenCorvusServer: async () => createNoopServer(),
  createOpencodeServer: async () => createNoopServer(),
  OpenCorvusClient: OpenCorvusClientMock,
  OpencodeClient: OpencodeClientMock,
}
