# 333 空文本来源与附件预览

## Recall

用户要求持续自主体验并修复 UI/UX（User Interface/User Experience，界面与体验）和功能问题，重点 Sources 显示；最新只使用单 agent，覆盖旧 goal 的多 agent 措辞。上一轮332已提交推送 f70c44b10d32467c89d48c49ab9063328912a3e1，开始时工作区干净。上一目标轮有实质进展：PDF 来源与读位修复、真实页面证据、提交和远端一致。

本轮从332触及的 FilePreviewArtifact 发现空文本判断候选。已读唯一 TextPreview/loadText、FileEditorPane、InteractiveArtifactPart 与 ConversationArtifactInspector 调用方、InteractiveArtifactAttachment/FilePreview schema、publishInteractiveArtifact 规范校验、AttachmentRoutes 上传接口、当前07-panel和既有CodeEditor只读记录。全仓相关定义/调用与历史检索未发现第二 TextPreview 实现；检索到的 session-debug 测试只验证会话诊断数据，与 UI 无关，不运行 UI 自动化。

继续使用既有 benchmark-debug-template 的分析、真实验收、修复和复核流程；用户 AGENTS 明确要求 UI 仅真实交互/截图人工复核，因此不采用自动视觉或组件断言。沿用已有自有 NativeService 运行器和其真实输出/请求/物理完成证据，不操作用户进程。其180秒无活动观察与原生600000ms固定成本上限分别记录，不能把超过观察时间当作进程结束，也不因等待续租或重新启动同轮。

## 修改前分析

现象目前是代码线索，真实页面尚待确认：TextPreview 的 `!text.loading && text()` 对成功返回的空字符串为 false，会继续显示 Loading text。loadText 返回 `response.text()` 的确可以是空字符串。附件 schema.size 为 nonnegative，真实上传直接存原字节，发布验证 canonical SHA、MIME 与 size，因此0字节是当前合法数据，不能靠拒绝空附件规避。332提取PDF阅读器时保留了文本分支，旧真值判断仍在。

影响入口为实际 file-preview@1/kind=text 交互附件；PDF、FileEditorPane 的文本来源与其他 Artifact renderer 不应混改。资源加载/失败与正文内容必须由现有同一 Solid resource 表达：区分 loading/error/resolved，而非额外 bool/cache/fallback。原 CodeEditor 已支持空文本及只读属性。候选局部改动为成功加载后呈现空编辑器，保持原资源权限校验、原始内容与只读。失败资源读取必须先由 error 分支保护，避免未被消费的 resource.error 抛出。最终实现以实际基线为准。

本问题暂未涉及 Task/Mission/Session 调度、并发或终态恢复；如真实运行出现此类异常立即按共享机制横向审计，不能归因于模型。无接口、SDK、配置、持久化或模型工具变更；非UI契约如果未改变，不新增只镜像实现的测试。风险：空内容/普通正文、初始加载、失败资源、重新打开和现有只读编辑器。

## 真实验收方案

先 fresh NativeService `/ui`18306/live-01，以已授权 OpenAI auth 与完整相邻 models 成对复制并独立预检 usable/projected/实际 gpt-6.1-sol streaming。累计12请求、原生出生起600000ms上限。准备普通空文件及非空中文文本，通过实际 /attachment 上传0字节及原始对照字节；只把接口返回的 canonical reference 提供给正常 Chat，要求实际 read 空文件并由 publish_interactive_artifact 分别展示两份文本。所有消息与工具均为实际参与者产生，不直接写数据库或造 Artifact。

root 在真实页面查看 Sources 空文件、空预览与对照预览，截图保存失败基线后才准入修复。关闭自己的页面，完整收敛首轮服务/复制配对后，执行前端类型、构建；用新构建 fresh18307/live-02重复同一实际输入/工具链，人工检查空文件呈现、对照正文、只读、展开/返回及重新加载。UI不写/跑自动化测试，也不以DOM文字或类型检查替代视觉。

归档实际 Provider 请求、canonical消息/工具/附件、真实原字节身份与物理终态。正向证据checker只核验后端事实，不断言页面。同步根/月/目录索引和当前架构，运行package.json的docs:check；范围提交后fresh fetch/merge、审查完整待推送集合、正常push并确认远端一致。goal保持active，下一轮仍单agent。

## 真实基线与修改准入

live-01普通Chat实际read空文件并分别调用publish_interactive_artifact生成两个预览；root亲见Sources空文件编辑器正常、83字节中文对照正常，而0字节预览在内嵌与展开视图均停留Loading text。截图01–03已逐张人工查看。实际附件GET均200，空附件bodyChars=0、对照57字符/83字节，且真实引用已经服务端canonical校验。最初探针误用带尾斜杠/attachment/得到404，改用路由声明的/attachment后正常；该探针错误不算产品缺陷，旧输出保留在私有辅助目录。

官方 [createResource](https://docs.solidjs.com/reference/basic-reactivity/create-resource) 将ready定义为成功获取；[Show](https://docs.solidjs.com/reference/components/show) 按when真值分支。准入仅将TextPreview成功条件改为现有resource.state=ready，直接把原始text传给既有只读CodeEditor，删除原truthiness回调，保留错误/加载及权限校验。没有新的数据状态或默认占位字符串。所有公共契约和非UI代码不变。

页面113已关闭，原launch31983实际exit0，7次Sol流式EOF；Native75100/Host76332/18306及输出请求、复制配对已收敛。现在实施并构建，再进入独立live-02修复后验收。

## 执行结果

局部状态判断修复完成，前端类型68579/构建88319均实际exit0；新构建50.85秒，实际18307服务引用main-GO3xt7j4.js。第二轮正常Chat实际read和两次publish产生原0/83字节预览；root查看空编辑器成功、非空正文完整，两个只读预览经真实按键后内容保持，展开/返回正常。实际点击下载得到0字节文件。刷新自己的页面后从历史重新选择原对话，再打开空来源，空预览与Sources编辑器均正常。截图04–06已人工查看。

第二轮原launch64183实际exit0，7次Sol流式请求全部200/EOF；Native68840/Host76600/18307及输出请求、复制配对清理完成，114页面关闭。实际接口正向checker确认两附件200/原字节一致、空来源200/type=text/content为空。详情与明确未覆盖范围见[333证据](text-preview-empty-333/README.md)。后续仍单agent持续推进，不将本轮通过视为整体产品完成。
