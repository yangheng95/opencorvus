import { BrowserRuntime } from "@/browser/runtime"
import { runExplicitBrowserNodeSidecar } from "@/browser/runtime/node-executor"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import z from "zod"
import fs from "node:fs/promises"
import path from "node:path"

// This is a product document renderer. It does not connect to a user browser,
// navigate a website, or run the application's UI acceptance probes.
const renderScript = String.raw`
const { chromium } = require(process.argv[3]);
const fs = require('node:fs/promises');
const path = require('node:path');
const input = JSON.parse(Buffer.from(process.argv[2], 'base64').toString('utf8'));
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: input.executablePath, headless: true,
      args: input.launchArgs, timeout: input.timeoutMs,
      handleSIGHUP: false, handleSIGINT: false, handleSIGTERM: false });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1200 },
      acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => route.abort('blockedbyclient'));
    const page = await context.newPage();
    page.setDefaultTimeout(input.timeoutMs);
    const html = await fs.readFile(input.htmlPath, 'utf8');
    await page.setContent(html, { waitUntil: 'load', timeout: input.timeoutMs });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; } .page { transform: none !important; } .sheet-content { display:block !important; overflow:visible !important; flex:none !important; width:max-content; } .table-wrapper { overflow:visible !important; max-height:none !important; flex:none !important; } .sheet-content caption { position:static; clip:auto; width:auto; height:auto; padding:10px; text-align:left; font-size:16px; font-weight:600; }' });
    const selector = input.format === 'docx' ? '.page' : '.sheet-content';
    const units = page.locator(selector);
    const count = await units.count();
    if (count < 1 || count > input.maxUnits) throw new Error('Office render unit count exceeds profile limits: ' + count);
    const renders = [];
    let outputBytes = 0;
    for (let i = 0; i < count; i++) {
      const unit = units.nth(i);
      const box = await unit.boundingBox();
      if (!box || box.width < 1 || box.height < 1 || box.width > 1600 || box.height > 2400)
        throw new Error('Office render dimensions exceed profile limits for unit ' + (i + 1));
      const name = 'office-unit-' + (i + 1) + '.png';
      const bytes = await unit.screenshot({ type:'png', animations:'disabled', timeout:input.timeoutMs });
      outputBytes += bytes.length;
      if (outputBytes > input.maxBytes) throw new Error('Office render output exceeds profile limits');
      await fs.writeFile(path.join(input.directory, name), bytes, { flag:'wx', mode:0o600 });
      renders.push({ name, width: Math.ceil(box.width), height: Math.ceil(box.height) });
    }
    await page.addStyleTag({content:'@media print { .sheet-content { break-after:page; } .sheet-content:last-child { break-after:auto; } }'});
    const pdf = await page.pdf({ format: input.format === 'docx' ? 'A4' : 'A3',
      landscape:input.format === 'xlsx', printBackground:true, preferCSSPageSize:true });
    outputBytes += pdf.length;
    if (outputBytes > input.maxBytes) throw new Error('Office preview output exceeds profile limits');
    await fs.writeFile(path.join(input.directory, 'office-preview.pdf'), pdf, { flag:'wx', mode:0o600 });
    process.stdout.write(JSON.stringify({ ok:true, version:browser.version(),
      playwright_version:require(path.join(path.dirname(process.argv[3]), 'package.json')).version,
      node_version:process.versions.node, renders }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ok:false,error:error instanceof Error ? error.message : String(error)}));
    process.exitCode = 1;
  } finally { if (browser) await browser.close(); }
})();
`

const Result = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    version: z.string().min(1),
    playwright_version: z.string().min(1),
    node_version: z.string().min(1),
    renders: z
      .array(
        z.object({
          name: z.string().regex(/^office-unit-[1-9][0-9]*\.png$/),
          width: z.number().positive(),
          height: z.number().positive(),
        }),
      )
      .min(1)
      .max(40),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

export async function renderOfficeHtml(input: {
  html: string
  format: "docx" | "xlsx"
  directory: string
  executionAuthority: SessionExecutionAuthority
  abort: AbortSignal
  timeoutMs: number
  maxBytes: number
  maxUnits: number
}) {
  const authority =
    input.executionAuthority.kind === "task"
      ? { kind: "task" as const, taskID: input.executionAuthority.taskID, cwd: input.directory }
      : { kind: "host" as const, cwd: input.directory }
  const signal = AbortSignal.any([input.abort, AbortSignal.timeout(input.timeoutMs)])
  const htmlPath = path.join(input.directory, "office-render-input.html")
  await fs.writeFile(htmlPath, input.html, { flag: "wx", mode: 0o600 })
  const executablePath = await BrowserRuntime.findBrowserExecutable()
  const rendered = await runExplicitBrowserNodeSidecar<unknown>(authority, {
    script: renderScript,
    payload: {
      ...input,
      html: undefined,
      htmlPath,
      executionAuthority: undefined,
      abort: undefined,
      executablePath,
      launchArgs: BrowserRuntime.defaultLaunchArgs(),
    },
    signal,
    inactivityTimeoutMs: Math.min(input.timeoutMs, 45_000),
    label: "Work Artifact Office HTML renderer",
  })
  const result = Result.parse(rendered.result)
  if (!result.ok) throw new Error(`Office HTML render failed: ${result.error}`)
  if (rendered.exitCode !== 0) throw new Error(`Office HTML renderer exited ${rendered.exitCode}`)
  return result
}
