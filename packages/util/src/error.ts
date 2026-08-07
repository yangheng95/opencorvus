import z from "zod"

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export abstract class NamedError extends Error {
  abstract schema(): z.core.$ZodType
  abstract toObject(): { name: string; data: any }

  static create<Name extends string, Data extends z.core.$ZodType>(name: Name, data: Data) {
    const schema = z
      .object({
        name: z.literal(name),
        data,
      })
      .meta({
        ref: name,
      })
    const result = class extends NamedError {
      public static readonly Schema = schema

      public override readonly name = name as Name

      constructor(
        public readonly data: z.input<Data>,
        options?: ErrorOptions,
      ) {
        // `Error.message` is the only thing that survives most generic
        // serialization paths (`String(err)`, `err.message`, AI-SDK tool
        // error envelopes, JSON.stringify of plain Error). Folding the
        // structured `data` into the message keeps a single source of truth
        // (rule 7/8): consumers don't need to know about `.data` to see
        // the real diagnostic, and we don't need a parallel extraction path
        // at every error site. We prefer `data.message` when present
        // because that's the canonical field across our error schemas;
        // otherwise we serialize the entire data payload.
        const detail =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message: unknown }).message === "string"
            ? (data as { message: string }).message
            : data !== undefined
              ? safeStringify(data)
              : ""
        super(detail ? `${name}: ${detail}` : name, options)
        this.name = name
      }

      static isInstance(input: any): input is InstanceType<typeof result> {
        return typeof input === "object" && "name" in input && input.name === name
      }

      schema() {
        return schema
      }

      toObject() {
        return {
          name: name,
          data: this.data,
        }
      }
    }
    Object.defineProperty(result, "name", { value: name })
    return result
  }

  public static readonly Unknown = NamedError.create(
    "UnknownError",
    z.object({
      message: z.string(),
    }),
  )
}
