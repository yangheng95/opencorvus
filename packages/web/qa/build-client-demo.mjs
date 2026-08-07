import { spawn } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import sharp from "sharp"

const workspaceRoot = resolve(import.meta.dirname, "../../..")
const output = resolve(workspaceRoot, "packages/web/public/media/opencorvus-client-demo.webm")
const captureDirectory = process.env.OPENCORVUS_CLIENT_CAPTURE_DIRECTORY
const ffmpeg = process.env.OPENCORVUS_FFMPEG_EXECUTABLE

if (!ffmpeg || !existsSync(ffmpeg)) {
  throw new Error("OPENCORVUS_FFMPEG_EXECUTABLE must name the installed Playwright FFmpeg executable")
}
if (!captureDirectory || !existsSync(captureDirectory)) {
  throw new Error("OPENCORVUS_CLIENT_CAPTURE_DIRECTORY must name a real OpenCorvus desktop capture directory")
}

const captureMetadata = JSON.parse(
  readFileSync(resolve(captureDirectory, "recording.json"), "utf8").replace(/^\uFEFF/, ""),
)
if (captureMetadata.source !== "real-opencorvus-desktop-window") {
  throw new Error(`Unsupported recording source: ${String(captureMetadata.source)}`)
}
if (captureMetadata.application !== "OpenCorvus") {
  throw new Error(`Recording must come from the OpenCorvus desktop application, got ${String(captureMetadata.application)}`)
}
if (captureMetadata.captureBounds !== "native-client-content-16:9") {
  throw new Error(`Recording must exclude the native window frame, got ${String(captureMetadata.captureBounds)}`)
}
if (!String(captureMetadata.taskId || "").startsWith("tsk_")) {
  throw new Error("Recording metadata must identify the real OpenCorvus Task")
}

const frameNames = readdirSync(captureDirectory)
  .filter((name) => /^frame-\d{5}\.png$/.test(name))
  .sort()
if (frameNames.length !== captureMetadata.frameCount || frameNames.length < 60) {
  throw new Error(
    `Capture frame inventory does not match metadata: ${frameNames.length}/${String(captureMetadata.frameCount)}`,
  )
}
for (const [index, name] of frameNames.entries()) {
  const expected = `frame-${String(index).padStart(5, "0")}.png`
  if (name !== expected) throw new Error(`Capture frame sequence is not contiguous: expected ${expected}, got ${name}`)
}

const videoWidth = Number(captureMetadata.width) - (Number(captureMetadata.width) % 2)
const videoHeight = Number(captureMetadata.height) - (Number(captureMetadata.height) % 2)
const playbackFramesPerSecond = Number(captureMetadata.playbackFramesPerSecond)
if (
  !Number.isInteger(videoWidth) ||
  !Number.isInteger(videoHeight) ||
  videoWidth * 9 !== videoHeight * 16 ||
  !Number.isFinite(playbackFramesPerSecond) ||
  playbackFramesPerSecond <= 0
) {
  throw new Error("Recording metadata must contain 16:9 video dimensions and a valid playback rate")
}

const capturedFrames = frameNames.map((name) => resolve(captureDirectory, name))

const processHandle = spawn(
  ffmpeg,
  [
    "-y",
    "-f",
    "image2pipe",
    "-c:v",
    "mjpeg",
    "-framerate",
    String(playbackFramesPerSecond),
    "-i",
    "pipe:0",
    "-vf",
    `scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase,crop=${videoWidth}:${videoHeight}`,
    "-an",
    "-r",
    String(playbackFramesPerSecond),
    "-c:v",
    "libvpx",
    "-b:v",
    "1200k",
    "-crf",
    "22",
    "-deadline",
    "good",
    "-pix_fmt",
    "yuv420p",
    output,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
)

processHandle.stdin.on("error", (error) => {
  if (error.code !== "EPIPE") throw error
})

for (const source of capturedFrames) {
  const frame = await sharp(source)
    .resize(videoWidth, videoHeight, { fit: "fill" })
    .jpeg({ quality: 88, chromaSubsampling: "4:2:0" })
    .toBuffer()
  if (!processHandle.stdin.write(frame)) {
    await new Promise((resolveDrain) => processHandle.stdin.once("drain", resolveDrain))
  }
}

processHandle.stdin.end()

await new Promise((resolveProcess, rejectProcess) => {
  processHandle.on("error", rejectProcess)
  processHandle.on("exit", (code) => {
    if (code === 0) resolveProcess()
    else rejectProcess(new Error(`FFmpeg exited with status ${code}`))
  })
})
