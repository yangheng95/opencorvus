# 流式正文事件与分组身份

## Recall

583继续长期自主产品迭代，单agent，无委派；旧Goal中的三Astra要求被用户后续单agent指令覆盖。上一goal turn分类progress：578布局544058b18、579字符阅读7abad3e86、580来源边缘a0f66c594、581Main/Side独立复验45422d065及582真实搜索失败证据8b57e2f9b已正常push main并fresh0/0，完整hook通过。源577 schema6/90表207330行字段时间/canonical/bytesmtime保持，所有自有scope/exec/native/launcher/physical/output/request/出生链及配对auth/models清退。582actual3gpt-6.1-sol流式200/原reader EOF；Exa原结构化rate_limited未产生Source，长摘录未验收。原高频Rendering仍未复现；不得重复旧修复、拿静态分析宣称根治或靠换服务规避限额。

开始HEAD8b57e2f9b、upstream0/0；51改动、171无关删除、21未跟踪项属于另一会话后台/API等，保留。当前Overlay相关源码与07-panel未被对方修改，无实际文件冲突，继续。用户18571窗口/服务/数据库不操作。不新建branch/worktree或开发agent。

已读当前AGENTS、02-data事件/Source复合写入、07-panel-reactivity、574/577/582与573完整projector记录；当前TextPart/model/markdown renderer worker、ConversationCard/CardParts/message-part/card-message-run、SubagentConversationPanel资源/live/target保留、subagent-conversation观察/HTTP对账/最终投影、processor text/tool input/200ms flush、Session updatePart/updatePartDelta与conversation-live-buffer。全仓搜索Rendering唯一定义/样式、PartRemoved和flush调用，未发现触及路径UI自动化；不新增运行UI测试。沿既有computer-use和benchmark-debug-template工作流。

## 修改前分析与调查方案

Rendering显示唯一条件是新正文owner的pending=true且HTML块数组空。CSS无依据pending隐藏已有正文的选择器。worker按owner串行解析，已有HTML不在每次append主动清空；正常初次渲染不能当作反复重建。

两个候选仍未知。其一，processor的定时全文checkpoint与逐chunk完整text delta可能在Bus发布等待时重叠，live完整snapshot按契约替代旧fields；必须核对真实顺序、初始空值是否有机会晚到，以及结束插件rewrite/trim是否合法，不允许按长度猜测丢弃规范snapshot。其二，pending Tool草稿Removed后正式Part接纳的真实间隔，若后方同Message已存在正文，位置分组可能合并/再拆分，改变文本owner。只有实际数据证明对应先后才进入下一步；不能凭Index存在盲目替换Key。

先只读完整闭合577与582的实际持久事件库存、事件类型及是否包含ephemeral delta/pending/removed，核对publication/sequence/time与canonical Part事实。若库存没有相关事件，明确其证据边界；不能用规范最终Part推断原流顺序。再决定是否建立私有被动Bus观察构建/真实普通会话或原成员有限输入，保持自然消息/模型流，无虚构事件/正文，无UI断言。新原生或Provider责任必须另补预算、auth+完整catalog、exact-model验证和20分钟/至少5分钟提前收尾条件后才启动。

本批当前不修改产品。若证实事件/队列/恢复/终态异常，立即按共享机制横审Task/Mission/Session全部入口、执行轮次、正常终态/重试/重启/串并行/多Project，并以实际代码、持久化及运行事实排除或确认共因。若证实仅UI所有者问题，也覆盖Main/Side/成员共享组件、Source/Tool/阅读与公开契约。修复前写明旧路径未根治原因、定义调用/数据/测试/文档/交付与风险，不增fallback/影子状态/协议别名，不隐藏Rendering或扩大缓存掩盖。UI负责者必须实际开独立/ui、逐张人工截图，非UI正向聚焦checker；文档/三索引/范围提交、fetch merge/全待推送审查/正常push照常执行。

## 库存事实与实际流观察方案（启动前）

两份闭合全库的bus_publication_outbox均只保留durable事件：577 message.created778/part.updated1048/message.updated1802/moved9；582分别781/1050/1809/9，无delta或pending草稿removed。message-bridge明确Message事件不写protocol_event，禁止从这些最终事实重建不存在的ephemeral历史。两源bytes/mtime均保持。本库存改变下一步：必须在新真实运行期间直接观察Bus，不能再用持久出库当完整流。

fresh隔离54073、完整577 schema6/90表207330行/canonical/PNG，启动前内存迁移registry7校验；新Node私有被动构建基于当前HEAD，仅记录Main指定Session的真实正文owner、Part绑定、HTML块数/pending、渲染后归零与普通cleanup快照，保留真实组件行为。原生GlobalBus仅追加选中Session的真实PartUpdated/Delta/Removed身份、完整文本长度/前缀关系及单调观察序号；不延迟/重排/注入事件、不改调度，不存完整第三方正文或凭据。

