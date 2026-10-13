# 当前基线长正文与来源阅读

## Recall

用户要求持续自主迭代、重点修复Sources和成员侧栏Rendering闪烁，最后明确只使用单agent。旧goal的Astra并行文字不执行。上一轮405为progress：c641a01b9410d91d41aa2b0e48b0dac0767cd087已由远端main确认，11张人工复核截图、7条真实主来源与7条引用副本、12次gpt-6.1-sol流式EOF和正常物理退出已交付；它只证明短主会话及侧聊引用，没有长成员/缓存边界资格。当前HEAD另有已提交compaction改进及其他任务的未提交权限/会话改动，保留、不混入提交。

已读405 Recall/事实checker、349的37正文与主区跳位限制、TextPart/createStreamingTextPartModel、Markdown worker完成缓存32项/400万code unit合同，以及成熟NativeService启动/关闭和Sources公开契约。本轮应用benchmark-debug-template技能；其UI自动判定/无人值守示例服从用户更明确的禁令：UI只做真实交互、截图和人工判断，不新增DOM/组件/源码/截图自动化测试。

旧用户库已按要求清除，本轮使用新建版本1隔离库，不恢复旧库。凭据和models目录从已授权的原配置配对复制，内容不进入日志或提交。只运行一个产品工作会话，侧栏仅查看其真实继承历史，不派发工作子agent。

## 任务与输入输出

输入是本轮自有QA项目的README.md，含36个四行的独立阅读条目，共144行。条目是明确的产品阅读/操作要求，只作为真实工具要读取的源文件，不伪造任何Message、Tool result或Source。模型应按R01—R36依次读取相应四行，每读一段正常输出60—100字的独立中文解释后继续下一段；最后自然结算。所有段落必须来自真实流式模型和正式Read工具，禁止脚本直接填充会话。

合格输入链路：至少36份不同的assistant正文和36次对应Read完成事实；36组精确行范围的Source都绑定原Message的completed Tool。来源来自同一文档的不同区段，不声称是36份不同研究资料。部分完成、批量读取或同一长正文均不能冒充正文数量门槛。

## 现象、机制和风险

现有完成缓存32项使大量独立正文重开时可能需要普通首次渲染，但它不等于连续更新闪烁。TextPart仅pending且frozenHtml为空时显示占位；已有正文应保留。真实缺陷候选是live主区更新导致历史owner替换、Virtualizer锚点改变、侧栏开关宽度变化和静态引用重投影。349记录过worker结束附近主区跳位，尚无确切写scrollTop者证据；不预先扩大缓存或隐藏占位。

共享影响面包括主对话、Side引用和成员共用的正文/来源组件、历史分页/虚拟化/阅读锚点、渲染调度及全部调用、语言、打开/关闭与冷缓存。成员专有入口本轮仍未直接覆盖，保留后续项。暂不修改生产代码；若发现调度/恢复/终态异常，立即审计共享Task/Mission/Session入口、重试重启和多项目，不以单例通过缩小问题。

## 环境与超时

复用405正式开发serve及冻结UI bundle，经localhost:18519/ui访问，不启动独立Vite。新自有runtime/project/Bun位置使用long-source-reading-406命名。使用实际gpt-6.1-sol流式Provider，累计上限56请求（含预检、memory等产品辅助）；启动前分别证明credential usable、catalog projected、实际model一致。QA文件在首个Project创建前写入并正常Git提交为输入基线。

真实请求超时按180秒无活动判定，复用RealProviderAudit/生产活动合同。NativeService保留独立600秒物理所有权上限，用于自有服务和凭据回收，不将该上限当作性能合格或问题根因；若上限先到，只记录未完成和真实边界，不延长已启动owner。只轮询已确认存活的原句柄/过程；不因观察超时重启，不持续tail日志。

## 验收与处理顺序

1. 首先建立真实输入与运行，保存模型/工具/来源事实。正文早段已就绪时停在R04附近阅读，记录真实截图和只读几何辅助观察；后续真实输出继续时再次人工查看同区域，不能以DOM数值替代视觉。
2. 运行中打开侧聊引用历史，浏览已继承的真实早段，开关侧栏并观察主区锚点。后端达到至少36份独立正文后，再实际浏览历史并关闭重开。保存阶段对应截图，区分流式、完成和首次冷渲染，不把完成后重开说成流式重开。
3. 后台checker核对实际会话/模型身份、正文/工具数量、行范围、Source绑定、完成和引用复制关系。视觉只人工判定正文/来源是否可读、展开是否保持、旧段是否被重复占位或意外跳位。
4. 有真实失败先追加完整根因/影响分析再修复唯一当前路径，再回到相同场景复验；不加UI自动化、不做模型/界面双路数据。若本轮没产生目标形态，保留失败事实并修正输入/运行器，不宣称已通过。
5. 关闭自有页面并公开shutdown，取得原Native/Host/output/request/端口退出与复制配对清理，join原句柄。范围归档、文档检查、提交、fresh fetch/merge/待推送审查及正常push；goal继续active。

