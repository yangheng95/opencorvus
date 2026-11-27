import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'file:///D:/myhexin-local/opencorvus/node_modules/.bun/playwright@1.59.1/node_modules/playwright/index.mjs'
const root=path.dirname(fileURLToPath(import.meta.url))
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,handleSIGHUP:false,handleSIGINT:false,handleSIGTERM:false})
try {
 const context=await browser.newContext({viewport:{width:1600,height:1200},serviceWorkers:'block',acceptDownloads:false})
 await context.route('**/*',route=>route.abort('blockedbyclient'))
 const page=await context.newPage()
 const html=await fs.readFile(path.join(root,'native.html'),'utf8')
 const content=await page.evaluate(html=>{
  const doc=new DOMParser().parseFromString(html,'text/html')
  doc.querySelectorAll('script').forEach(node=>node.remove())
  for(const element of doc.querySelectorAll('*'))for(const attr of element.getAttributeNames())if(attr.toLowerCase().startsWith('on'))element.removeAttribute(attr)
  const slides=Array.from(doc.querySelectorAll('.main > .slide-container > .slide-wrapper > .slide'))
  doc.body.replaceChildren(...slides)
  return doc.documentElement.outerHTML
 },html)
 await page.setContent(content,{waitUntil:'load'})
 await page.addStyleTag({content:'html,body {margin:0!important;padding:0!important;background:white!important;overflow:visible!important;} .slide {margin:0!important;transform:none!important;box-shadow:none!important;flex-shrink:0!important;} * {animation:none!important;transition:none!important;}'})
 await page.evaluate(async()=>{await document.fonts.ready})
 const units=page.locator('body > .slide');const count=await units.count();const pages=[]
 for(let i=0;i<count;i++){
  const slide=units.nth(i);const box=await slide.boundingBox()
  const bytes=await slide.screenshot({type:'png',animations:'disabled'})
  await fs.writeFile(path.join(root,'html-slide-'+(i+1)+'.png'),bytes)
  pages.push({slide:i+1,width:box.width,height:box.height,bytes:bytes.length})
 }
 const result={engine:'actual fixed OfficeCLI HTML and Node.js Chrome file renderer',node:process.versions.node,browser:browser.version(),pages}
 await fs.writeFile(path.join(root,'html-probe-result.json'),JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify(result))
}finally{await browser.close()}
