# Unicode 来源定位实测

## Recall

用户要求持续单agent自主体验、分析、修复、真实页面复核和提交推送；最新单agent约束覆盖旧Goal中的Astra委托。不委托，不因已解决的Rendering反复返工。上一轮846实际进展为3f9b95872c7d8aea475a641d984a0ad0d109ed66：中文source excerpt六值改为摘录，十二实际截图、Sources真实复制/粘贴及原件定位，普通构建/语言/类型/文档及正常push检查通过；fresh fetch/普通merge后main=origin/main、0/0。846-after已退休，schema9/92表227966行、100 Session/8 Task/773用量、123保护附件，累计1158真实模型请求，全部配对副本退休。新轮开始177外部工作区状态，包括并行research记录修改，保留全部无关工作，不建branch/worktree，不操作用户服务/数据库/窗口或用户页1。

本轮检查行列的真实含义，避免只验证“能打开文件”。使用当前已交付UI（User Interface，用户界面），不新增、修改或运行UI自动化测试；以实际操作、截图人工复核验收。月度目录按当前本地日期2026-11-01建立，不移动上一轮在2026-10-31开始的记录。

## 已读与深度分析

已读AGENTS、846 Recall/最终回执、search-code-lines的字节段与行列映射、grep.ts的生产搜索/前置CR扫描/来源发布、真实search-code-bounded-execution正向用例、File.read的bytes.toString(utf8)、file-reference范围和CodeEditor.revealLineRange。全仓搜索定义/调用和Unicode、emoji、BOM（Byte Order Mark，字节顺序标记）、混合CR/LF（Carriage Return/Line Feed，回车/换行）的现有合同。当前正向用例已覆盖中文和emoji前缀、BOM、混合换行及无效UTF-8（Unicode Transformation Format，8位统一字符编码）字节；不能据此虚构新缺陷。

候选可观察现象为Sources显示列号准确但点击后的编辑器光标落在其他位置。目前未知。直接触发是中文/emoji或BOM前缀之后的搜索命中；链路为真实ripgrep字节坐标→searchCodeLines映射到UTF-16（Unicode Transformation Format，16位统一字符编码）位置→source-file.range.startColumn→file-workbench→CodeEditor光标。前置CR扫描使ripgrep的LF记录与编辑器CR/LF/CRLF显示行保持一致。CodeEditor已有引用位置光标和整行色带合同，色带不代表整行被选择；此次以光标处实际Shift+End复制的后缀核对位置。旧修复对多字节与代理对已有明确实现，是否存在跨UI边界遗漏需真实运行确认，不能把源码猜测当根因。

影响面包括search_code产物、原始snippet、行范围与列号、BOM保留、混合换行、共享主/侧文件workbench及真实自然消息；没有证据需要改公开API（Application Programming Interface，应用程序编程接口）、SDK（Software Development Kit，软件开发工具包）、schema（数据库结构）、模型策略或配置。当前先做调查验收，不做生产修改；发现可复现问题后补完整根因、调用与旧路径未覆盖原因再修。未发现调度/队列/唤醒/恢复/并发/终态异常，若发现立即按AGENTS横审共享机制全部入口及执行轮次。

## 实施前方案

从846-after完整续存unicode-source-navigation-847-before/38482，冻结现已验证的3f9构建；独立新60分钟绝对deadline，不复制旧期限/结果文件，after/38483共享该期限，至少十分钟启动和五分钟结清余量。配对复制已授权OAuth（开放授权）与完整models，启动分别核凭据/精确gpt-6.1-sol投影，实际请求再核精确模型/流式200/EOF（End of File，流正常结束）。before至多8实际请求，含所有辅助请求，after0，累计至多1166，不追加额度或延期；不记录任何凭据。

真实New chat选择Code/Chat与GPT-6.1 Sol，先发送仅回复PREFLIGHT_847_UNICODE_OK的可见预检并核真实请求。在这个全新QA（Quality Assurance，质量验证）Project内create-only放置三个自有可见输入：中文定位.md含“前缀中😀NEEDLE_847_ALPHA 尾文”，字节序标记.md以真实UTF-8 BOM开头并含“首😀NEEDLE_847_BETA 终”，混合换行.md以真实裸CR/LF组合含“前缀😀NEEDLE_847_GAMMA 完”。分别预期显示行列2:6、1:5、3:5，仅由文件字节计算，不把期望答案泄露给模型。提示模型只使用search_code检索根目录md里的NEEDLE_847_，按真实命中回复、保留Sources，不读整文件、不写文件、不联网、不创建Task/其他Session/子agent、不委派。

实际展开三来源并打开各原件，Source点击后在已聚焦编辑器Shift+End、复制、到自有未发送草稿真实粘贴，核后缀正好从命中开始，随即清空；不使用浏览器clipboard.readText工具代替实际粘贴。记录原件行号/列号/光标与选中文本截图并亲自查看，中英文各覆盖。真实HTTP读取只验证自然消息、工具completed、来源坐标/原文和文件字节，不替代UI。候选或重启复验从已退休before完整续存，新Provider请求0，复用同一自然回答/三来源验证持久化和重新打开。无新缺陷时如实记录通过范围，不制造代码修复。

