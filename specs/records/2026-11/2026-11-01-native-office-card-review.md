# 当前原生 Office 卡片复核

## Recall

用户要求持续自主体验、查清真实问题并修复、实际页面和截图人工验收、范围提交及正常推送；最新要求只用一个 agent，覆盖旧 Goal 中的多 agent 文本。上一轮是实际进展：849 的同名文件分配 ed185cab、850 的表格加载及当前编辑导出 45b22a787 均已在 origin/main；fresh fetch/merge 后 0/0，24 项数据合同、真实中英文编辑/下载、十二图、正常 hook 通过，原 176 项其他改动完整保留。850 的 Office 卡片视觉覆盖明确未完成，不能用电子表格或媒体图片代替。

本轮补齐该共享外框影响的真实 Office 入口，若出现新问题，先完成根因及横向影响分析、更新本方案后再修复。只用一个 agent，不操作用户服务、窗口或真实数据库，不创建分支/工作树，不发布，不增加 UI（User Interface，用户界面）自动化。

## 已读资料、搜索与影响分析

已读上一轮完整 Recall/结果、当前架构 07-panel 的原生 Office 下载合同，以及 ArtifactFrame、FilePreviewArtifact、PresentationArtifact、artifact-export、interactive-artifact/persist、work-artifact 工具、office-document、运行器及数据库迁移 0009。全仓搜索 sourceSha、file-preview@1、WorkArtifactAuthorTool、WORK_ARTIFACT_TOOL_IDS 和真实 Office 交付记录。

850 已把复制文件名的元数据读取与挂载后实际导出分开；FilePreview 和 Presentation 直接把真实 downloads 传给共用 Frame。原生源文件由当前完整 Tool outcome 的 sourceSha 选择同一 Project 内的附件，下载首项必须是实际 DOCX/XLSX/PPTX，复制行为应取同一首项文件名，派生 PDF（Portable Document Format，便携文档格式）及审阅图片保持其真实身份。此前零 Office 投影的隔离数据不能证明这一调用路径。

只读检查发现已退休的 office-save-export-598 原始测试库仍有三次真实已完成 work_artifact_deliver：周报 DOCX、一份工时汇总 XLSX 和紧凑预览 XLSX，均属于原 Session ses_-zUQxA1lPzzUZFA4CCxZ；三张实际 file-preview@1 卡片。库为 schema8/92 表/24573 行，没有 Task 或跨 Session 复制产物，源完整 Tool result 和原件可供当前版本读取。不把名称或模型自述当作交付证据。

598 的旧轮次虽然已 shutdown200、native/launcher0、物理/输出/请求结清且 auth/models 已退休，但旧收尾余量 131146ms 未达当时 300000ms 要求。该历史失败保留，不宣称已修正或延长旧期限。本轮只读续存其数据，在全新有限生命周期中验收当前页面。0009 对跨 Session 复制产物做数据保全；此源的该输入数为 0，预期新副本启动迁至9而所有原业务字段保持。原库仍保持8；这不是构建或用户数据库升级。

初次私有检查误查询不存在的 session.data，SQLite 返回明确错误；改为读取实际列后原检查完成，未启动服务或更改生产数据。

## 实施前方案与验收

建立全新 office-card-review-851/38490，完整备份上述92表、持久发布/配置、全部附件 namespace 和项目文件/Git（版本控制）事实；记录实际复制数，不根据旧46文件记录猜测现存数量。用当前已检查构建 main-VnTgbJSr.js，通过项目开发 serve 的 /ui 访问，不能独立启动 Vite。现有850完整数据源保持退休与不变，本轮不把两份数据库合并或插入旧消息。

851 新60分钟绝对期限只覆盖本轮，启动余十分钟、退出结清余五分钟，不延期或重启完成的发生轮次。既有授权 OpenAI auth 与完整 models 同时复制，启动分别验证凭据注册和精确 gpt-6.1-sol 投影；本轮实际模型请求上限0，累计1180保持，无新预检/生成请求。

当前真实 HTTP（Hypertext Transfer Protocol，超文本传输协议）回读原三卡完整 payload、来源 Tool 结果、完整 Session 和原件。实际页面打开 DOCX 与 XLSX 预览、放大与 PDF 阅读，检查本地化控件；下载菜单首项须对应原可编辑文件。实际浏览器下载至少一份 DOCX 和两表 XLSX，读取真实包内容及逐字节比较 canonical attachment；读取实际 PDF 页数/内容，不用文件名或静态字符串代替。复制按钮后原生粘贴到同一未发送草稿，确认实际原件文件名，再清空草稿；中英文重复必要入口并截图人工查看。既有用户/模型正文及文件身份保持原文。

若没有新故障，只提交这次已完成的实页覆盖与证据，不为制造改动重写正确实现；若确认故障，先补充触发点、数据流、共享调用影响、旧路径遗漏和明确输出合同，再实施、聚焦正向数据测试及真实页面重验。不得新增/修改/运行 UI 自动化、DOM（Document Object Model，文档对象模型）/组件/快照或像素断言。

关闭自有页，公开 shutdown200，原执行句柄/native/launcher0、物理/输出/request/操作系统出生链结清后退休配对凭据；核原库8/92表及全部源字段/附件/项目/Git保持、新副本9/92表业务保全，零用量新增。同步三索引、运行当前文档检查、范围提交；fresh fetch/普通 merge，检查完整待推提交集合，正常 hook 推送并再次同步。Goal 保持 active，后续继续当前产品体验。

## 本轮结清及用户范围修正

851实际读取原82条消息、三原交付及其完整Tool结果；HTTP回读DOCX6414字节、XLSX4853字节及三个PDF均200并等于原件。11张截图亲自查看；英文/中文复制首项原件名称及真实下载可操作，04首次复制探测得到旧剪贴板值，保留失败画面，之后通过当前可见按钮及原生粘贴分别核对工时汇总.xlsx和周报.docx，未发送草稿并已清空。

用户明确要求暂停其他迭代，先修默认全屏；当前调查立即作为[852普通预览窗修复](2026-11-01-in-app-preview-dialogs.md)的原始输入收敛，不继续其他Office功能迭代或新生成。旧展开从普通1280×720变成1920×1080系统全屏，正是后续修复的实际触发证据。

851公开shutdown200，自有页59关闭，原句柄5013/native/launcher0，物理/输出/request及出生链结清，auth/models配对退休，3024606ms余量。schema8/92表24573原行全字段保全，隔离副本自动迁到9后仅新增控制激活及grant各一行，24575行；原库仍8。58附件、8项目及Git完整保持，零新模型调用、累计1180，源授权/目录保持。私有checker已完成，不把旧598余量失败改写成成功。证据见[实图与核对](../../artifacts/2026-11-01-native-office-card-review/README.md)。
