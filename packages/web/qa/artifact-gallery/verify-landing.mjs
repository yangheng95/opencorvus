import { chromium } from "playwright"
import os from "node:os"; import path from "node:path"; import fs from "node:fs"
const root = path.join(os.homedir(), "AppData/Local/ms-playwright")
const build = fs.readdirSync(root).filter(d=>/^chromium-\d+$/.test(d)).sort((a,b)=>Number(b.split("-")[1])-Number(a.split("-")[1]))[0]
const browser = await chromium.launch({ headless: true, executablePath: path.join(root, build, "chrome-win64/chrome.exe") })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 })
const errors = []
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)) })
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)))
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().slice(0, 120)}`) })
await page.goto("http://127.0.0.1:4331/", { waitUntil: "networkidle", timeout: 60000 })
await page.locator(".oc-showcase").scrollIntoViewIfNeeded()
await page.waitForTimeout(2500)
console.log("slides:", await page.locator(".oc-showcase-slide").count())
console.log("dots:", await page.locator(".oc-showcase-dot").count())
console.log("images loaded:", await page.evaluate(() => [...document.querySelectorAll(".oc-showcase-media img")].filter(i=>i.naturalWidth>0).length))
await page.screenshot({ path: "D:/myhexin-local/opencorvus/tmp/shots/landing-carousel.png" })
await page.locator("[data-oc-carousel-next]").click()
await page.waitForTimeout(1800)
await page.screenshot({ path: "D:/myhexin-local/opencorvus/tmp/shots/landing-carousel-next.png" })
console.log("current dot:", await page.evaluate(() => [...document.querySelectorAll(".oc-showcase-dot")].findIndex(d=>d.getAttribute("aria-current")==="true")))
console.log("console errors:", errors.slice(0,5))

// The frames are light-theme captures, so the dark page is the one worth a second look.
const dark = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2, colorScheme: "dark" })
await dark.goto("http://127.0.0.1:4331/", { waitUntil: "networkidle", timeout: 60000 })
await dark.evaluate(() => window.scrollTo(0, 0))
await dark.waitForTimeout(1500)
await dark.screenshot({ path: "D:/myhexin-local/opencorvus/tmp/shots/landing-top-dark.png" })
await dark.locator(".oc-showcase").scrollIntoViewIfNeeded()
await dark.waitForTimeout(2500)
await dark.screenshot({ path: "D:/myhexin-local/opencorvus/tmp/shots/landing-carousel-dark.png" })
await browser.close()
