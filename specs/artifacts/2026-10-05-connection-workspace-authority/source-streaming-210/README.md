# 210 当前 Host / GPT-6.1 Sol 单 Chat 流式 Sources

## Recall

用户授权复制OpenAI认证与实际Sol端到端测试，持续自主迭代Sources/Rendering，最新只用单agent。前一回合d63f937c/0945cff3真实修复和209观察已推送；本轮按 [实施前方案](../source-streaming-plan-210.md) 先补当前ProcessFacade之后普通真实Sol Host资格，不修改生产源或重放旧Task。

当前source32e6fae7/最终assetmain-L1F0igr8。Run `C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-09/source-streaming-210-01`、port18130、occurrence `source-streaming-210-01-cdbbfad5-7334-40e1-8e56-fe07f55917bd`，原Host600000ms/deadline1791497043579不变，累计12请求上限。Base+Code/Chat，自然UI请求三个回合在同ses_-zUSV55TNzz2cymIYEfk；没有协作子agent或模型委托，当前架构的记忆请求仍属于同会话模型运行。

## 真实 Provider 与持久化资格

| 要求 | 原始实际证据 |
| --- | --- |
| 凭据/完整相邻模型目录成对移交 | [元数据](live-01/source-streaming-210-01-provider-pair-staging.json)，仅选中OpenAI entry及完整catalog，不含内容 |
| 当前model真实投影 | [authority-ready](live-01/source-streaming-210-01-authority-ready.json)，global/project/current模型合同 |
| 发UI消息前可用/投影/实际请求模型分开验证 | [preflight-ready](live-01/source-streaming-210-01-preflight-ready.json)，usable/projected/actualgpt-6.1-sol/streamingtrue |
| 所有模型请求真实流式完成 | [final audit](live-01/source-streaming-210-01-final-provider-audit.json)，10次streamingtrue/HTTP200/actualmodel/原reader settled EOF，包括preflight和记忆 |
| 当前UI与asset真实200 | [HTTP/native准入](live-01/actual-http-readiness.json)及[原生产请求](live-01/source-streaming-210-01-http-summary.json) |
| 真实三回合与Source事实 | [SQLite只读BEGIN/ROLLBACK观察](live-01/canonical-completed-chat.json)，3用户/5助手消息，3个最终stop/completed，2原source-url parts及规范title/URL/provider |

第一实际请求、追问、第三请求原文分别为actual-request.txt、actual-followup.txt、actual-third-request.txt。原正文text长度为4122、二回合66+6179、三回合5199；可见card字符包含呈现与控件，不能与raw正文长度混为一谈。没有构造Source、指定伪消息、非流式API或UI自动化测试。

## 真实页面人工复核

| 场景 | 实际观察与截图 |
| --- | --- |
| 首回合Sources产生/答案增长 | [真实Running](live-01/sources-running-initial.jpg)，两个webfetch与真实标题；[滚轮阅读](live-01/source-reading-before-expand.jpg)时follow=false |
| 首次展开/键盘Tooltip | [截图](live-01/reading-during-stream-a.jpg)，完整title/URL/provider；此时已Not running，保留阶段限定 |
| 第二回合 | [未把Sources放入视口的样本](live-01/second-stream-sources-visible.jpg)保留；[完成后聚焦](live-01/second-stream-reading-focused.jpg)，不冒充流式展开；[完整长正文/表格](live-01/second-completed-bottom.jpg) |
| 第三回合Source阅读随真实增长保持 | [A](live-01/third-source-reading-a.json)/[像素A](live-01/third-source-reading-a.jpg)→[B](live-01/third-source-reading-b.json)/[实际Running像素B](live-01/third-source-reading-b.jpg)：top340/followfalse、sourceTop271.447937/381.84375保持，height7534→7854；[reader A](live-01/third-provider-reader-a.json)→[reader B](live-01/third-provider-reader-b.json)绑定当前真实请求进展至chat reading300chunks |
| 实际Running主动到底及随后增长 | [A](live-01/third-resumed-follow-a.json)/[像素A](live-01/third-resumed-follow-a.jpg)：4139/10991/top10356/followtrue；[B](live-01/third-resumed-follow-b.json)/[像素B](live-01/third-resumed-follow-b.jpg)：同card4210/11042/top10406.666992/followtrue |
| 结束后长内容返回 | 原[键组合未返回像素](live-01/completed-source-return.jpg)保留；实际[wheel返回](live-01/completed-source-return-wheel.jpg)/[事实](live-01/completed-source-return.json)top326.666656/followfalse、原两Sources展开/title/host/height11042保持 |

所有上述目标截图亲自查看。没有将没有来源在视口的样本或完成后样本重判为流式资格。最终wheel返回中原第一card完整，不在记录采样中重复Rendering；不是所有帧/入口无Rendering的证明。首次与第二次错过完整阶段保留为原事实，第三次在原预算内是真实追加同Chat输入，非重放或延长。

## 自然结算及剩余范围

自己的page25已关闭，非本轮page23未操作。原前台父工具4974实际退出0，[qualified NativeService](live-01/source-streaming-210-01-qualified-surface-completion.json)与[原生产native settlement](live-01/source-streaming-210-01-native-host-settled.json) 为22:02:47.304Z exited/0、physical/output/request完整、原deadline内；[whole pair settlement](live-01/source-streaming-210-01-physical-terminal-and-pair-cleanup.json)与[独立OS精确身份](live-01/source-streaming-210-01-independent-closure.json)确认Host23596/Target63180出生身份死亡、18130及auth/models pair关闭。没有把期限1当模型业务成功。

日志公开副本通过成熟CredentialRedactor在内存屏蔽源凭据后归档，私有原日志保留；不含auth/models内容。5份本轮FFI（Foreign Function Interface，外部函数接口）调试文件按精确出生时间和工作区边界移至私有目录，[移交记录](generated-native-observer-custody.json)保留。

当前新Host普通Sol、单Chat来源及暂停/恢复/返回获得真实限定资格。键盘返回未响应样本的内部事件时序仍未知；子侧栏流式、多Source同组、file/document、cold eviction（冷内容淘汰）、locale（语言切换）、error（错误）和全部交互矩阵仍待继续。无生产源码改动，不宣称整个持续产品目标完成。
