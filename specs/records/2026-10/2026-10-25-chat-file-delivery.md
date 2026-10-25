# Chat 附件与真实文件交付体验

## Recall

用户要求单agent持续自主发现并修复当前版本的UI/UX（界面与体验）和功能问题，实际体验后提交推送；只在无法安全取舍的实际冲突等待。用户已明确Rendering闪烁早已解决，本轮不重复旧调查。上一轮db1fc5b30已交付默认选择框和Mission体验修复，本轮转入附件输入和文件交付完整操作。

开始HEAD db1fc5b30。外部营销、消息Move、CI及历史文件删除等工作区改动保持，不混入本轮。没有子agent、分支或worktree，也不操作用户18571服务或页面。已读AGENTS、现行07-panel文件阅读/编辑公开合同、02-data附件身份合同；定位FilePart、ArtifactResourceDownload、FilePreviewArtifact、file-download，以及真实Provider预检和原生服务启动/关闭工具。相关旧记录只用于理解现行合同，不重跑历史待办。

## 实施前方案与验收

1. 从当前工作区以Node正常构建UI，独立新空runtime和自有项目经开发服务`/ui`人工体验。手工上传无敏感数据的四行工时CSV（Comma-Separated Values，逗号分隔值），在单Chat中要求实际模型读取附件、生成中文周报Markdown及工时汇总CSV并给出可点击文件链接。计划36小时、实际25小时，逐项偏差和报告应基于真实输入。用户已授权OpenAI凭据使用；启动业务前分别验证凭据、完整目录投影及实际gpt-6.1-sol流式请求。整个scope最多16请求，包含预检和后台，不重置上限。
2. 实际操作覆盖附件选择、上传后名称/状态、流式任务、最终答复、打开报告、CSV阅读及下载。以截图人工复核；读取真实生成文件验证内容与原始字节。模型不能由脚本预写交付物代替；不建立Task/Mission或多成员。仅自然输入、模型和工具消息可见。真实输入示例不是UI自动化fixture，不增加或运行UI自动化测试。
3. 找到当前问题后，先补全现象、直接触发、控制/数据流根因、旧路径未治原因、全仓定义与调用/公共合同/数据/测试/文档/交付/风险分析，再修改唯一当前实现。非UI行为需聚焦正向合同；纯UI需新正常publication、真实交互及重新截图。未复现不预设缺陷，不为凑改动添加能力。
4. 自有原生服务20分钟物理边界，提前至少五分钟公开关闭；原native/launcher/caller、请求和输出结清后清退成对auth/models副本。使用完整目录且不输出凭据，不复制或迁移用户数据库。当前没有新调度或终态异常；发现时按共享机制横查，不能以单场景通过降级。
5. 更新本记录和三索引及产物README，执行对应类型/构建/本地化/文档检查。所有本轮改动结束前精确提交，fetch/merge上游、复核完整待推集合、正常hook推送。文档/检查不能代替实际产品修复和页面验收。

## 当前状态

真实54094/ui已上传工时输入.csv，单Work Chat ses_-zUQxA1lPzzUZFA4CCxZ由实际流式Sol读取附件、apply_patch生成周报.md与工时汇总.csv并read回核对。文件实物和页面均证明计划36、实际25、偏差−11，原状态保持。报告和CSV的最终正文链接与Sources均能打开正确文件；附件名称和身份当前正常。本轮没有新的队列、恢复或终态异常。

## 修改前根因与范围决定

两个真实交付文件打开后的工具栏只有保存、重载、关闭，没有下载操作。“保存”调用项目PATCH写回，不会下载；用户已拿到交付链接，仍无法从阅读位置取走普通文本成果。这是当前文件工作台的功能缺口，非模型生成失败或链接身份错误。直接触发为正文链接/Source进入FileEditorPane；根因为该统一阅读器只接入write/reload/close，从未接入已有downloadBlob。旧ArtifactResourceDownload只服务Artifact资源、FilePart只服务消息附件，均不会渲染普通项目文件工作台，所以它们的下载修复没有覆盖此入口。

已全仓搜索FileEditorPane、FileContent、downloadBlob、artifactExportBlob、同类Icon和file_editor文案；读取FileEditorPane完整状态/保存/重载/离开合同、file-workbench目标和SDK类型、后端readResolvedContent、共享file-download和artifactFilename。文本读取返回完整UTF-8（Unicode Transformation Format，Unicode转换格式）内容，编辑器保留原换行和BOM（Byte Order Mark，字节序标记）；binary类型的content为空，是预览描述而非可下载字节，图片/PDF另用base64。因此本轮只为已经完整加载的普通文本增加下载，不从binary空内容制造空文件，不新增后端读取旁路或并行资源状态。

