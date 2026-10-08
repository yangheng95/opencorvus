#167 折叠 URL Source 同域路径辨识调查（只读）

## Recall

用户持续要求 Sources 可读、真实身份、侧栏阅读与自然交互。Root166仍在实际执行；Root报告280px侧栏两个真实 RFC URL 折叠为相近的 `www.rfc-editor.org/rfc/rfc…`，实际不同尾部 rfc8259.txt/rfc5234.txt 看不到，展开可读。本调查不把Root文字报告冒称子agent本人像素复核，不宣称166完成/失败/关闭。只读当前源码、CSS、架构与既有137/157/166记录；没有产品、测试、helper、DB、服务、模型、UI、Git或委托动作。Root负责索引与准入。

已读：SourceParts.tsx全文；messages.css958–1088；CardParts SourceParts/citationRenderRuns唯一调用；utils/tool.ts工具标题与路径工具；TaskDirBar requestSources展示；tool/source.ts；Message.SourceUrl/File/Document schemas；current architecture07-panel.md478–506；137 Tooltip调查、157可用性、166自然titleless场景与当前Root反馈。

## 可观察现象、直接原因与边界

这是折叠摘要的辨识成本，非 Source 丢失或链接错误。SourceParts.tsx41–66唯一 sourceLabel：file取真实title或basename并带range；URL优先不同于URL的真实title，无title/等URL的title使用 hostname+pathname+search；document取真实title/filename/mediaType/本地化类型。当前RFC text/plain无HTML title是合法输入，不应凭空生成“RFC标题”。Root两条共有长host与path前缀，真正区分信息在尾部。

SourceParts.tsx179/202–221 preview只读第一真实Source的同一label；messages.css993–1001 nowrap/overflow hidden/text-overflow ellipsis 在可用宽度右截断。图标、count、native Disclosure indicator仍占据真实宽度，因此右尾差异自然被截。展开 chip1061–1066 normal/anywhere换行，不存在相同截断；Tooltip107–112提供完整label+实际detail，URL href143保持原完整URL。旧114修expanded可用宽与换行、138保数据身份、143稳定Key、158阅读focus、162消息密度都不改变折叠标签信息顺序，因而没有根治该成本。

架构07当前明确“first real source readable identity”和“collapsed compact ellipsis”，两者兼容，但现前缀优先对同域URL不能很好满足readable identity。值得做一个限定label排序修复，不需要取消ellipsis、加每行展开高度或更改模型/抓取策略。

## 全部生产者、消费者与单源

CardParts.tsx134–165按真实Part序列构造citation runs，并且唯一实例化SourceParts；main与child通过相同CardParts，不另做Task全局Sources汇总。SourceParts的label同时供应heading preview/title/aria、expanded chip/URL aria与Tooltip strong；detail保URL、file相对path+range、documentfilename/mediaType。canonical Key仍type/sessionID/messageID/sourceId，preview排序不属于身份。

工具title是另一真实Tool显示合同：utils/tool.ts describeToolPart优先state.title；webfetch实际工具标题/输入URL并非Source.title。不要把工具标题复制成Source标题或改Tool clipping。TaskDirBar1534的requestSources/FilePart是请求文件库存，不是同一SourceParts数据展示，不应同步套此label。

tool/source.ts canonicalSourceUrl用现URL primitive规范化并去fragment，sourceId绑定实际URL；urlSource只存非空真实title，fileSource存绝对path/真实basename/range。Message schemas区分URL/file/document；document无可伪造URL/下载locator，165真实7树census没有document样本，documentUI仍未知。本轮不触数据生产/持久化/transport/redirect/Tool声明。

全仓检索未发现可直接复用的URL middle-ellipsis或same-domain label工具。已有shortRelativePath只处理文件项目路径，不能用于URL或把不同URL归成一个文件身份。无需抽象新全局format/cache或复制路径解析。

## 最小候选（尚未准入）

### Root implementation admission — 2026-10-08T11:14Z

Root fullread167/166/162/163 Recall, personally viewed166 live/narrow/collapsed before, searched all sourceLabel/SourceParts/CSS/public contracts.166 completed165307ms/17 SolEOF/originalcombinedONCE0/nested0/all owned native/page/port/pair closed, parent8924actual0joined. Root admits only SourceParts sole no-title/equal-URL label ordering to pathname+search · hostname plus current07 explanation. Existing CSS/count/Key/tooltip detail/href/file/document/title branches remain. Save exact preimage/diff before mutation. Type/build/publicsurface prerequisites and independent168 real page needed; samepath acrosshosts/extreme paths remain unknown, no universal identification claim. No scheduler/data/protocol contract change or UI automated tests.

