# 248 流式列表与当前 Markdown 块

## Recall

用户要求持续自主体验和修复 UI（User Interface，用户界面）/UX（User Experience，用户体验）及功能，重点 Sources 和子侧栏 Rendering；最新只允许 root 单 agent。247 是有效进展：共享正文前缀已修、31 项正向后端检查、真实 Sol 关闭/重开恢复、两个原 Native/foreground 0、范围提交 cb241da6613d7663c5c80ba9dd840a2c258657bf 已推送且工作区干净。原 Research 子 agent Dock 的全程闪烁仍未资格化。已授权的 OpenAI auth 必须成对携带完整模型目录，实际 gpt-6.1-sol/streaming 分别预检；不启动子 agent，不操作用户 IAB23/18107，不创建 branch/worktree 或发布。

已读当前 text-part-model、TextPart、markdown-render service/worker、markdown 的 Marked 配置和安全 renderer、相关 CSS（Cascading Style Sheets，层叠样式表）、CardParts 全调用者、当前 07-panel-reactivity/typography、196 完成产物与滚动方案、231 真实流式记录、247 Recall/真实 before-close 照片。当前代码与 247 实际前端 main-D_-2LIPy.js 一致；root 重新呈现原 247 review-01 Working 照片，十二段列表中的第 6 段标题仍带 `**`，代码词带反引号，只有介绍是解析块。全仓搜索发现 renderer/model 唯一调用者，以及 Main/Side/子侧栏共用 CardParts、StaticTextPart 的 Goal/工具提醒/交互文档调用者；activeTextClassName 只有声明、无实际 caller。触及语义检索未发现对应 UI 自动化测试，禁止新增或运行此类测试。

## 修改前分析与影响

直接触发点为 markdown-render.worker 的 `visible.pop()?.raw`：streaming 时无条件移出最后一个非空 token，仅完成 token 交给唯一 Marked parser。当前 text model 把这个 token 的 raw 限成末尾 12000 字符，TextPart 以 plain div 显示。连续 ordered list 是同一个 token，即使前六条已完整也被一起保留为 raw，直到后续不同块或终态才解析。不是模型漏写格式，也不是 Source URL 数据丢失。247 修 backend 事实恢复、196 保留已完成产物和滚动意图，均未改变这条明确的渲染控制流。

