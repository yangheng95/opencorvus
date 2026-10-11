# 319 搜索命中的可点击文件来源

## Recall

用户持续要求自主改进 Sources、UI/UX（User Interface/User Experience，用户界面/用户体验）与功能，明确只使用单 agent。318 已提交推送 b68e3bc1dcf6451177101277b41008a1710167c4；本轮开始 git status 干净。前一目标轮属于 progress：实际代码、17 项检查、真实模型/页面证据和远端交付均完成。持续 goal active，不执行旧目标中的 Astra 委托措辞。

已读318 Recall、完整grep实现和描述、fileSource、SourcePayload/Range schema、Tool返回/截断包装、processor来源保存、source-persistence、SourceParts与file-workbench和FileEditorPane行范围入口、07-panel和capability-search-runtime。全仓搜索fileSource、provider标签、Source range与搜索测试调用。相关Overlay测试为纯状态/传输/模块解析；另检索到server的frozen-source测试是HTTP静态资源交付契约，没有页面渲染或浏览器自动化。本轮不运行UI自动化测试，也不把资源传输检查当视觉验收。

## 问题和影响

318真实会话搜索后仅有文本输出，read之后才出现Sources；持久化事实只有read来源。直接原因是SearchCodeTool的返回值没有sources。finalMatches已经包含实际绝对文件路径及准确行号；Tool/processor已有sources通道，SourceParts已有按范围定位的文件打开入口。此前修复路径解析与显示不能补齐生产端缺失的来源，不能从渲染文本或模型自然语言猜引用。

实施沿唯一fileSource/persistMessageSources通道，为每条实际展示的命中行生成一个文件来源，范围startLine=endLine=真实命中行。来源顺序与finalMatches一致，只覆盖当前展示的最多100条；省略的命中不发布来源。相同文件不同命中行保持不同身份；同一消息已有同一语义身份由既有持久化层去重。继续使用原路径授权、预算、部分成功和错误契约，不增加请求、重新读取文件或调度分支。空结果保持现有No files found契约。

当前Sources首条直接可见、其余显式折叠，已能承载多个行引用，不另建搜索专属列表。单行来源现在显示冗余的`2-2`；统一在既有label/detail使用相同局部位置格式，单行显示`:2`，区间仍`:2-8`。添加搜索来源的中英文provider显示文案，原provider标识保留在事实和tooltip title。无API（Application Programming Interface，应用程序接口）schema变更、数据库迁移或第二份Source状态；UI操作和读位走既有机制。

来源创建最多100次，增加少量来源持久化事件，需实际检查多命中时排布和定位。若出现队列/并发/恢复/终态异常，立即按共享机制横审全部入口和执行轮次，不能归为单场景偶发。目前没有新调度异常证据。

## 验收与交付

先更新真实搜索正向测试，让现有正确输出同时要求准确的Sources；新增同文件多行、100条展示边界检查。保留原真实预算/忽略/部分成功覆盖。先跑失败再实施；后端测试不使用模型stub声称端到端。UI修改只使用真实页面交互/截图人工复核，检查单行标签、其余来源数量、两个不同命中行定位与点击后读位。Input空区已确认由InlineToolPart显式collapsed控制，不作为bug修改。

正常构建后在自有开发`/ui18288`启动NativeService、12请求与600000ms物理边界；授权auth+完整models成对，预检分别确认usable/projected/实际gpt-6.1-sol流式。一个真实普通Chat搜索隔离项目的实际文件，要求只搜索，不以read补来源；不新建Task/子agent、不注入消息。人工展开Sources、点击两处范围，查看截图，再从真实持久化工具请求/来源验证一致性。若视觉仍有问题，修改后新轮次重验；不能仅凭build过关。

原启动句柄actual join与Native/Host/端口/配对清理后归档脱敏证据。更新当前架构、根/月/本目录索引，执行文档、相关类型/构建检查；范围提交、fetch/merge、完整待推送集合检查和正常push。原Research Studio子侧栏完整流式资格仍另有未完成范围，不能由本轮普通Chat替代。

## 实施检查

修复前真实SearchCodeTool正向用例失败，缺失准确文件/第2行的sources。加入finalMatches来源与既有UI格式后，25项后端测试/27断言实际exit0，覆盖3及125条真实命中（实际展示100条）、原有Task/Conversation预算、忽略、部分成功、共享协议和来源保存。UI自动化未新增或运行。中英文2124键检查通过；真实页面和物理收尾待完成。

live-01第一条真实用户请求只调用一次search_code，页面已出现三个Sources，分别定位同文件2/70行与second.txt第3行，截图01–04均人工查看。为验证共享格式函数保留既有多行引用，在同一普通会话再明确提交一次read offset2/limit3请求；此为单独的read回归观察，不替代第一条搜索生产来源的资格。Provider同进程12请求/600000ms边界不变。

## 完成本轮范围

五张实际截图、数据库与磁盘核对通过，多行标签/选区保留。8次实际Provider流200/EOF，原82663实际exit0、独立Native/Host/port和配对凭据收尾通过，证据已脱敏归档。[结果与未覆盖范围](search-sources-319/README.md)。生产diff复核仅增加工具Sources、共享单行显示和获取方式翻译，没有新增Source状态或API形状。继续完成文档检查、范围提交及正常上游同步/推送，goal保持active。
