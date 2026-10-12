# 364 文件来源的真实匹配行预览

## Recall

用户要求持续单agent自主改进UI/UX和功能，重点Sources显示与Rendering；旧goal中的Astra并行已经被最新人工要求覆盖，不委托。363为progress：共享reading anchor排除closed details内容，实际Main/Side/已有child回归与完整历史逐值检查通过，ea2668b7e已推送，工作区干净，所有scope关闭。362已有当前SDK 7真实流式交叠证据；359跨网站首次复制未知仍保留。目标active。

已读当前AGENTS（包含全界面语言）、363 Recall、07-panel的Source/tooltip/excerpt/路径/不可变Message合同、SourceParts完整显示及Snippet组件、tool/source、session/message SourcePayload/Part、source-persistence、search_code实际grep.ts生产路径及相关正向测试、SDK生成入口。全仓搜索fileSource、SourceFilePayload/Part及snippet生产者，已知调用为read/search_code，持久化统一parse/append。已有URL片段使用当前Excerpt与局部阅读Store。搜索到的相关测试为工具/数据/persistence契约，不含UI自动化；本轮不新增或运行UI自动化。

## 现象与数据根因

363实际大来源截图（例如21-child-source-before.png）表明同文件许多引用重复长标题，tooltip只有完整位置/Local search，用户要打开文件或工具结果才能辨认具体命中。真实search_code已有lineText，输出保留匹配正文，但fileSource只输出path/title/range/provider；SourceFilePayload没有snippet，严格schema也不会接纳该信息。这是来源预览能力的缺口，不是数据丢失或旧来源身份错误。当前不把所有重复标题先改成无上下文行号，避免读到中部失去文件身份。

已确认UI的ConversationSourcePart带可选snippet，SourceTooltipContent没有展示文件片段；SourceEntry的通用Excerpt会为任何snippet额外生成一行toggle。直接只加后端字段会让64条文件来源各多一排Excerpt，增加重复控件，因此需要与紧凑的文件预览表现一起交付。网页长片段仍需要其原独立滚动阅读区；文件已有准确打开路径和行号的完整阅读入口，短预览放入当前tooltip更合适。

## 单一数据与UI决定

为SourceFilePayload及其唯一fileSource工厂增加可选snippet字符串，保留原缩进/尾空白/空字符串；不trim或改写文件身份。仅search_code把其已返回匹配行的安全可见文本作为snippet，read/attachment等没有该事实时不生成、不另读文件或回填历史。源id继续由path/range/symbol决定，普通Source消息仍由真实tool产生，经persistMessageSources保存；既有Info/Part不可变、时间线、分组/顺序/复制/导航、toModelMessages的source-file资源提示保持原合同。新增字段通过现有SDK（Software Development Kit，软件开发工具包）生成脚本更新，不手改生成类型或建平行协议。

搜索行的现有2000 UTF-16 code unit（16位编码单元）显示预算保持。当前substring可切开代理对；在本次单一匹配行格式化处让边界停在完整字符，并以现有省略标记呈现。同一个先有界、再经redactInlinePayloads的line snippet用于工具行与Source，避免Source重新暴露工具已经隐藏的内联二进制；最终工具输出仍保留原全串脱敏防线。脱敏标记offset的局部上下文为该匹配行，本来就由传入字符串决定，无消费者应解析为文件字节位置。当前仓库没有可复用的同语义字符前缀primitive，仅byte-prefix用于不同的字节预算，本轮不另建通用抽象或改成字节限额。

文件Source沿用当前Tooltip primitive，在完整身份/位置与provenance之间显示真实snippet，用已有本地化“Excerpt”标识和最多四行视觉预览。JSX（JavaScript XML，声明式界面语法）文字节点显示原内容，HTML/Markdown不执行或重排；完整原行通过原文件打开入口读取。文件片段不追加单独Excerpt控件；网页片段仍沿现有展开/读点路径。原路径、行号、复制和tooltip键盘焦点行为不变，所有界面标识走当前语言资源。无第二份匹配事实或按关键词推断片段。

## 影响面与风险

全仓fileSource调用者与strict SourcePayload/Part、SDK类型/OpenAPI、persistence、Conversation传输/三个renderer都被纳入；data/schema变动需聚焦正向测试。无DB migration、调度、队列、恢复或模型流程变化；若实测出现此类异常立即按共享Task/Mission/Session全入口/轮次/终态/重启重试/串并行/项目隔离审计。风险为大行、代理对边界、内联payload、纯空白、文件路径相同但行不同、旧Source缺字段、tooltip占用过大或键盘不可见。字段是可选的实际附加事实，不是旧协议fallback，不回写旧Part。

先核对实际输出下的Unicode边界及脱敏正向契约，再实现。search-code-bounded-execution真实文件用例更新完整来源期望，增加真实长行/内联payload片段输出；source-file-title/schema与source-persistence核对精确snippet/时间线持久化。mock部分仅补充本地契约，不冒充端到端。

## 真实验收与收尾