在唯一sourceLabel现有无title/等URL-title分支，仍用现 `new URL(source.url)`，把已有全量组成部分显示顺序从 `hostname+pathname+search` 改为 `pathname+search · hostname`。仅重排真实字符串，不删除父目录/查询、不decode改语义、不猜RFC编号/标题、不造短网址。这样本案 `/rfc/rfc8259.txt` 与 `/rfc/rfc5234.txt` 的差异出现在摘要前部；完整域名仍在label、Tooltip detail和真实href。保留真实有title、file和document现规则、native ellipsis/count/Key/activation/focus全部不变。所有Source展示仍只有sourceLabel一个事实派生，不另建collapsed formatter。

此方案是可审查候选，不承诺任意长共同path/query都能在280px区分；极深路径尾部仍可能截。域名改到后部使不同host但同path的摘要辨识变弱，Root必须用真实现有三来源同时比较并决定是否接受；不以所有同域都分组或按catalog统计动态生成短label。若权威域名必须一直优先可见，需另行准入结构化host/path布局，当前证据不足以扩大此范围。单纯direction:rtl或CSS反转不适合URL/自然title，不能用于伪middle-ellipsis。

## 影响、验收与未知

预计限定SourceParts单函数与07文案关于URL摘要的说明；CSS无需改。不是调度/恢复异常，不触Task/Mission/Session occurrence和权限/数据隔离。错误URL现catch与空可选metadata现分支保持原当前合同，不新增fallback。SourceChip Switch真值、Key和Disclosure owner不变。

Root应保留166原真实280px前态截图及具体tuple，sourcefreeze后fresh受控真实页面在同真实RFC Sources观察collapsed区别与expanded全量、Tool标题/count、nativeTab Tooltip完整URL/Escape焦点/Enter真实目标；另看W3C robots.txt仍辨识hostname。先数据身份不变再实际像素/交互，不用UI自动化或源码文案断言替代。若仅已有closed可信history可用须先单独history custody准入，不能重开166/复制用户DB。

当前缺少本agent本人166图片、原始DOM几何及完整Task终态；Title=URL、同path跨host、极长query/path、document、多个Source同group都未真实资格。此次没有实现或视觉pass。Root166最终结果不可由此调查改写。
## Root166真实前态补充及本人图片复核

Root随后提供 source-url-plaintext-live-166/live-01/root-collapsed-titleless-before.jpg 与 .json，本agent已实际view_image查看该保存图片（不是操作页面）。1093×1244 viewport、280px右侧dock，三个details真实rect均240px宽28px高。图片中两RFC摘要均视觉显示 `www.rfc-editor.org/rfc/rf…`，第三W3C robots.txt可读；JSON原DOM preview/title/aria保留两个不同的完整 rfc8259.txt/rfc5234.txt。故“共同前缀遮蔽差异”的像素问题有真实前态，非仅Root口述；没有来源数据丢失。第一RFC焦点outline可见，不从它推断完整keyboard矩阵。原先“缺少本人166图片/几何”在本补充已取得，仅原发生时未知保持为历史说明。Task终态/wholeclosure/oracle仍不由截图标题推定，等Root另报实际结果。

## 当前进度补充（原Recall/历史阶段保留）

166 Root真实280 collapsed两RFC同前缀ellipsis失败保留。Root11:14已准入167，仅SourceParts path+query·host及Root07文案落地，types/build正在跑，未视觉资格化。168仅prepared/runtime HELD，待Root独立实际验收；不重跑166原once，不预设UI通过。

## 当前最终进度（以上实现/准备阶段为历史）

Root [168人工记录](source-url-path-first-live-168/live-01/root-manual-qualification.md)限定资格成立：types56135/build46762实际0、176879ms/16 Sol EOF/原combined once0+nested0及whole closure；宽380/窄280同站点titleless collapsed RFC paths可区分/W3C可读，自然增长阅读和限定native导航合格。immediate reentryTooltip undefined不算pass，generalRendering/doc/extremepath/samepath跨host/真实Sources3及未采消费者未知。166原失败不重写，连续目标ACTIVE。
