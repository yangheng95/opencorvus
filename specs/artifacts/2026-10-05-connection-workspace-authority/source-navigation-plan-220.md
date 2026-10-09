# 220 来源链接保持对话阅读上下文

## Recall

用户要求持续自主改进UI（User Interface，用户界面）/功能，重点Sources与子agent Dock；最新只使用单agent，覆盖旧goal里的多agent。219已推送41981bea，起始干净，真实Sources/长工具/返回/深色/Tab已采，但未实际激活来源。本轮验证网页Sources click/Enter后的阅读上下文，若实证替换对话页则修复。禁止UI自动化测试、注入DOM（Document Object Model，文档对象模型）、合成Sources和操作用户IAB（In-App Browser，应用内浏览器）23。只用原自然历史和自有隔离页面/截图人工复核，不重跑Task/委托agent/调用模型或移交凭据，不能宣称新Sol资格。

## 修改前根因与影响分析

SourceParts.tsx网页Tooltip.Trigger as=a提供真实href/data-browser-preview-url，缺target/rel；唯一调用CardParts相邻真实Source Parts，Main/child/Side Chat共用。Markdown renderer已有HTTP（Hypertext Transfer Protocol，超文本传输协议）链接target=_blank、rel=noopener noreferrer和同一preview属性。全局main.tsx listener在Native preview/外部open-url能力可用时preventDefault并交给现有owner，两者缺失则让浏览器默认导航。[MDN原始文档](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a)确认默认_self为当前context、_blank通常新标签。

触发：Web UI普通click/Enter网页Source。候选控制流根因：该叶片缺少已有正文链接的原生导航声明。旧标题/host/Disclosure/scroll/Rendering修复处理不同路径，未改导航目标。真实before待观察，不先以静态分析宣称用户可见失败。全仓搜索SourceParts调用、data-browser-preview-url生产者/全局listener及当前07契约完成；没有第二Source或导航实现需要增加。相关检索未发现UI自动化测试，纯服务测试不是UI验收。

方案仅改网页叶片的导航属性。Source生产/持久化/身份/标题/host/数目顺序/消息自然来源/Tooltip/follow owner不变；file/document叶片不同动作排除。公开SDK（Software Development Kit，软件开发工具包）/HTTP/schema/配置/调度/恢复/终态路径不变；没有新共享机制异常证据。Native拦截路径UI资格未知，Web通过不能代替Native通过。若发现新问题先保存证据并补分析，不扩大修复。

## 实施前方案

fresh220重新核对原153 Host/Target永久出生身份dead、18098及before18141/after18142无listener、auth/models不存在；读取当前readonly（只读）Task/dispatch/config/lease/ingress/恢复分类及原两Project属性。每个scope完整runtime copy，原90表实际完整逐行相同，原Task/Project/Session/Part与原目录保留。两个独立固定900000ms开发scope，不延长或因观察超时重启；原153/219闭合仅定位不能代替fresh观察。

before真实/ui加载当前bundle200，自己的页面打开原研究员Dock/展开Source/保存阅读基线，原生click或Enter实际激活来源，截图和新标签/当前URL证明行为。唯一public shutdown，原foreground Host及Native0/full physical-output-request、独立OS（Operating System，操作系统）身份/port/pair全闭合。只有实证候选后才给SourceParts网页a加与Markdown一致的target/rel，无新的导航owner或协议。

更新现行07契约。纯UI属性不新增非UI测试；types/build/docs局部检查，after新/ui实际新bundle、相同来源激活后原对话/Source状态与新真实目标标签分别截图人工查看才是验收。宿主若限制新标签，保留真实限制并用授权隔离浏览器验证，不注入状态制造通过。关闭全部自己的新标签/public shutdown及Native/OS/pair完整闭合，最终原13表完整行与两Project属性复核。

新spec同步root/月/B索引、docs；范围提交，fetch/merge upstream、完整待推送集合复核、正常hook/push，不新增branch/worktree/Release/tag/PR。持续goal active，未覆盖矩阵如实保留。

## 原观察、根因候选排除与决策

实际自有IAB36/ui加载main-Bmeb8tJo，原研究员来源href正确、target/rel确实null；真实click后新增37，36仍在localhost/ui且完整原Task/研究员Source可见，37真实WAI原网页标题/正文已截图人工查看。原首次Open rect为0，截图显示研究员卡片处于视口下方；新实际wheel后rect可见top209.2708，再用当前pointer打开，不以隐藏locator声称点击资格。自己36/37均关，用户23未动。

进一步读取host-transport.ts和tauri-transport.ts完整实际定义：browser与tauri都声明open-url=true；browser native(open-url)在click的同一用户手势调用经过externalUrl验证的window.open(_blank,noopener,noreferrer)，返回true；desktop由OS（Operating System，操作系统）开URL。原分析遗漏browser已声明能力，导致把一条当前支持宿主不可达的无能力分支当成实际候选。真实点击与源码共同排除当前支持浏览器中的替换对话根因；不能称已复现，也不能说IAB特殊拦截制造通过。未做Chrome/Native Tauri UI验收（当前可用面只有IAB/MCP Apps），如实保留范围。

因此不改SourceParts/Markdown/global listener，不加重复导航声明或新的路径；after scope未启动，原实施条件未满足，不把未启动after写成失败或修复成功。[实际结果](source-navigation-220/README.md)记录来源激活资格及下一候选。Native01:58:53.532Z实际exited0/full physical-output-request、原foreground Host0，独立出生身份/port/pair闭合；最终13表实际完整行相等、原两Project44/97属性相同。持续目标active，不为完成单候选缩窄完整产品目标。
