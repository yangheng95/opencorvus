# 330 文件来源图片查看与引用恢复

## Recall

用户持续要求独立深入体验、改善 Sources、修复真实问题；最新单 agent 要求覆盖旧 goal 的并行措辞。本轮 root 单独开发和验收，不启动开发或产品研究员。329 已补齐来源展开后的流式正文、关闭重开和成员列表返回观察，17 次真实 Sol 请求正常结束，提交 `1478da3e4504cae2aad328f38be59b3fb3798885` 已推送，工作区干净，所有自有资源收敛。当前不重复相同短会话。

最初调查历史文件来源失效；重读 222 后确认普通缺失、错误详情、重复失败和恢复已有真实覆盖。改为验证带行号的来源恢复及键盘焦点，同时调查代码发现的图片来源查看缺口。已读 SourceParts、file-workbench 目标/导航/范围与所有调用点、FileEditorPane 加载/错误/重载/保存、CodeEditor 范围揭示和焦点、File.read/readSource、真实 read 工具图片分支、PreviewableImage 及现有使用方、当前 07-panel/07-panel-reactivity、222/288/289/329 记录。检索到的 file-workbench-revision/mutation 是服务数据契约，不是组件/DOM 测试；本轮不运行或修改它们。

## 改动前分析

直接代码证据：read 工具读图片时返回真实附件和 source-file；File.readResolvedContent 已返回图片 MIME（Multipurpose Internet Mail Extensions，媒体类型）及 base64 数据；FileEditorPane.canEdit 拒绝带 encoding 的内容，视图仅按 textContent 区分 CodeEditor 和“不可编辑”占位。图片字节已有单一后端来源，查看能力却被可编辑性判断遮掉。普通 read 错误反馈与此无关，222 只修复加载失败，288/289只处理文本只读标识、查找及语言，没有接入已有图片预览。真实用户画面仍待验证，不能只凭代码宣布视觉复现。

范围是文件面板共享入口（Explorer、普通文字链接、Source）；候选仅从当前 FileContent 派生图片数据地址，使用现有 PreviewableImage/全屏宿主，保留同一加载、权限、目标、保存和重载所有者。图片呈现与是否可编辑分离，图片仍不可保存编辑。其他二进制文件仍保留既有说明。避免新增接口、磁盘读取、独立请求、影子缓存或第二预览器；不改 Task/Mission/Session 调度，不需要版本发布。风险为窄侧栏缩放、图像内容与文本切换、源读取失败重试、已有主题和全屏预览返回，均需真实页面复核。若发现调度/恢复等共享异常，按 AGENTS 横向审计，不凭最后标签归因。

## 实际验收计划

fresh NativeService 开发 `/ui`18301，成熟 launch-305/native supervisor 固定出生起600000ms边界和实际活动监督，累计12请求。已授权 OpenAI 凭据与完整 models 成对复制，分别验证 usable/projected/实际 gpt-6.1-sol 流式后才提交普通 Chat。输入为正常项目 Markdown（30 行，第24行标记 SOURCE330）和仓库已有 256px PNG 图标的原字节副本；不造 Source、界面状态或重放消息。模型仅真实 search_code 命中该行、read 指定 PNG、简短总结，不委派、不写文件。

root 在正常页面点击真实图片 Source，保存并查看改动前画面；只有确认占位问题才接入现有图片 primitive。类型检查与正常 overlay build 后仅刷新自己的隔离页面，原服务和时间边界不重置。验收图片、放大/缩小/关闭、窄侧栏、文本来源切换。文本缺失场景只移动本轮自己的输入到同 run 的 quarantine；逐个绝对路径确认边界并保留原字节，移动后点击第24行 Source 得到真实404。恢复同一文件后用 Retry，确认内容、范围和键盘焦点。禁止操作用户窗口或项目文件。

全部 UI（User Interface，用户界面）只用真实交互、截图人工复核，禁止 UI 自动化、DOM（Document Object Model，文档对象模型）/组件断言、浏览器夹具和像素基线。类型/构建不能替代截图。非 UI 公共契约没有修改时不制造单元测试。模型、网络请求和规范存储仅作数据证据。

结束关闭自己页面，原启动句柄 actual exit、Native/Host/output/request、端口与复制 auth/models 成对清理分别核实。归档脱敏证据，更新架构与根/月/目录索引，docs:check 后范围提交；fetch/merge、审查完整待推送集合、正常 hook/push。未完成项如实保留，goal active。

## 修改准入：真实复现

普通 Work/Chat 的真实 read 产生 source-image.png 来源；root 点击后亲见文件面板仅显示“This file is not editable in the overlay”，图片完全没有显示，原图见 source-image-330/screenshots/01-image-source-before.png。同一真实 file/content 请求返回 type=text、encoding=base64、mimeType=image/png，22168 字节与授权图标副本完全相等，证明不是文件/网络读取失败。

准入：在当前 FileContent 上派生图片地址，在原文本/其他二进制分支前呈现既有 PreviewableImage；用已有 Read only 标识替换无效的图片 Save。仅文件图片容器承担居中、滚动和窄宽约束，沿用现有主题变量、全屏图片宿主，不增加接口、缓存或状态源。文本范围、错误重试、草稿和授权保持原实现，并实际组合复核。

## 结果与 Recall 更新

唯一图片分支和局部容器落地。79118类型/20597构建实际0，当前main-D0irXPAg.js。自己108页面实际查看原PNG、打开全屏100→125→100%、关闭返回、280px窄侧栏；真实第24行Source在输入保管后404，Details保留原错误，输入原路径归还后Retry200、24行高亮和Editor焦点恢复，再点击图片仍正确。9张截图人工查看，完整[证据和边界](source-image-330/README.md)。只验收PNG来源入口，其他图片格式/损坏图片/每个文件入口未逐项验收。

普通Chat实际6次Sol流式EOF，两条Source身份和原文件恢复均正向核对；没有Task或子agent。自己108关闭，原2404 actual exit0，Native38452/Host77248/18301/output/request及复制auth/models完整收敛。已更新07-panel架构；文档检查与范围提交/远端同步后继续goal，不重置边界或用编译替代视觉证据。
