import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { basename, resolve } from "node:path"
import sharp from "sharp"

const editPlanPath = process.env.OPENCORVUS_CLIENT_EDIT_PLAN
const outputDirectory = process.env.OPENCORVUS_CLIENT_EDIT_OUTPUT

if (!editPlanPath || !existsSync(editPlanPath)) {
  throw new Error("OPENCORVUS_CLIENT_EDIT_PLAN must name a real JSON edit plan")
}
if (!outputDirectory) {
  throw new Error("OPENCORVUS_CLIENT_EDIT_OUTPUT must name the curated-frame directory")
}

const editPlan = JSON.parse(readFileSync(editPlanPath, "utf8").replace(/^\uFEFF/, ""))
const width = Number(editPlan.width)
const height = Number(editPlan.height)
const playbackFramesPerSecond = Number(editPlan.playbackFramesPerSecond)
const defaultMaximumStillFrames = Number(editPlan.maximumStillFrames || playbackFramesPerSecond)
const defaultMinimumVisualDifference = Number(editPlan.minimumVisualDifference || 0.8)

if (
  !Number.isInteger(width) ||
  !Number.isInteger(height) ||
  width * 9 !== height * 16 ||
  !Number.isFinite(playbackFramesPerSecond) ||
  playbackFramesPerSecond <= 0 ||
  !Number.isInteger(defaultMaximumStillFrames) ||
  defaultMaximumStillFrames <= 0 ||
  !Number.isFinite(defaultMinimumVisualDifference) ||
  defaultMinimumVisualDifference <= 0 ||
  !String(editPlan.taskId || "").startsWith("tsk_") ||
  !Array.isArray(editPlan.segments) ||
  editPlan.segments.length === 0
) {
  throw new Error("Edit plan must define a 16:9 frame, playback rate, real Task ID, and segments")
}

const resolvedOutput = resolve(outputDirectory)
mkdirSync(resolvedOutput, { recursive: true })
const existingFrames = readdirSync(resolvedOutput).filter((name) => /^frame-\d{5}\.png$/.test(name))
if (existingFrames.length > 0) {
  throw new Error(`Curated output already contains frames: ${resolvedOutput}`)
}

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")