已有363实页tooltip截图作为缺少命中内容的基线（同一root亲自运行/查看，当前Source渲染代码相同）；本轮先再次查看这一目标图。正式生成/类型/build后新隔离source-preview-364/18364、固定600000ms NativeService、同scope12请求预算。仍使用已授权OpenAI auth与完整models.json成对暂存，并在提交会话前独立验证usable/projected/actual gpt-6.1-sol streaming。实际Web UI /ui串行Main/Side或单个普通会话检索自建两目录同名Markdown的真实SOURCE364命中，简短汇报即可；不派遣成员，不伪造来源/消息，不编辑既有历史。资料包含可区分甲乙正文、原缩进、中文/emoji和非执行的markup文本，复杂截断/脱敏通过实际工具正向检查及需要的真实输出覆盖。

实际pointer与keyboard tooltip看见对应命中、切换不同行/文件、打开正确行、复制控件与Sources展开/收起、长文本视觉界限，中英界面都要人工截图；保持当前列表密度，不能只以DOM字串/console/build替代。如新增片段令画面变差，先更新方案再调整，不把中间布局当交付。完成后先关自建页面，公共shutdown、原handle实际join和Host/Native/output/request/port/auth-models配对清除；不延长或重开scope。

归档实际工具/Provider/canonical/HTTP及截图，既有失败保留。docs/current合同、spec索引、当前docs检查一起更新；范围提交、fresh fetch/普通merge、完整待推送集合审查及正常push，不升级版本或发布。工作区无关改动保持原样。最终明确验证范围和未完成项，持续goal active。

## 改前实测与实现进展

363/21实际tooltip基线已再次亲自查看，只有身份/位置/provenance。新增两个正向真实文件搜索契约后，原搜索runner75308实际exit1：原12测试通过、新2测试失败，差异为缺少snippet、2000单元边界切开emoji及脱敏marker原来是全输出offset。当前实现先一次生成每行完整字符前缀及安全snippet，工具行与Source复用，再保留最终全串脱敏。source-file schema/factory精确保留字符串；UI file tooltip预览而web保留原Disclosure，未加逐条重复按钮。

聚焦runner18937实际exit0：search-code14、source-file-title8、source-persistence1共23测试通过，包含真实UTF/空白/限制/脱敏/Source持久化。SDK正规build38766 exit0，生成types/openapi各增加对应可选字段，没有平行类型。typecheck66806和overlay build38768均exit0，8/8类型任务通过，renderer public-surface检查通过；CSS token检查通过（8766引用、268tokens）。

## 真实页面与运行验收结果

原scope只有一次启动：NativeService18364、固定600000ms、请求预算12、preflight与UI共用同一进程。实际auth/models配对，preflight session ses_h5rpMHqJ9vJK8YfwiJHq分别确认usable/projected/actual gpt-6.1-sol streaming。Main实际search_code SOURCE364产生10来源，Side实际search_code SOURCE364.*记录01产生2来源；Side继承Main的10条历史另计。没有委托开发agent或派遣产品成员。

手动页面182的01–14截图已亲自查看。01–06用键盘逐项查看英文预览：甲乙两个同名文件正文对应，原缩进/尾空白/emoji保留，markup显示原文，2003字符长片段视觉上限4行，内联样本已变成工具相同的省略标记。07从第6来源按Enter打开方案甲文件并选中第2行。08–11中文Side预览、复制按钮反馈、收起/展开、切换方案甲；没有新增每条Excerpt按钮或额外列表行。12–13轮滚动后tooltip没有展示，作为真实中间结果保留，不算pointer通过；14实际指针拖动到Main来源后，焦点仍在对话，显示中文预览，人工确认pointer路径。09只验证复制控件反馈，359跨网站首次复制问题仍未解决，不能用toast宣称系统剪贴板可靠性。

页面关闭后公共shutdown，原handle82701实际join exit0；Native reason exited/exitCode0、432207ms内物理终态、output/request清理和auth/models配对清除均有生产回执，未延长或重启scope。Provider共9次HTTP200、gpt-6.1-sol、streaming、reader EOF，NativeService qualification通过。

真实checker check-runtime.ts读取实际SQLite、生产ToolOutcome输出、输入文件和Native/HTTP/Provider回执：22条持久化Source（Main10/Side历史10/Side新2）逐项对应文件/行与安全snippet，Side历史片段与Main逐值相同；Main和Side的各次output含相同片段，当前前端main-C_UK_gz4.js实际HTTP200。不是DOM或截图断言；截图是独立人工证据。runtime-check exit0。档案保留改前2失败/12通过与完整失败日志；私有原件、gzip全字节回解校验、凭据扫描沿既有规则。

本轮已实现及实测目标；docs:check（345 operations/25 groups）与architecture-index（18 documents）均exit0，git diff --check通过。归档68份supervision、28份压缩资料；完整解压扫描64文本文件，凭据匹配0。范围提交及fresh merge/push在最后收敛。版本与发布不变。持续目标active，下一轮继续自主找问题，单agent约束保持。
