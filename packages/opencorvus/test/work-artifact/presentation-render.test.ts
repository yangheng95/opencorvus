import { expect, test } from "bun:test"
import sharp from "sharp"
import { renderWorkArtifactSvgToPng } from "../../src/work-artifact/presentation"

test("OfficeCLI XHTML text is rasterized into the presentation review image", async () => {
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      <rect width="1920" height="1080" fill="#ffffff"/>
      <foreignObject x="120" y="120" width="1200" height="240">
        <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;height:100%;justify-content:center">
          <div style="text-align:center"><span style="font-family:Arial;font-size:32pt;color:#000000;font-weight:bold">Qualified evidence</span></div>
        </div>
      </foreignObject>
    </svg>
  `)

  const png = await renderWorkArtifactSvgToPng({ svg, timeoutMs: 30_000 })
  const image = sharp(png)
  await expect(image.metadata()).resolves.toMatchObject({ width: 1280, height: 720, format: "png" })
  const stats = await image.extract({ left: 80, top: 80, width: 800, height: 160 }).stats()
  expect(Math.min(...stats.channels.slice(0, 3).map((channel) => channel.min))).toBeLessThan(64)
})

test("OfficeCLI XHTML text geometry is bounded before native image allocation", async () => {
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      <rect width="1920" height="1080" fill="#ffffff"/>
      <foreignObject x="0" y="0" width="999999999" height="999999999">
        <div xmlns="http://www.w3.org/1999/xhtml"><div><span>Bounded</span></div></div>
      </foreignObject>
    </svg>
  `)

  await expect(renderWorkArtifactSvgToPng({ svg, timeoutMs: 30_000 })).rejects.toThrow(
    "Work Artifact SVG could not be converted safely",
  )
})

test("OfficeCLI XHTML text volume is bounded before native text rasterization", async () => {
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      <rect width="1920" height="1080" fill="#ffffff"/>
      <foreignObject x="0" y="0" width="20" height="20">
        <div xmlns="http://www.w3.org/1999/xhtml"><div><span>${"x".repeat(200_001)}</span></div></div>
      </foreignObject>
    </svg>
  `)

  await expect(renderWorkArtifactSvgToPng({ svg, timeoutMs: 30_000 })).rejects.toThrow(
    "Work Artifact SVG could not be converted safely",
  )
})

test("OfficeCLI XHTML font size remains stable across text-box heights", async () => {
  const render = (height: number) =>
    renderWorkArtifactSvgToPng({
      timeoutMs: 30_000,
      svg: Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
          <rect width="1920" height="1080" fill="#ffffff"/>
          <foreignObject x="120" y="120" width="1200" height="${height}">
            <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;height:100%;justify-content:center">
              <div style="text-align:center"><span style="font-family:Arial;font-size:32pt;color:#000000;font-weight:bold">M</span></div>
            </div>
          </foreignObject>
        </svg>
      `),
    })
  const darkPixels = async (png: Buffer) => {
    const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let count = 0
    for (let offset = 0; offset < data.length; offset += 3) {
      if (data[offset]! < 128 && data[offset + 1]! < 128 && data[offset + 2]! < 128) count++
    }
    return count
  }

  expect(await darkPixels(await render(120))).toBe(await darkPixels(await render(480)))
})

test("OfficeCLI mixed-span raster budget uses the largest declared font", async () => {
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
      <rect width="1920" height="1080" fill="#ffffff"/>
      <foreignObject x="0" y="0" width="1920" height="1080">
        <div xmlns="http://www.w3.org/1999/xhtml"><div>
          <span style="font-size:96pt">${"x".repeat(50_000)}</span><span style="font-size:4pt">tail</span>
        </div></div>
      </foreignObject>
    </svg>
  `)

  await expect(renderWorkArtifactSvgToPng({ svg, timeoutMs: 30_000 })).rejects.toThrow(
    "Work Artifact SVG could not be converted safely",
  )
})
