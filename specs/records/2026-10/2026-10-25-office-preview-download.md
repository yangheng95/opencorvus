# Office 真实预览与下载文件名继续验收

## Recall

用户要求单agent自主发现并修复当前体验/功能问题，真实页面验证后提交推送；旧闪烁已关闭，不再作为排查目标，只在实际冲突无法安全取舍时等待。595已接入同一Harness的DOCX/XLSX并确认OfficeCLI旧143吞保存错误的根因，固定升级官方158。当前最终编译包三profile、两个真实原生格式生命周期、21个聚焦合同和docs:check通过，尚未提交。595原Chat实际Sol生成两个Office文件、读回四模块状态及36/25/−11通过；浏览器已实际下载两个文件。预览失败，所以未冒充完整交付。595-before10次+after18次均200流式EOF，累计28/32；两次服务均public shutdown、原native/launcher退出0、物理/输出/请求结清，成对auth/models退休；after保留334067ms余量。594先前22次保留，总实际50次。用户18571、真实用户数据库和原CSV/Markdown不操作，无子agent。

已读595完整Recall、最新根因与最终方案、原生文件工具、runtime lock与所有资格/checker、BrowserRuntime/Node sidecar、实际失败截图与下载事件、AttachmentRoutes/AttachmentStore及现有同语义文件响应。已全仓搜索Content-Disposition、附件元数据及HTTP读取测试。当前相关文件均归本任务；并行CI提交保留，三个共享spec索引的无关排序不纳入提交。

## 修复前根因与影响面

实际环境通过Windows原生GetFolderPath对照证明：595-after设置USERPROFILE为隔离home，却只创建并声明旁边的localappdata；Windows Known Folder仍按USERPROFILE/AppData/Local解析，目录不存在时返回空字符串。Chromium的IsUsingDefaultDataDirectory在目录API失败时返回nullopt，远程调试检查按默认目录拒绝，故即使Playwright已传独立user-data-dir仍失败。仅补建真实Known Folder后，相同环境原生Chrome155.0.8059.85启动成功。该差异来自验收launcher，不是需要绕过的Chrome保护或产品安装故障。保留既有独立浏览器实现，不禁用安全检查、不接入用户资料；新隔离环境同时创建和声明home/AppData/Local、Roaming。现有compiled checker同样目录合同已修复且通过。

实际下载却得到SHA文件名；AttachmentRoutes只从blob扩展推MIME，普通附件没有Content-Disposition，也未消费canonical sidecar的真实filename。DOCX/XLSX/PPTX还被映射为通用octet-stream。直接触发是正常Markdown附件链接的浏览器下载，根因是HTTP交付丢失canonical文件身份，旧文本编辑器自带download名称不能修复该路径。修改唯一AttachmentRoutes：原blob仍以URL中的不可变身份定位，读取同一个AttachmentStore verified reference/bytes，MIME保留现有安全扩展策略并从profile registry取得Office类型，响应以RFC5987 UTF-8文件名声明真实canonical filename。SVG继续download-only octet-stream，预览类型保持inline，不新增猜测名称、旁路URL或兼容读取。无路由、入参、数据库schema、LLM流程或调度变更；影响全部canonical附件的HTTP文件名及Office MIME，需正向HTTP字节/名称/类型、SVG安全合同和真实浏览器下载验证。原Source引用、校验、存储namespace与receipt身份保持。

## 执行与验收方案

1. 先修同一附件响应实现，正向测试真实HTTP读取的字节、Unicode名称和Office MIME，以及既有PDF inline、SVG下载安全语义；不增加或运行UI自动化测试。
2. 使用已物理关闭的595-after完整自有DB与全部附件namespace创建新隔离实例，保持同一原Chat和两个实际已生成文件。修正Known Folder目录合同，普通开发CLI提供/ui，不启动独立Vite，不碰用户进程。继续使用同一普通Node UI publication（当前frontend无新增差异）。
3. 这是由新确认的Windows目录合同及下载身份缺陷触发的新验收scope596；原594/595实际50次和失败事实完整保留，595未用的4次余量退休。新scope最多12次真实Sol请求，预检/后台全部计入，累计上限62；不因观察超时重置或扩大。凭据与完整models成对准备，任务前验证凭据、投影和实际流式gpt-6.1-sol一致。原生20分钟物理边界，至少提前5分钟公开关闭并结清所有权，再退休副本。
4. 原Chat自然请求继续两个已生成文件的预览检查与正式交付，实际打开PDF/PNG查看排版、核对四模块/合计，真实下载两份源文件并以实际OfficeCLI读回内容与下载字节身份核验。不能以fixture checker代替该业务/页面验收，不能写假消息或改原失败。
5. 完成595/596证据、索引、当前架构与文档检查，复核完整差异及所需检查，精确提交全部本任务改动，fetch/merge并复核完整待推集合，正常hook推送。未通过的资格明确保留；用户持续Goal保持active。

## 596 实际结果与新增视觉根因

