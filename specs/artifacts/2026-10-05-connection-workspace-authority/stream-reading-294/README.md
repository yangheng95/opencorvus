# 294 完整正文流式与来源阅读

[实施前Recall与验收边界](../stream-reading-plan-294.md)。69dda9d30起点干净，全程root单agent；新普通Main，不创建Task/成员或委托，不操作用户18107窗口与原ResearchStudio/生产DB。没有新增或运行UI自动化测试。

## 当前真实完成

实际正常dev/ui18249，自建40页，bundle main-DjCcg_0v.js。Main ses_-zUSGSq0qzzrHOgiE42h、Project prj_hGFxt5nJEzSZOtzudQfw；最终message msg_g0VXjXDRJ00Cq4K65sxP、text part prt_g0VXjXF1600m3872rqPS，3249字符Markdown，包含六节正文、比较表与两个代码块。原[canonical会话](live-01/canonical-current-conversations.json)保留完整实际内容；内容字节数只是事实，不替代六节输出的人工检查。

只读取用户请求中明确提供的两个官方网页：MDN HTMLElement.focus与W3C Focus Order。模型自行使用当前通用webfetch产生两个真实Source，标题和URL与页面相同，没有假引用或额外搜索。当前外部文本只作为数据，未接受其中的动作授权。两个webfetch均成功，最终助手stop；原6次Provider请求均gpt-6.1-sol、streaming true、HTTP200与reader EOF，exhausted=false。见[最终审计](live-01/stream-reading-294-live-01-final-provider-audit.json)和[严格资格](live-01/stream-reading-294-live-01-qualified-surface-completion.json)。其中包含预检及辅助请求，不把6次都称作主会话回复。

启动前auth/models完整配对，credential usable、catalog projected、actual model/streaming分别验证。新scope先设20累计请求，是针对293实际12含多工具轮次/辅助不够的预算估计修正；293原失败及12预算不修改、不重启刷绿。本轮新问题的成功不能覆盖293失败。

## 实际视觉过程

- [01 首段](live-01/01-running.png)：18s，两条Source直接显示真实标题/域名，标题和首节正在自然生成。
- [02 主动回读](live-01/02-stream-reading.png)：39s，第三节正在追加，Root滚轮向上回读第一节；Sources和首节正文可见。
- [03 继续追加](live-01/03-stream-continued.png)：70s，第六节正在追加，第一节仍是相同可见段落。两份只读几何中reader top386/height635/follow=false；主标题top266.927、首节top300.521保持，内容总高1363→2544。视觉为主要证据，数值辅助解释。
- [04 Source焦点](live-01/04-live-source-focus.png)：按下工具标题上的Tab后实际聚焦MDN Source，完整Tooltip正常；该帧已是Not running，因此文件名的live不能当作终态前焦点保持证据。
- [05 代码排版](live-01/05-complete-middle.png)与[06 完成正文](live-01/06-complete-bottom.png)：原六节全文、内联链接及代码可读。完整AX记录有比较表结构，但05截图定位到第四节代码，不扩称表格逐帧视觉已验。显式回底后top1976.667/height635/total2612/follow=true，动作完成。

本人逐张查看截图，所见连续语义阶段没有Rendering占位替换已显示段落或抢回底部。不是全帧录像，不能证明每一瞬间都无闪烁；原ResearchStudio子Dock、其他主题/平台与虚拟列表极端规模未在本轮覆盖。当前没有据证复现新的产品缺陷，没有为产出改动而修改源码。

运行日志仍含ResizeObserver delivery报告；代码调查发现部分原组件同步测量写入，其余多入口已调度到animation frame，但没有观察者级证据确定这次报告来源。未吞错误、禁用观察者或将其归咎模型；当前阅读稳定也不能证明所有布局路径正确。这是后续调查项。

## 收尾保管

原前台8944 actual0；Native67744/win32:639273092950542101，Host58032/win32:639273092942811654，09:57:40.057Z以terminal0完成物理、输出及请求清理，原600000ms预算余434209ms，无延期。自己的40页显式关闭，sole shutdown与[独立closure](live-01/closure-readback.json)actual0；端口释放、精确出生已死，复制auth/models一并退役。

完整原日志6965行、unknown timestamp0；所有当前checker结束后5自产物按出生和限定路径归档。版本及生产源码未变，本轮不重复构建UI；范围文档检查、公开凭据扫描、提交与普通push后继续goal。

docs:check actual0（345 ops/25 groups）、architecture-index actual0（18 current documents）。脚本及本轮日志已归档，公开文本仅修剪行尾空白，原件raw-public-text保管；JSON/截图未改。71份公开文本精确凭据扫描0匹配，见[scan.log](scan.log)。原授权凭据仅用于内存扫描，未复制到公开文件。