使用既有OpenAI授权+完整models配对，12次全批实际请求预算（memory/工作/重试均计数），全部精确gpt-6.1-sol流式。先注册凭据及模型投影，真实输入确认200和原readerEOF后判定可用；不额外预检或刷新复制OAuth。只对已有普通Main Work Session发一次有限输入：实际read原项目README第2行及第3行，各一次（允许模型自然选择串/并行），分阶段有限中文说明，零开发委派/新成员/Task/Goal/文件修改/网络请求。实际公开模型请求、自然消息/Tool及Source事实为准，失败如实保留。每个真实UI动作之后取状态、人工截图；不写UI测试。20分钟原生边界，至少5分钟提前public shutdown，原exec/native/launcher/physical/output/request/出生链与所有原reader结束后配对auth/models清退。完整源与目标原字段差异分别结算，使用源577而非目标prototype7。

## 真实流与控制事实

Node私有纯观察构建main-D00h6xUK.js/64秒，隔离54073/页259。实际普通Main Session原12消息→16消息/41Parts；自然read README offset2/limit1、offset3/limit1串行各一次（不冒称并行），两completed Source分别绑定其Tool，原path/range/sourceId/toolPartID与闭合SQLite一致、原读取输出含对应原文件行。实际assistant预告437字/msg_g0VYxewPY00LEDWpoFs6，最终2545字/msg_g0VYxf0Ng000XzRh3RNk，原role/Part正文逐字核对。4次memory/work精确gpt-6.1-sol streaming200，原reader全部EOF。

直接GlobalBus捕获2167事件（2008 complete-value delta/157 updated/2 removed），记录仅身份/长度/前缀关系/序号/时间，不存完整第三方正文或凭据；观测全文无倒退。两个pending Tool退休到running接纳实差6ms/8ms，退休时同一Message没有位于Tool之后且已可见的Text Part，故本次不能验证可疑分组合并条件。现有正确短snapshot/finalrewrite合同不修改，不按文本长度新增过滤。

新预告renderer owner26、最终42在样本中保持，HTML分别3块和增长到完整正文；原入口高频Rendering仍未复现。451条私有console诊断、四次DOM身份观察、六张实图已实际查看；仅观察/元数据，不是UI自动化测试或逐帧录像。

## 新线索：Main虚拟回收

Root scroll记录102普通cleanup快照：10个更早Part各2次冷启动退休，旧7104字Part prt_g0VYajYdB00dd6w7h51Z共40次、新user279字Part prt_g0VYxewLV00PQaVKzQNh共42次。旧长Part后续重挂载均命中已完成55HTML块/pendingfalse，不能冒称这些回收就是Rendering闪烁；两新assistant保持26/42，没有被这一回收替代。读取Virtua0.49.3当前实际源码：条目尺寸留在自身cache，取消ResizeObserver会删WeakMap归属；现阶段不能指称离屏0高度回调或整个Virtualizer/treeEpoch重建。缺少当时range/scrollOffset/各条目cache size/offset的关联事实，下一步需纯观察捕获该链，不盲目keepMounted所有历史或关闭虚拟列表。此线索覆盖Main的真实滚动/性能问题，尚不外推Side与非虚拟成员。

图03尝试点击当时屏外L2复制按钮后，页面仍在流式末尾，未取得Copied反馈；这只证明操作尝试未确认，不能判为onReadingIntent无效或follow被重置。图04实际上滚使followLock=false，图05原可见L2按钮真实Copied、剪贴板实际完整原path:2，复制资格基于这一步。六图caption按真实状态标明。第一次只读DOM探针因受限scope没有performance对象而中止，尚未fill/send；移除该非DOM时钟访问后正常继续，不是产品bug或重复发送。

## 数据、退出与交付

原exec6905join0/native0/launcher0，publicshutdown200提前582118ms，physical/output/request及精确出生链闭合；页259关闭、1auth/完整catalog配对清退，源auth元数据和catalog内容保持。源577 schema6/90表207330原行/全部原字段时间/canonical/bytes95682560/mtime1792828797672.7832保持，target7/integrity ok。目标旧memory_chunk/content-token-time、memory_file/time、两个容量槽和当前Session/time的真实更新单独结算，不写成目标全部字段不变。当前migration7只升级隔离副本，用户18571与迁移源码不操作。

本批只交付调查、6实图/非秘密元数据和三索引，无产品补丁。原高频Rendering、长SourceExcerpt和778实窗仍未知；下一批优先追查已见的Main虚拟范围/测量回授，持续单agent，只有实际冲突才等待。当前docs、范围提交、fetch/merge/待推全集核对和正常push按实证记录。