## 当前状态

首轮真实运行已完成：主Session ses_-zUS2EY0ezzjFidQwBy1有37份不同的完成正文、36次completed read和36组行范围；41次实际Sol流均EOF。原句柄88359已join exit0，Native86900/Host88984正常退出，auth/models副本清理。数据仍留在本轮私有版本1库。最初observer将SQL关键字limit用作未加引号别名，已改为requested_limit后重跑；它是调查脚本错误，不是产品失败。

03图仍处于R02—R04的早段，主回复已完成；点击New side chat建立包含38消息的Side chat 2、展开引用历史并只滚动右栏后，04图主区跳回用户请求。只读几何记录主scrollTop=0；重新将主区滚到R03—R05后，单纯关闭/重开侧栏06图保持scrollTop=720。01早段live时scrollTop=472.8。当前证据尚不能区分新建侧聊、首次加载长引用和主树替换中的具体写入者，不能把“新建侧聊”直接当作代码根因。UI日志同时记录286次ResizeObserver未交付通知，不能凭最后错误字符串认定根因。

另一个明确体验缺口：主首轮未完成时创建的Side chat 1，其inheritedMessageIDs为空且界面无解释。Session.fork明确只复制finish不是tool-calls/unknown的完整回复前缀；这是当前架构合同，不应为UI补数据或复制不完整执行。SideChatPanel现有空态只显示通用提问建议，缺少“创建时没有可继承的完成历史”的说明；后续沿现有metadata事实增加本地化提示，不改fork合同。

下一步先复用这份真实新基线历史做只读页面定位。以现有Native owned-host入口包装正式serve；不发新模型请求，不重新复制凭据，先验证历史列表/已有Side chat能在模型未连接时读取。新服务有独立启动receipt、原句柄和public shutdown。若必须新建侧聊才复现，再准备明确配对及模型预算，不能把缺失认证当成历史读取问题。

为定位滚动写入者，允许在当前Conversation的已有resize/scroll/tree-replacement回调临时加入AppLog.debug，只记录尺寸、scrollTop、读取锚点和替换原因，不写DOM、不加UI断言、不改变控制流。代码原差异先保存。诊断覆盖共享主Chat/Task/Mission reader、Side/member/Source的独立scroll owner和正常/复开/树替换路径；根因未确认前不改恢复策略或放大缓存，临时诊断完成后撤下。

只读诊断02复用真实历史、已有侧聊展开保持837.33的阅读位置；新建入口返回ProviderModelNotFoundError，符合未投影模型的环境事实。原句柄71331已join exit0、Native65424/Host89928已正常物理结算。下一轮诊断03沿同一个正式启动/audit/配对装载实现复用已有runtime和project，仅将初始化改成验证已有配置和目录，不改任何已有Message/Source。请求预算20次（包括预检和辅助），600秒独立物理租约；真实请求继续180秒无活动判定。关闭后必须先取得Native整体结算和进程身份消失再清理配对文件，父启动器已绑定该清理。目标是缩小新建路径及长历史投影/缓存引发主区变化的原因，既有输入输出门槛与人工视觉规则保持。

## 已确认根因与实施方案

诊断03在认证装载前因调查器将生产写入的`$schema`和terminal配置当成非法额外字段而失败；原Native27772已物理结算、配对目标回收。改调查器只验证本次所依赖的模型/profile字段，保留正式配置其余字段，诊断04预检实际gpt-6.1-sol流式成功。图11主区停在R06，创建Side chat 3后尚未展开引用，图13已跳到起始用户输入。POST完成8929ms；紧接健康恢复与`connection-rebind` hydrate。20:58:08.976的主treeEpoch3/preserve记录总高度827，随后恢复6319而scrollTop为0。New side的行为只是触发条件；通用主阅读恢复存在确定缺口。

直接原因是Conversation的treeEpoch分支对preserve只调用contentChanged，保留旧滚动控制器；同一组件的VirtualizedConversationCards却按treeEpoch重建Virtua。旧DOM被替换时浏览器会压缩可滚动范围，旧控制器在非following状态不写回锚点；仅检测宽度变化的measuredContentChanged也不能修复同宽树替换。现有anchor保存和bindReader/resumeReading已经负责消息身份、分页、异步Markdown几何就绪、输入取消、authority校验，无需新增平行位置缓存。修复统一让每次树替换重新绑定该reader，按已有记忆恢复非following的Message/Source锚点，following仍走原底部跟随；删除只在preserve时跳过恢复的分支。临时诊断全部撤下。公共API、数据库、fork/Source/消息协议和LLM流路径不变。