const overlayBuffer = ({ eyebrow, title, subtitle }) =>
  Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="panel" x1="0" x2="1">
          <stop offset="0" stop-color="#111820" stop-opacity="0.96"/>
          <stop offset="1" stop-color="#111820" stop-opacity="0.76"/>
        </linearGradient>
      </defs>
      <rect x="96" y="${height - 336}" width="${width - 192}" height="236" rx="34" fill="url(#panel)" stroke="#2fbb90" stroke-width="3"/>
      <rect x="132" y="${height - 292}" width="10" height="148" rx="5" fill="#2fbb90"/>
      <text x="176" y="${height - 266}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="30" font-weight="700" fill="#54d7ab" letter-spacing="3">${escapeXml(eyebrow)}</text>
      <text x="176" y="${height - 198}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="54" font-weight="700" fill="#ffffff">${escapeXml(title)}</text>
      <text x="176" y="${height - 142}" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="28" fill="#c9d1dc">${escapeXml(subtitle)}</text>
    </svg>
  `)

const sourceFramePath = (directory, index) => resolve(directory, `frame-${String(index).padStart(5, "0")}.png`)

const visualSignature = (source) => sharp(source).resize(64, 36, { fit: "fill" }).grayscale().raw().toBuffer()

const visualDifference = (left, right) => {
  let totalDifference = 0
  for (let index = 0; index < left.length; index += 1) {
    totalDifference += Math.abs(left[index] - right[index])
  }
  return totalDifference / left.length
}

let outputIndex = 0
let previousOutputPath = null
const sourceEvidence = []

const writeFrame = async (source, overlay) => {
  if (!existsSync(source)) throw new Error(`Edit source frame does not exist: ${source}`)
  const output = resolve(resolvedOutput, `frame-${String(outputIndex).padStart(5, "0")}.png`)
  if (overlay) {
    await sharp(source)
      .resize(width, height, { fit: "fill" })
      .composite([{ input: overlayBuffer(overlay) }])
      .png()
      .toFile(output)
  } else {
    copyFileSync(source, output)
  }
  previousOutputPath = output
  outputIndex += 1
}

for (const [segmentIndex, segment] of editPlan.segments.entries()) {
  const sourceDirectory = resolve(segment.sourceDirectory)
  if (!existsSync(sourceDirectory)) {
    throw new Error(`Segment ${segmentIndex} source directory does not exist: ${sourceDirectory}`)
  }

  if (segment.kind === "hold") {
    const frameIndex = Number(segment.frameIndex)
    const outputFrames = Number(segment.outputFrames)
    const transitionFrames = Number(segment.transitionFrames || 0)
    if (
      !Number.isInteger(frameIndex) ||
      !Number.isInteger(outputFrames) ||
      outputFrames <= 0 ||
      !Number.isInteger(transitionFrames) ||
      transitionFrames < 0 ||
      transitionFrames > outputFrames ||
      !segment.overlay
    ) {
      throw new Error(`Hold segment ${segmentIndex} must define frameIndex, outputFrames, and overlay`)
    }
    const source = sourceFramePath(sourceDirectory, frameIndex)
    const transitionSourcePath = previousOutputPath
    for (let index = 0; index < outputFrames; index += 1) {
      const progress = outputFrames === 1 ? 0 : index / (outputFrames - 1)
      const zoom = 1 + progress * 0.04
      const renderWidth = Math.ceil(width * zoom)
      const renderHeight = Math.ceil(height * zoom)
      const maximumLeft = renderWidth - width
      const maximumTop = renderHeight - height
      const output = resolve(resolvedOutput, `frame-${String(outputIndex).padStart(5, "0")}.png`)
      const currentFrame = await sharp(source)
        .resize(renderWidth, renderHeight, { fit: "fill" })
        .extract({
          left: Math.round(maximumLeft * progress * 0.62),
          top: Math.round(maximumTop * progress * 0.38),
          width,
          height,
        })
        .composite([{ input: overlayBuffer(segment.overlay) }])
        .png()
        .toBuffer()
      if (transitionSourcePath && index < transitionFrames) {
        const opacity = (index + 1) / (transitionFrames + 1)
        const fadedCurrentFrame = await sharp(currentFrame)
          .ensureAlpha()
          .linear([1, 1, 1, opacity], [0, 0, 0, 0])
          .png()
          .toBuffer()
        await sharp(transitionSourcePath)
          .ensureAlpha()
          .composite([{ input: fadedCurrentFrame }])
          .png()
          .toFile(output)
      } else {
        writeFileSync(output, currentFrame)
      }
      previousOutputPath = output
      outputIndex += 1
    }
    sourceEvidence.push({
      kind: "hold",
      directory: basename(sourceDirectory),
      frameIndex,
      outputFrames,
      transitionFrames,
      overlay: segment.overlay,
    })
    continue
  }

  if (segment.kind !== "range") throw new Error(`Unsupported segment kind at ${segmentIndex}: ${segment.kind}`)
  const start = Number(segment.start)
  const end = Number(segment.end)
  const step = Number(segment.step)
  const overlayFrames = Number(segment.overlayFrames || 0)
  const maximumStillFrames = Number(segment.maximumStillFrames || defaultMaximumStillFrames)
  const minimumVisualDifference = Number(segment.minimumVisualDifference || defaultMinimumVisualDifference)
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    !Number.isInteger(step) ||
    start < 0 ||
    end < start ||
    step <= 0 ||
    !Number.isInteger(overlayFrames) ||
    overlayFrames < 0 ||
    !Number.isInteger(maximumStillFrames) ||
    maximumStillFrames <= 0 ||
    !Number.isFinite(minimumVisualDifference) ||
    minimumVisualDifference <= 0 ||
    (overlayFrames > 0 && !segment.overlay)
  ) {
    throw new Error(`Range segment ${segmentIndex} is invalid`)
  }

  let segmentOutputIndex = 0
  let stillFrameCount = 0
  let sceneSignature = null
  let skippedStillFrames = 0
  for (let sourceIndex = start; sourceIndex <= end; sourceIndex += step) {
    const source = sourceFramePath(sourceDirectory, sourceIndex)
    if (!existsSync(source)) throw new Error(`Edit source frame does not exist: ${source}`)
    const signature = await visualSignature(source)
    if (sceneSignature) {
      const difference = visualDifference(sceneSignature, signature)
      if (difference < minimumVisualDifference) {
        stillFrameCount += 1
        if (stillFrameCount >= maximumStillFrames) {
          skippedStillFrames += 1
          continue
        }
      } else {
        sceneSignature = signature
        stillFrameCount = 0
      }
    } else {
      sceneSignature = signature
    }
    await writeFrame(source, segmentOutputIndex < overlayFrames ? segment.overlay : null)
    segmentOutputIndex += 1
  }
  sourceEvidence.push({
    kind: "range",
    directory: basename(sourceDirectory),
    start,
    end,
    step,
    outputFrames: segmentOutputIndex,
    overlayFrames,
    maximumStillFrames,
    minimumVisualDifference,
    skippedStillFrames,
  })
}

const metadata = {
  source: "real-opencorvus-desktop-window",
  application: "OpenCorvus",
  observedWindowTitle: "OpenCorvus",
  captureBounds: "native-client-content-16:9",
  taskId: editPlan.taskId,
  requirement: editPlan.requirement,
  width,
  height,
  clientWidth: width,
  clientHeight: height,
  framesPerSecond: playbackFramesPerSecond,
  playbackFramesPerSecond,
  frameCount: outputIndex,
  capturedDurationSeconds: Number((outputIndex / playbackFramesPerSecond).toFixed(3)),
  edit: {
    chronology: editPlan.chronology,
    sourceEvidence,
  },
}
writeFileSync(resolve(resolvedOutput, "recording.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8")
console.log(JSON.stringify(metadata))
