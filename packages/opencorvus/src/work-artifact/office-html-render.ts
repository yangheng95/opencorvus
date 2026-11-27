import { BrowserRuntime } from "@/browser/runtime"
import { runExplicitBrowserNodeSidecar, type BrowserNodeSidecarAuthority } from "@/browser/runtime/node-executor"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import z from "zod"
import fs from "node:fs/promises"
import path from "node:path"
import pagedScript from "pagedjs/dist/paged.polyfill.js" with { type: "text" }
import pagedLicense from "pagedjs/LICENSE.md" with { type: "text" }
import pagedPackage from "pagedjs/package.json"

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
    // DOCX uses a single paged-media engine. Parse without executing OfficeCLI's
    // interactive pager; late CSS cannot repair pages it has already split.
    const content = input.format === 'docx' || input.format === 'pptx' ? await page.evaluate(({html,format}) => {
      const document = new DOMParser().parseFromString(html, 'text/html');
      document.querySelectorAll('script').forEach(script => script.remove());
      if (format === 'pptx') {
        for (const element of document.querySelectorAll('*')) for (const name of element.getAttributeNames())
          if (name.toLowerCase().startsWith('on')) element.removeAttribute(name);
        const slides = Array.from(document.querySelectorAll('.main > .slide-container > .slide-wrapper > .slide'));
        document.body.replaceChildren(...slides);
      }
      return document.documentElement.outerHTML;
    }, {html,format:input.format}) : html;
    await page.setContent(content, { waitUntil: 'load', timeout: input.timeoutMs });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; } .page { transform: none !important; } .sheet-content { display:block !important; overflow:visible !important; flex:none !important; width:max-content; } .table-wrapper { overflow:visible !important; max-height:none !important; flex:none !important; } .sheet-content caption { position:static; clip:auto; width:auto; height:auto; padding:10px; text-align:left; font-size:16px; font-weight:600; }' });
    if (input.format === 'pptx') await page.addStyleTag({ content:
      'html,body {margin:0!important;padding:0!important;background:white!important;overflow:visible!important;}' +
      '.slide {margin:0!important;transform:none!important;box-shadow:none!important;flex-shrink:0!important;}' });
    // Review images must expose each literal cell's content. The interactive
    // Office view clips fixed-height cells; retain its columns and typography
    // while letting review rows grow to fit wrapped text, as the PDF does.
    if (input.format === 'xlsx') await page.addStyleTag({ content:
      '.sheet-content tbody tr { height:auto !important; } .sheet-content td { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; overflow-wrap:anywhere; } .sheet-content td .spill-text { white-space:normal !important; overflow:visible !important; max-width:100% !important; }' });
    if (input.format === 'docx') {
      const sections = await page.evaluate(() => {
        const pages = Array.from(document.querySelectorAll('.page'));
        const sections = pages.map((page, index) => {
          const style = getComputedStyle(page);
          return { name:'office-section-' + (index + 1), width:style.width, height:style.minHeight,
            margin:[style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].join(' ') };
        });
        // These empty elements locate blocks in the interactive editor. They
        // carry no document text and interrupt adjacent block break semantics.
        for (const page of pages) for (const marker of page.querySelectorAll('.page-body > a:empty, .page-body > .wb, .page-body > .we'))
          if (!marker.textContent) marker.remove();
        // Keep a chain of consecutive headings as one semantic block. The
        // paged-media engine can then retain the entire chain with the first
        // body lines, while leaving a long body paragraph free to fragment.
        for (const body of document.querySelectorAll('.page-body')) for (const first of Array.from(body.children)) {
          if (first.parentElement !== body || !first.matches('h1,h2,h3,h4,h5,h6')) continue;
          const headings = [first];
          let next = first.nextElementSibling;
          while (next && next.matches('h1,h2,h3,h4,h5,h6')) { headings.push(next); next = next.nextElementSibling; }
          if (headings.length > 1) {
            const group = document.createElement('div');
            group.className = 'office-heading-group';
            body.insertBefore(group, first);
            group.append(...headings);
          }
        }
        document.body.replaceChildren(...pages);
        pages.forEach((page, index) => { page.dataset.officeSection = sections[index].name; });
        return sections;
      });
      if (!sections.length || sections.length > input.maxUnits)
        throw new Error('Office source section count exceeds profile limits: ' + sections.length);
      const paper = sections[0];
      if (sections.some(section => section.width !== paper.width || section.height !== paper.height))
        throw new Error('Office document profile requires uniform physical page dimensions');
      // Paged.js derives physical sheet variables from the unnamed @page;
      // named rules alone only size the inner pagebox, leaving a Letter sheet.
      await page.addStyleTag({content: '@page {size:' + paper.width + ' ' + paper.height + ';margin:' + paper.margin + ';}\n' + sections.map(section =>
        '@page ' + section.name + ' {size:' + section.width + ' ' + section.height + ';margin:' + section.margin + ';}' +
        '.page[data-office-section="' + section.name + '"] {page:' + section.name + ';}'
      ).join('\n') + '\n' +
        'html,body {padding:0!important;margin:0!important;background:white!important;}' +
        '.page {width:auto!important;min-height:0!important;height:auto!important;padding:0!important;margin:0!important;display:block!important;box-shadow:none!important;border-radius:0!important;overflow:visible!important;transform:none!important;}' +
        '.page::before {display:none!important;}.page-body {display:block!important;flex:none!important;}' +
        'h1,h2,h3,h4,h5,h6 {break-after:avoid;break-inside:avoid;}p {orphans:2;widows:2;}' +
        '.office-heading-group {break-after:avoid;break-inside:avoid;}' +
        '.pagedjs_page {background:white!important;margin:0!important;box-shadow:none!important;}'
      });
      await page.evaluate(() => {
        window.PagedConfig = {auto:false};
        // Paged.js 0.4.3's undisplayed filter treats an inline style without a
        // display value as hidden. Materialize the actual computed value so
        // ordinary Office typography participates in its break constraints.
        document.querySelectorAll('[style]').forEach(element => {
          if (!element.style.display) element.style.display = getComputedStyle(element).display;
        });
      });
      await page.addScriptTag({path:input.pagerPath});
      await page.evaluate(async () => { await window.PagedPolyfill.preview(); await document.fonts.ready; });
    }
    const selector = input.format === 'docx' ? '.pagedjs_page' : input.format === 'pptx' ? 'body > .slide' : '.sheet-content';
    const units = page.locator(selector);
    const count = await units.count();
    if (count < 1 || count > input.maxUnits) throw new Error('Office render unit count exceeds profile limits: ' + count);
    const renders = [];
    const printPages = [];
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
      if (input.format === 'xlsx') {
        const pageName = 'office-sheet-' + (i + 1);
        await unit.evaluate((element, name) => { element.style.page = name; }, pageName);
        printPages.push('@page ' + pageName + ' { size:' + (Math.ceil(box.width) + 32) + 'px ' +
          (Math.ceil(box.height) + 32) + 'px; margin:16px; }');
      }
    }
    if (input.format === 'xlsx') await page.addStyleTag({content:
      printPages.join('\n') + '\n@media print { html, body, .sheet-slider { height:auto !important; min-height:0 !important; overflow:visible !important; } .sheet-slider { display:block !important; } .sheet-content { margin:0 !important; break-after:page; } .sheet-content:last-child { break-after:auto; } }'});
    if (input.format !== 'pptx') {
      const pdf = await page.pdf({ ...(input.format === 'docx' ? { format:'A4' } : {}),
        printBackground:true, preferCSSPageSize:true });
      outputBytes += pdf.length;
      if (outputBytes > input.maxBytes) throw new Error('Office preview output exceeds profile limits');
      await fs.writeFile(path.join(input.directory, 'office-preview.pdf'), pdf, { flag:'wx', mode:0o600 });
    }
    process.stdout.write(JSON.stringify({ ok:true, version:browser.version() +
      (input.format === 'docx' ? '; pagedjs@' + input.pagerVersion + '; layout@1' : ''),
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
  format: "pptx" | "docx" | "xlsx"
  directory: string
  executionAuthority: SessionExecutionAuthority | BrowserNodeSidecarAuthority
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
  const pagerPath = input.format === "docx" ? path.join(input.directory, "office-pager.js") : undefined
  if (pagerPath) await fs.writeFile(pagerPath, `/*\n${pagedLicense}\n*/\n${pagedScript}`, { flag: "wx", mode: 0o600 })
  const executablePath = await BrowserRuntime.findBrowserExecutable()
  const rendered = await runExplicitBrowserNodeSidecar<unknown>(authority, {
    script: renderScript,
    payload: {
      ...input,
      html: undefined,
      htmlPath,
      pagerPath,
      pagerVersion: pagerPath ? pagedPackage.version : undefined,
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