原92表业务字段、123旧附件、十三Git项目28 tracked、十三+三十九原文件与833/836/837/838/839/841/843样本保持，847三输入和新自然消息另存。只允许真实已过期容量租约在本次native PID（Process Identifier，进程标识）下按现四字段正常复用并释放。先关闭自有页、公开shutdown200、原执行句柄/native/launcher物理输出请求与OS（Operating System，操作系统）出生链结清，再退休配对副本并核源保持。三索引同步、当前docs检查、范围提交；每次push前fresh fetch/普通merge/完整待推集合审查与必要检查，正常hooks推送。不发布、不改版本，Goal继续active。

## 当前执行与验证命令

独立846后继847-before已启动，原执行句柄92760，端口38482，自有隐藏页50。Session ses_-zUQM0BVWzz7s7D4Uzk7、Project prj_hGeWl5L4qMQ3FldnnhVW，目录为本批runtime/data/projects/2026/11/01/0165283b-e26f-4913-b671-9983fb062c8e。真实预检得到PREFLIGHT_847_UNICODE_OK；两实际请求精确gpt-6.1-sol/stream/200/EOF，配对凭据和模型目录启动资格亦通过。核新项目位于自有runtime/projects内后create-only放入三样本；01预检实图已亲自查看。随后通过同一真实UI发送search_code请求，尚未据此预判结果。

同时以项目原测试运行器聚焦`test/tool/search-code-bounded-execution.test.ts --test-name-pattern=publishes the displayed character column`，仅八个真实ripgrep/文件/Tool来源输出正向用例，使用短隔离目录uc。该检查验证后端坐标合同，不是UI测试，不能替代当前页面和截图。命令及结果保留本批私有uc日志；未选择全量bun test或其他用例。

## 基线实际结果与新作用域

真实模型只调用一次completed search_code，输入为pattern=NEEDLE_847_、include=*.md，三source-file均通过toolPartID精确绑定原工具part。中文/emoji、BOM、混合换行分别得到2:6、1:5、3:5；原行snippet、原45/30/48字节和文件内容接口200完全保持，包括真实BOM与裸CR。共五自然消息、十三Part，五实际gpt-6.1-sol请求全部stream/200/EOF。八个聚焦正向测试全部通过（27其他用例过滤），不是UI自动化。

01—07七张基线实图均亲自查看。点击三来源后，编辑器真实Shift+End复制、再到未发送草稿Control_L+v，分别正好粘贴NEEDLE_847_ALPHA 尾文、NEEDLE_847_BETA 终、NEEDLE_847_GAMMA 完，证明点击后的光标位置正确，不是仅抄模型列号或只看行色带。三个草稿随即清空，原件没有写入；中文切换后来源列号、BOM控制字符与混合换行摘录也正确。现有控制字符名称保留Unicode技术名称，不把它当作模型原文翻译或新定位故障。当前没有新的生产缺陷证据，不制造修复。

页50关闭，公开shutdown200，原exec92760/native13116/launcher均0，物理/输出/请求与OS出生链结清后退休配对副本，源auth元数据及完整models字节/元数据保持，余3073765毫秒。schema9/92表227966→229430，旧业务全部逐列保持；两个真实过期容量槽仅按当前native身份复用四字段并释放，其他增加均为本轮自然消息/工具/用量/事件/记忆。123旧附件和所有原文件/Git、843原样本保持。实际5/8，余3退休，累计1163。

从该已退休数据启动847-after/38483，原exec34712，自有页51，保持同一未延期deadline、0新增模型请求。新scope保护旧123加本轮真实发布的两个能力文件共125附件，复用当前已验证3f9 UI构建与同一五消息/三原件。后续只复验持久化和重开光标，不让模型重写结果。

## 重启复验与最终验收

页51从真实原Session深链进入，切换中文，展开同一三来源。逐个打开原件，在实际光标处Shift+End、复制、粘贴仍分别得到三个完整命中后缀，随后清空草稿。08—10三张重启实图已亲自查看；本轮共十图。HTTP回读同一五自然消息完整snapshot/selection和三条toolPartID绑定、行列、snippet、45/30/48原字节与内容接口200均通过。after新增请求0，既存来源没有重写、回填或合成。全轮没有生产代码改动，也不把正确的现有Unicode映射包装成新修复。

页51关闭，公开shutdown200，原exec34712/native/launcher0，物理输出请求与OS出生链结清后退休配对副本，源认证元数据和完整models字节/元数据保持，余2876960毫秒。after的schema9/92表229430→229432，所有原业务保持，仅新增一个正常runtime_process历史物理receipt及grant；PID和OS出生身份与实际native相同，内部receipt标识自洽。容量槽保持，101 Session/8 Task/778用量，125附件、所有原文件/Git和本轮三个输入保持。只剩用户页1，自有50/51及上一轮临时失败页均已由当前生命周期回收，未操作用户页。

期间并行会话提交e98dbe558ea0806704093512511c873e9a0c7a4d，已核131个路径全在specs，产品源码不变；共享索引保留其已提交及未提交正文，不等待无冲突的并行记录。本轮交付限三原始输入/十实图/脱敏回执、本规格、新月度README及两个共享索引行；当前docs检查、范围Git提交与正常上游同步/hooks推送后收敛。实际执行范围已完成，不把三场景通过扩大成全产品完成，Goal仍active。
