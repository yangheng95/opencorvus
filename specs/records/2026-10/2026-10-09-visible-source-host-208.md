# 208 展开的网页来源显示准确域名

## Recall

用户主要指出 Sources 显示问题，要求自主持续迭代并明确只用单 agent。206/207阅读位置修复已提交并推送d63f937c。本轮先按 [方案](../../artifacts/2026-10-05-connection-workspace-authority/source-reading-audit-plan-208.md) 在原153完整真实历史副本上继续体验，不重置Task或复制凭据；真实发现与实施决定均先落盘。

## 问题与改动

真实窄子侧栏中长标题省略，展开后显示完整标题，但准确来源网址主要藏在Tooltip（悬浮信息）内，工具行本身URL也省略。数据流有 canonical（规范的）URL，却只把sourceLabel送入可见链接正文。既有完整title/tooltip修复保证信息可达，未解决可持续辨认来源的问题。

仅当前 SourceChip 网页链接新增 title+host 两行文字，host直接从相同URL解析并保留端口，用既有字体/颜色/间距变量；解析不成功则无host呈现。唯一SourceParts继续服务所有聊天入口，没有新metadata状态或协议。完整URL、ARIA（Accessible Rich Internet Applications，无障碍网页应用属性）名称、原action和tooltip保持，file/document/snippet无改动。现行合同更新07-panel-reactivity。

## 实际验收与限制

类型检查退出0，构建49.43s/退出0、renderer public surface检查通过。自己的208真实正常serve页面加载最终main-L1F0igr8，原请求日志资源200；三个真实URL来源直接显示www.w3.org、www.w3.org、developer.mozilla.org，完整长标题换行、三项真实组数、浅色和Dark均人工查看。Tab焦点进入原链接，浅色完整title/URL/provider Tooltip实际截图通过。点击第一原Source link产生独立tab22，真实目标标题/URL及W3C页面截图核对，随后关闭。折叠后较窄的桌面页面截图也已查看；没有设置移动端或制作UI自动化测试。证据见 [目录](../../artifacts/2026-10-05-connection-workspace-authority/source-reading-audit-208/README.md)。

一次主卡Open点击后Dock未显示，原截图保留；活动栏可打开相同researcher。根因尚未知，不能归因新修复或视为已修好。多Source同组、file/document、无标题URL、invalid URL/自定义端口、长snippet和流式场景这份真实历史没有，不能以静态分支或DOM事实替代验收。

原父工具90185退出0，生产Native terminal exited/0、物理/输出/request cleanup完整，精确Host68616/Target54068出生身份死亡、18128端口和pair闭合已独立确认。自己页面21/22均关闭，原153未重启。正常提交/上游merge/push后继续单agent目标，不宣称全面产品体验或全部Sources完成。