横向审计：全部生产resetWriter调用仅在conversation.ts三处，覆盖resetConversationProjection、hydrate和Task tail merge；Session/Task/Mission选中/失败/删除/归档/workspace退休由这些入口进入。完整连接恢复复用loadConversation，普通Session SSE快照合并和Task事件重放仍保留现有挂载数据；旧页追加使用现有独立锚点，未重建树时不触发本次绑定。reader的唯一key含API authority revision与Source kind/id，异步恢复仍检查source/history ownership，跨Project或已退休selection不能落回旧锚点。普通/终态、重开和重连共享该组件，不依赖执行epoch或模型状态；并发请求仍由服务的replay/tailMerge代次收敛，改动不改变其协议。Side/member独立scroll owner只接收自己的输入，不加入主恢复实现。代码覆盖不等于运行验收：本轮真实复验首先覆盖完成Session长历史；Task/Mission/成员入口与重启/并行多项目仍保留未验证项。

POST耗时与健康超时之间的事件循环阻塞存在证据，但具体持久化成本尚未知，必须继续按共享fork/消息写入机制调查，不能把整项问题判成侧聊局部。当前实现先修已经证明的通用阅读丢失，不修改健康超时、隐藏错误、绕开重连、扩大缓存或伪造数据。验收重新构建正式UI，保留相同真实历史并新建另一侧聊，查看早段锚点、来源展开/复制及侧栏自身历史，另做空引用提示；最终checker继续区分36份来源行范围和克隆。

## 本轮验收结果与续项

当前修复在正式构建后由05复验。新建Side chat 4保持R06—R08；该次没有健康超时，因此另从设置原样保存同源连接，实际服务日志21:04:23.203—.244记录主conversation重新加载。图17还处异步几何恢复，图18结算后回到同一R06段、scrollTop1260.6666和总高度6319，引用历史的展开状态也保留。图19/20展示新增空引用中英文说明，图21确认只滚动引用历史时主正文不动。复制曾在原生控制点击路径粘贴旧MDN网址；使用CUA内浏览器控件点击后，clipboard与真实粘贴都得到完整README.md:9-12，图22/23保留差异，不据此改产品剪贴板。没有发送这些粘贴草稿。

05准备时复制路径错误写成dist-vite/ui，原命令未因非终止PowerShell错误而停下。立刻检查正式构建输出和overlay-ui冻结来源，实际服务在启动时使用当前workspace dist-vite；补齐独立bundle后没有重启或冒称该bundle是已加载来源。后续准备器应先验证实际目录并设ErrorActionPreference=Stop。03、04、05运行与清理证据分别保存；04原句柄93563、05原句柄12333均join exit0，Native whole-job/output/request完成后父脚本检查原Host/Target身份消失及端口释放，再回收auth/models配对副本。

真实checker通过：主38消息、37不同正文、36次read与36来源行范围；Side 1继承0，Side 2—4各继承38条消息和36条来源，payload相等并重新绑定Tool身份。47次实际模型请求全部gpt-6.1-sol流式200/EOF。Overlay build/public-surface、typecheck、i18n通过；没有UI自动化。见[完整证据](../../artifacts/2026-10-14-long-source-reading/README.md)。后续优先继续分析长历史fork同步成本和健康恢复链路，再补Task/Mission/成员专有的真实场景；goal保持active，不把这两个修复宣称为全部UI问题完成。

交付复核发现并已修复一次本地提交归属事故：准备的独立索引基于e91191975；正常commit执行前并发任务提交46926caf7，长时间索引同步准备未再次检查HEAD，1d07e88a1因此带回33个其他任务文件的旧版本。停止的是本轮自有Node包装进程，原Git提交已完成；随后以46926caf7为事实底稿应用事先审阅的本轮精确patch，新增a71a3ee14恢复全部并发证据展示。没有改写历史、reset/clean或覆盖工作区；普通索引只应用本轮patch保留独立暂存。已核对46926caf7..a71a3ee14净差异严格等于本轮110个文件，目录目标证据及其记录净差异为空。准备器已加实际commit紧前的HEAD校验，并批量读索引元数据，避免逐文件读取新二进制产物造成长准备窗口。该事故不作为产品根因；fresh fetch/merge后继续正常推送hook，待推送含已获独立真实验收的Provider和目录证据提交。
