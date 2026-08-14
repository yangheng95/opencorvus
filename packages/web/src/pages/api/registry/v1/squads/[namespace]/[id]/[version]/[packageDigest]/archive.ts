import type { APIRoute } from "astro"
import { getWebsiteRegistry } from "../../../../../../../../../lib/website-registry"

export const prerender = false

export const GET: APIRoute = async ({ params }) => {
  const registry = await getWebsiteRegistry()
  const descriptor = registry.archive(params.namespace ?? "", params.id ?? "", params.version ?? "", params.packageDigest ?? "")
  if (!descriptor) {
    return Response.json({ error: { code: "registry_revision_not_found", message: "The exact immutable revision is not part of the active publication." } }, { status: 404, headers: { "cache-control": "no-store" } })
  }
  try {
    const file = await registry.verifiedArchive(descriptor, true)
    return new Response(Bun.file(file).stream(), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-length": String(descriptor.bytes),
        "content-disposition": `attachment; filename="${descriptor.filename.replaceAll('"', '')}"`,
        "cache-control": "public, max-age=31536000, immutable",
        etag: `"${descriptor.sha256}"`,
        "x-content-type-options": "nosniff",
        "x-opencorvus-archive-sha256": descriptor.sha256,
      },
    })
  } catch (error) {
    return Response.json(
      { error: { code: "registry_archive_integrity_failure", message: "The archive failed integrity verification before the response started." } },
      { status: 503, headers: { "cache-control": "no-store" } },
    )
  }
}