当前 Marked lexer 已产生嵌套 token 树；[Marked 官方 lexer/parser 文档](https://marked.js.org/using_pro)说明现有 parser 直接渲染该 token 树。按本项目当前 token 解析整个已接受列表，可以保持嵌套、顺序编号、inline code/strong/link 等真实语义，不拆行、不猜测闭合符号、不为某些关键词添加白名单、不引入第二 Markdown 库或同步 parser。现有 raw HTML 转义、链接 scheme 与图片检查、代码复制、locale/icon/link context 继续使用当前唯一 renderer。

共享影响涵盖全部 TextPart/StaticTextPart 使用者；只有 streaming 最后一个块改为同样的 HTML（Hypertext Markup Language，超文本标记语言）呈现，static/completed cache 仍按完整输入/语言/复制标记保留原事实。内部 MarkdownRenderReply 移除 activeText，唯一 worker/service/model/component 同步删除该路径；不保留双显示或 fallback（后备路径）。无 public SDK/API（Application Programming Interface，应用编程接口）、Provider、持久层、消息、SourceParts 或调度协议修改。

Renderer 已有一 owner 的单 in-flight + latest queued request、全局单 worker、分帧 mount 4ms/16块、worker 8ms/16块。它们不改；该故障没有调度/唤醒/终态证据，原 247 所有 Native 0 与真实持续追加排除已观测场景的 owner 失活。当前末块随 delta 变化，使用唯一 parser 但不进入完成 token 的 512 条缓存，避免变化列表挤掉稳定块。相同完成 HTML 字符串保留当前 Solid For 身份；变化中的最后块允许替换，不能把选择文本/键盘焦点/大块性能保持当作已经验证。

## 实施与真实验收

沿原 `html[]` 分块回包呈现全部非空 tokens，删除 plain activeText 回复、model 信号、component 输出及仅服务它的 CSS 选择器；保留 visibleStreamingText/12000 限制给实际 InlineToolPart 预览调用者，不混淆工具原始输入与 Markdown 正文。不额外新增 mutable DOM patcher、并行配置、缓存或 text source。源码 diff/类型/build/docs 仅辅助，不是视觉通过。

纯 UI 修复，不运行 lexer/DOM/组件/文案/快照/浏览器 fixture 或 Playwright UI 自动化。当前代码前原照片已有真实失败；after 必须新独立开发 `/ui`，同样 Main 真实 MDN Sources→Side 十二段长题，在 Working 期间人工查看格式正确的列表/inline code，向上阅读首段与后来追加/终态，检查 Sources 真实标题与入口、同消息 canonical 正文、完整表格/代码和空输入。若实际照片暴露跳动/Rendering 或未取得关键运行帧，按原失败记录修复或补验，不能以类型、分数或 EOF（End of File，流结束）代替。

新 scope 预备 R2026-10-10/streaming-markdown-248-live-01、port18183、E streaming-markdown-248/live-01，成熟 NativeService 固定600000ms/累计12实际请求，auth/models 完整配对与 usable/projected/actualmodel/stream 预检。启动前备妥 sole shutdown、原 foreground join、独立 closure、完整脱敏 archive/facts/精确自身 pile；不得因等待图片延长预算，操作后立即关闭自建页面/退出。原246/247失败和晚于EOF的图片保持原边界；原子Dock、Tauri、全语言主题、长列表文本选择、性能与重启均需具体证据，未实跑明确未知。

交付同步 root/月/证据 README 和 current architecture，运行当前文档检查，审查精确 preimage/diff、只提交本轮文件，fetch/merge upstream、全待推送提交审查、保留 hooks 的普通 push。用户未说停，goal 保持 active。

## 当前结果与剩余范围

实施删除 raw activeText 的内部契约/信号/输出及唯一样式路径，全部 token 沿现 parser/回包；变化末 token 不挤占完成缓存，现单 worker/in-flight+latest/批次未改。无 UI 自动化。typecheck原50887 join0，build原43238 join0/51.39s、renderer surface1/1；新资源 main-t7w5atJn.js 已在实际页面。

新scope原fore25089、Target47384/Host51520、occurrence streaming-markdown-248-live-01-d5c27ea2-fc9a-4248-ab46-f0d148267fe4，完整pair/usable/projected/actualgpt-6.1-sol/stream预检。Main ses_-zUSPxmJuzzSR887zu40/Source4/结论282字符，Side ses_-zUSPxg3Jzzl87bIwGO4/继承4消息，真实233字符题/new Assistant msg_g0VXa2PIF00FAHBeAfsL/TextPart prt_g0VXa2QgM005YIzOone7。18:57:14.834 Working列表第4段已格式化，18:57:35.748 Working首段粗体/编号/inline code并人工呈现；均早于Source reader最后字节18:57:58.423/EOF.581/Message完成.637。18:58:01.644 SQLite observer实际已terminal，不称running；最终3586原始字符/3319显示/12条列表。18:58:23.983同首段仍可读，scrollTop407.3333435058594保持、height2586→4227、reading466→388，但header/输入区改变有真实布局位移，不声称像素固定。Sources3真实标题/域名和readSource原URL、表格部分视窗及代码末尾人工看过，输入空且可用72px；表格未全部行列视觉覆盖，不能扩大验收。

Own90立即close、sole shutdown、原fore25089 join实际0，Native原0早于固定期限、9/12 Sol stream200/EOF，独立closure0、9546新日志/unknown0、paired完整退役；所有observers终态后只移走5个精确本次pile。user18107/IAB23未动，无agent/branch/worktree/release。原247失败及部分不完整parser符号保留解释。未验原Research子Dock/全Rendering/嵌套列表/动态块选择焦点/高负载/全部主题语言；结束header布局与247所见自然结束改写time.start留作后续完整分析，不无分析顺手扩大本批。

最终辅助：docs:check 实际0（345ops/25groups），architecture-index实际0（18 current/links），git diff --check实际0。范围仅7个UI生产文件、当前架构、root/月/相关索引和本轮方案/原事实，提交前再检查staged差异；正常fetch/merge与全部outgoing审查后push，实际交付由Git提交/远端结果证明。本轮照片归档只规范AX换行与行尾空格，private原件保留，不编辑实际模型文本或截图。