真实浏览器分别下载为周报.docx、工时汇总.xlsx，实际字节与两个canonical源完整一致；官方158实际读回14段Word与6行Excel，四模块状态及36/25/−11正确。初次私有检查将Word的Unicode减号误当ASCII连字符，读取原段落确认后修正检查表达，原失败保留。真实validate为两个原文件成功生成新receipt、单页PNG及PDF，Known Folder修正已由原应用路径证明。手工打开Word原尺寸和50%整页，全部内容及页边界可见。

实际XLSX截图却显示模块名和表头被省略号截断，且只有左侧表格、右侧约千像素空白。直接触发为已有原生默认列宽44.27pt；typed author只写数据/字体，没有定义列宽，OfficeCLI HTML忠实保留固定表格布局和省略策略。renderer截图整块默认铺满1600px的.sheet-content，放大了空白。旧数据/原生校验通过不能证明可读性，前一轮compiled生命周期未代替视觉验收。Word没有该表格问题；同一XLSX生产入口、所有sheet及真实readback/validate/deliver都受影响。无调度、数据库、API参数或LLM权限变化。

596共12/12实际Sol请求均200且reader EOF，下一请求被本轮明确预算拒绝（E2E_REQUEST_BUDGET_EXHAUSTED），未进入模型自行看图、正式deliver及交付目录复制；不能宣称这三个步骤完成。已public shutdown200、原22556/native/launcher退出0、物理/输出/请求结清，保留692018ms余量，成对副本退休。594/595/596累计62个真实请求及预算失败保留，不清零。

## 597 视觉修复方案（实施前）

官方[Excel列合同](https://github.com/iOfficeAI/OfficeCLI/wiki/excel-column)支持在同一batch完成单元格后autofit整表，以真实内容设置原生列宽；先用固定158私有副本实测，再接入唯一author路径，新增实际原生列属性正向验收。renderer对XLSX输出单元使用内容宽度，保留真实列/行和页面限额，不用CSS伪造源文件已修复；PPTX和Word不改。完整源内容、canonical发布和receipt仍按同一合同校验。无既有文件就地改写，原附件及Markdown/CSV保留。

新增597 scope是由已截图确认的列宽/预览画布缺陷触发，修复后须在原Chat实际重新生成Excel、检查两个文件的新预览、正式deliver和保存指定路径。独立最多32次Sol请求（含预检/后台），累计上限94，未用余量退休；不因观察超时重置或扩额。保持原生20分钟边界及提前5分钟关闭、完整数据/附件复制和凭据/模型目录/实际模型三项预检。实际截图再次确认表头、完整模块名、状态与数字，打开PDF及下载文件；未完成如实保留，随后精确提交推送，不再扩大当前功能范围。

## 597 真实结果与交付边界

固定158私有副本autofit实测成功，A列原生width=12.01、customWidth=true；同一author batch据此完成整表列宽，不产生另一个writer。renderer修正为真实.table-wrapper，逐表PNG宽度贴合内容且包含工作表名称。新的真实原生生命周期2项/11断言通过，最终CLI重新编译后XLSX资格通过。原PPTX、DOCX及三个profile的固定158资格、21项合同、2项HTTP合同与类型检查保留。

原Chat实际Sol重新author得到4102141f…941fa的XLSX，Word原fc6e9218…b30999保留。两个源均实际inspect、validate，模型实际read两个PDF检查，随后两次work_artifact_deliver真实完成并发布file-preview卡；人工打开实际PNG、右侧文件PDF及两个交付工作区，完整表头、登录与注册/任务看板/报表导出/移动端适配、完成/进行中/待验收/未开始、36/25/−11可读。浏览器实际下载新XLSX为工时汇总 (1).xlsx（保留前一下载，正常重名后缀），下载字节身份与canonical源一致，固定158再读真实单元格及原生列属性核对。

597共21/32请求均流式200、原reader EOF，未用11次退休；加594/595/596共83次实际请求，保留所有原失败。public shutdown200、原97244/native/launcher退出0，物理/输出/请求结清，711531ms余量，成对auth/models副本退休、源身份保持。用户18571/用户数据库未操作，schema8保持；完整自有DB中统一engine_task、root ingress及task_plan对照原始行验证，不由模型自述证明无子Task/Mission。

没有将以下范围包装成完成：两份源文件已是canonical项目附件并能下载，但尚未写到请求的交付目录，当前工具缺通用二进制附件另存接口；交付卡下载菜单只列自己的PDF，源文件通过真实最终消息链接取得；XLSX PDF沿用A3横向纸张，小表留下纸张空白，内容裁剪仅用于PNG。它们需要后续公共文件保存/Artifact导出和打印版式工作，不能以脚本复制、伪消息或fixture替代原模型交付。原594连接失败根因仍未知，非Windows目标尚未在本机资格。已落盘实际截图和[结构化事实](../../artifacts/2026-10-25-office-preview-download/verification.json)，当前批次按这些边界提交。
