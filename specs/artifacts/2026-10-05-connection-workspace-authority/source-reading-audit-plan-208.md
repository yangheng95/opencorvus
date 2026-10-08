# 208 Sources 继续体验

## Recall

用户持续要求自主迭代，主要问题为 Sources 显示，最新只使用单 agent。206/207已修复真实历史子侧栏返回的阅读位置，并以真实截图完成限定验收；当前提交d63f937c，正常push检查进行中。新一轮先调查真实页面，不将已有截图或组件代码当新视觉通过。不会重新执行原153 Task，不复制凭据，不创建新模型消息或操作用户窗口。

## 调查深度与当前未知

已读 SourceParts.tsx 全部 source identity/label/detail/tooltips/actions/disclosure 路径、messages.css 来源样式、Disclosure.tsx 原生 details primitive、07-panel-reactivity 的 Sources/阅读/滚动公共合同。全仓调用搜索 SourceParts 只有 CardParts.tsx；SourceParts 同时服务主聊天、Side Chat 和子侧栏。可见标题来自规范 Source part，完整URL目前主要在Tooltip，展开无摘要单Source会再次显示标题。207真实浅色图在~360px子侧栏中已显示这套信息，但标题重复与来源辨认是否构成需要修改的问题仍需实际交互判断。多Source、file/document、长snippet此副本不具备；不得合成记录代替。

观察阶段先用全原153 runtime 的新208副本，90应用表真实行内容直接一致，现有205共享启动审计仍适用：后台自2f63未变，原Source闭合；新端口/父工具/native deadline独立且不延期。当前d63f前端完整构建asset不变。实际正常生产 `/ui` 页面观察折叠/展开、长标题、可见origin（来源地址）、keyboard tooltip（键盘悬浮信息）、主动取消恢复、宽度重排及深色阅读。负责者亲自查看目标区域截图。无UI自动化测试、字符串/DOM断言或截图基线。

实现前必须据真实问题补充触发点、数据/控制流根因、旧路径不足、全部定义/调用/公共合同影响及最终方案，再修改。优先既有Source primitive和tokens（样式变量），保留实际分组/数量、真实身份/顺序、原生actions与阅读语义；不能制造第二metadata事实、代理消息或工作流gate（流程门）。无关Source类型、LLM（Large Language Model，大语言模型）调用和队列逻辑不在本轮改动范围。

结束前关闭自己的页面、唯一public shutdown并join原父工具/native输出及请求、精确进程身份/端口/pair；保留原失败/未知事实。若有修改必须补记录及索引、docs check、范围提交、fetch/merge上游、完整待推送集合审查后正常push，持续目标保持active。

## 真实问题与实施前决定

208当前真实页面 first Source 展开并人工查看 source-expanded-before.jpg：折叠长标题省略，展开后重复完整标题，但来源网址需要keyboard focus/tooltip才能辨认。顶部webfetch工具行本身URL也省略；标题不是站点身份，窄侧栏没有持续可见的规范host（地址主机）。此为显示信息层级不足，数据并不缺失。直接数据流Source part.url→SourceChip href/SourceTooltipContent，而SourceChip可见内容只有index/icon/sourceLabel；既有title/tooltip修复保证完整信息可达，却未使来源identity可直接阅读。

已全仓搜索 SourceChip/label/detail 和消息样式调用；主聊天、Side Chat、子侧栏复用当前唯一SourceParts，网页action来自main.tsx data-browser-preview-url处理，不能修改链接/调用行为。选择仅网页Source link内部增加由同一个url解析的host次级文字，保留完整可换行title、既有ARIA（Accessible Rich Internet Applications，无障碍网页应用属性）名称与tooltip及action。host保留端口，不删www，不用图标/标题猜provider。URL解析失败没有可证明host则不呈现host，原真实链接/tooltip仍按既有合同呈现。file/document和snippet内容、展开状态、组数和排序不变。

局部URL叶子正文包裹为纵向的title+host，使用既有caption/muted/gap tokens；file/document不改结构。CSS限定现有来源类，不增加全局link规则。两文件编辑前保存精确preimage，类型/build，自己的208页面只reload加载新asset再实际展开三来源/键盘tooltip与深色人工复核，避免新的独立frontend server。不会用不存在的file/document/多Source/长snippet场景冒充验收。

另一次主卡Open点击未显侧栏，已经保留open-from-card-observation.jpg；之后真实活动栏入口可打开。该观察的触发/根因尚未知，不能随意归因d63f或加旁路，此轮仅记录后续调查。

## 实际结果与闭合

已完成两文件小改；overlay types工具51327/构建工具63333实际退出0，构建49.43s及renderer public surface1/1通过。自己的208页面reload加载main-L1F0igr8，原生产请求21:33:24.361Z返回200。三真实来源域名、完整长title、原href以及浅色/Dark都人工查看；浅色Tab完整title/URL/provider Tooltip通过。点击第一来源正确产生自己的tab22/W3C目标页，实际标题/URL与截图已核对，随后关闭。最终折叠时浏览器自然显示更窄桌面布局，已记录实际截图，不扩为mobile资格；没有UI自动化测试。

自己的21/22均关闭。唯一public shutdown在原deadline1791495844599内收敛，21:35:51.498Z实际native terminal exited/0、physical/output/request完整；原父工具90185实际0且joinedreceipt绑定，独立Host68616/Target54068精确出生身份死亡、port18128/pair闭合。原153两个Project44/97项lstat元数据继续保持；5个本轮FFI（Foreign Function Interface，外部函数接口）观察器debug文件按精确出生时间和workspace边界移到私有目录。文档检查345ops/25groups通过。无凭据历史页面不作为新Sol验收，主卡Open原因及多Source/file/document/snippet/invalid/端口/流式矩阵仍未知。按范围提交/上游合并/正常推送后继续单agent。
