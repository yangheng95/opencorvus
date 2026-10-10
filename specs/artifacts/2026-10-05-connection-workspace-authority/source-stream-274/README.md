# 274 当前来源与流式侧聊

[Recall 和当前方案](../source-stream-plan-274.md)。单root，无新Task/成员/branch/worktree，当前 `main-Dwe-Ur0q.js` 的真实开发/ui18213，不做UI自动化。本轮验证了新的真实分支，并发现搜索诊断缺口；尚无生产修改，不宣称整个目标完成。

Preflight独立核对现有OpenAI凭据usable、完整模型目录projected/pairedModels，实际gpt-6.1-sol/streaming true。Main `ses_-zUSN3DyTzzVifMgN72i`、Project `prj_hNEox3SA51tErhjRk1nM`，唯一真实输入 `msg_4ac40f83-ce92-4baf-a9b7-1c9159e9c97e`；实际 `websearch` call `call_7639f5ad29ed4e808b55fce71cbabe03`、原request Part `prt_g0VXcwnBk00fNu7ZpApY`，完整query和五结果限制保持。01是提交处理中，不能当正文或工具读图；[02工具running](live-01/02-main-active.jpg) 实际名字完整、长query省略且1 running可见。03已terminal，不能当来源到达时仍生成的证明。

[五来源展开](live-01/04-sources-open.jpg) 与 [实际摘录](live-01/05-excerpt-open.jpg)可读，group正确显示5、完整链接/域名与来源摘录；真实结果是四词典和一游戏插件，并非请求的官方HTML资料。Main回复明确承认未找到官方资料、无法据此确认键盘结论。原Tool output1069字符、provider open-websearch、attempts Exa0/Host5保留；Source本身准确显示收到的内容，不把本轮搜索质量要求包装成通过。只观察0→5，无1→多阶段资格。

普通Side `ses_-zUSN2fmEzzIGcbZhnAZ`真实metadata继承Main三条Message，[06原参考](live-01/06-reference-open.jpg)展开。Side canonical继承了原Tool事实，因此两request/outcome存储行同callID/开始时间/输出不代表两次网络搜索。唯一Side输入 `msg_f772a29e-9540-4bbc-8320-e1b47c08a498`、assistant `msg_g0VXcxU8P00Ow631uhGK`、text Part `prt_g0VXcxVCI00JzN5Dcvms`，最终3191个Markdown字符，当前可见plain3058；内容将事实限制与设计建议分开，不再抓取/写文件/委托。

[08实际partial](live-01/08-visible-partial.jpg) 06:56:31.138–31.454Z可见第2–3段；自己whole Dock06:56:53.049–53.384Z关闭，[10真实重开](live-01/10-live-return.jpg)06:57:04.688–05.131Z同Side1、Reference展开、Working/Stop仍在，后续第6–7段继续可见。原chat reader按同Side/user/assistantID唯一匹配，首byte06:56:07.485Z、末byte06:57:26.435Z，Message completed06:57:27.080Z，两个截图均早于结束，排除memory helper。关闭到下次操作约11.6秒，不称瞬间往返。10实际scrollHeight3247/viewport466/top2781.6001在尾部；这次仍follow tail，不是固定阅读锚点。08的错误DOM selector返回空数组，不能拿它证明scroll/pending或全文前缀相等。

11手动向上时已经terminal，plain3058字符；[11完成阅读](live-01/11-reading-anchor.jpg) → [13完成态返回](live-01/13-completed-return.jpg)保持top3600/viewport388/content4348与同表格段落。只能证明当前这些帧、实时尾部接续和完成态阅读；生成中固定段落、Side来源展开/摘录的全往返、原ResearchStudio Task、新live子Dock与全帧无闪烁仍未达成，不能替换成更窄结论。

自己122关闭后sole shutdown，原前台30572 actual0、8个实际gpt-6.1-sol流EOF（End Of File，流正常结束）/取消0、Native68560 exited0/Host67068。精确出生分别 `win32:639272118984390276` / `win32:639272118976280500`，原 occurrence `source-stream-274-live-01-bef03ae8-36de-410e-9c20-555d960667dc`，600000ms/12请求预算不变。06:58:29.270Z物理/输出/请求完成，固定07:01:37.609Z前188339ms余量，至少4分钟目标少51661ms，未满足，如实保留不扩期重启。独立出生死亡/18213释放/全部auth-model pair退休通过；完整日志与原输入输出/Source/reader脱敏归档，未改旧事实。

搜索质量调查：当前host adapter传入原完整query，安装open-websearch2.1.11的HTTP路径按完整query生成q，没有代码证据支持宿主主动只搜details。原Exa返回体未保留，原限流/无结果原因未知，Bing原HTML/redirect未取得，不按结果标题推断根因。关闭Native后，07:03:58.615–59.143Z独立无认证公共Exa JSON-RPC复核HTTP200/SSE实际result._meta[`ai.exa/rateLimited`]=true，isError缺席。共享exa-mcp当前只投影content/structuredContent/text、丢弃_meta；websearch又将无法解析的文本映射成[]，attempt只显示Exa0无原因。此代码和当前原协议信号证明诊断丢失会发生，但不能证明十分钟前原调用也恰好相同。未新增API key或绕过限流。下一批须先全仓审计共享MCP结果定义/调用/错误/测试/文档和真实协议，再修复单一数据流；Bing质量根因仍需原response证据。

当前helper/Observer实际完成后做文档/凭据/差异核对，再精确归档本Native的五诊断文件和范围commit/上游同步/普通push。原读错路径及数据字段的工具查询未改原事实；正确preflight读取preflight对象、actual audit用streaming/response_reader和activity.assistantMessageID，空property不是0或通过。Goal active，继续自主调查。

当前docs:check345ops/25groups、architecture-index18文档actual0，首次125公开文本凭据匹配0。原前台/shutdown/独立closure/archive、当前canonical观察和独立MCP诊断及三个checker都actual结束后，按精确Native出生与限定路径归档自己的五文件。原失败/空selector/未验范围保留，AX仅尾空白规范、私有原字节和实际图片留存。范围证据提交并正常push，下一批先审共享MCP协议结果/调用契约，不新增认证或绕过第三方限制。