唯一实施点FileEditorPane：复用当前draft与已有downloadBlob，下载当前可见文本，文件名使用既有fileTitle；未保存编辑时标题/无障碍名称明确“下载草稿”，不偷偷保存、不丢失dirty状态。文本为空也能下载，UTF-8编码及原换行不转换、不附加CSV BOM。加载/保存/重载/导航预留期间沿用当前isBusy/fileEditorReserved禁用；同步点击不引入异步资源归属竞争。使用既有download图标和按钮原语，并补中英同键文案。范围不含二进制全文件下载、Markdown渲染预览或格式转换，不改API（Application Programming Interface，应用程序接口）、schema、持久化、Provider、调度和模型提示词。无死路径替换、无关清理或双源。

相关file-download-authority测试是纯服务契约，没有DOM/组件渲染，本轮不修改或以它代替视觉验收；本次没有新的非UI算法，仅把共享下载原语接入现有文本界面，不新增UI自动测试。风险为取错文件名/下载旧文本/换行变化及下载误写项目，需修复后手工实际下载原周报、CSV及未保存草稿，读取下载实物与原文件字节/当前草稿对比，并核对原项目文件保持。新publication复用关闭后的本轮完整数据，不能重建假成果冒充原任务回读。

before已公开shutdown200；原exec86140/native/launcher退出0，物理/输出/请求完整闭合，11个Sol流式200原reader EOF，保留1046053ms关闭余量，成对副本退休。用户认证和目录原内容/mtime保持，用户库未复制。

## 修复后的真实体验结果

FileEditorPane接入共享downloadBlob，只对完整文本显示下载按钮；当前dirty状态直接决定“Download draft / 下载草稿”，保持原文件身份、草稿、保存与离开确认。仅3个生产文件，无API/schema/模型/调度改动。普通Node publication由main-xnv1RDfj.js更新为main-B11LDDBn.js，均无诊断插件或UI断言，构建分别194秒和89秒。

after从关闭before的schema8、92表2866行完整序列化到新的独立库，并继续使用同一自有项目目录。首次页面回读附件404的原因是我的验收准备只复制数据库，遗漏数据库路径隔离的物理附件namespace；已读取AttachmentStore.storageDir当前实现，将原自有附件及sidecar共4个文件原字节复制到目标库对应namespace，再重新加载隔离页。源库/源附件保持，补齐后原用户消息、附件和Sources正常。该准备失误不记作生产缺陷，也没有改产品身份规则或重新上传替代原输入。另一次过早打开页面发生在服务尚未ready前，ready后正常打开原会话；未重启原caller或重置请求上限。

真实275页面继续原ses_-zUQxA1lPzzUZFA4CCxZ，手工点击原报告和CSV正文链接，再点击新下载按钮。浏览器实际保存周报.md（1581字节）、工时汇总.csv（196字节）及只读Sources中的工时输入.csv（159字节），三份逐字节等于实际模型生成物/原上传，中文文件名准确。报告和汇总保留LF，原附件保留CRLF。完整文件阅读、命名、只读身份和下载都经截图人工查看。

手工将CSV编辑为两行草稿，下载草稿实际82字节，等于当前编辑器文本；原LF编辑器的换行策略保持，未误以本次输入的CRLF改变原文档格式。再清空草稿，实际下载0字节文件，未把空文本误作加载失败。下载后dirty/保存状态保持，原项目CSV仍为模型输出。通过既有确认“Discard and reload”恢复后，保存禁用、下载恢复原标签。中文设置切换后同样呈现“下载草稿”，放弃并重载后呈现“下载”，原始数据和日期语言正确。没有保存这些草稿，也没有新模型业务请求。

9张实际页面截图、原输入、两份真实成果、草稿样本和安全摘要在[本轮产物](../../artifacts/2026-10-25-chat-file-delivery/README.md)。未新增/修改/运行UI自动化测试；实际下载的字节核对证明原数据内容，不是可变源码摘要检查。Overlay类型、i18n（2语言2537键）、docs:check（350操作/26组）已通过，正常构建通过。

after公开shutdown200，原exec29517/native/launcher退出0，物理/输出/请求完整结算，余983997ms；after请求0、全593共11/16实际流式Sol请求，全部原reader EOF。成对auth/models副本均清退，原认证大小/mtime与目录完整内容/mtime保持。原库全部92表2866行/字段、源库字节/mtime、canonical配置、schema8和两库integrity保持；目标仅正常启动新增engine_control_activation_lease和grant各1行，无原行修改/丢失。两个原交付文件保持。自有页273/275关闭，274仅为过早导航产生的临时错误页；用户18571、用户窗口和真实数据库未操作。

本轮达成为普通文本交付下载功能，不宣称二进制全文件下载、Markdown渲染预览或全产品验收完成。其它会话的CI文件系统修复和营销暂存交付继续保留；本轮精确范围提交推送，不因无实际冲突而等待。

交付原CSV包含真实CRLF，根.gitattributes默认LF会改变证据字节，因此按已有证据规则仅为本目录CSV关闭text规范化并允许其CRLF；不改全仓或业务文件规则。提交时比较实际Git blob和原下载完整字节，证明原下载对象身份，不将源码摘要当成功能验收。renderer公开面检查通过。
