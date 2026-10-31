# 交付承诺、验证选择与完成判断

## Recall

- 用户原始要求：建立 goal，修复记录中的通用缺口；不能只补 `RHS` 解析器、添加泛泛的“必须测试”或证明提示文本已注入。按承诺区分样例、输入合同、最终交付入口，验证合法变化、独立依据和真实消费者；以其他格式和任务的真实执行验证。
- Goal 已建立，当前 active。单 agent，不委托；不改封存候选、既有分数、生产用户数据、Provider（模型服务）协议或调度机制。
- 硬约束：所有模型请求流式；不加宿主业务 gate、关键字路由、完成状态机、双源、隐藏消息；聚焦正向后端测试；不创建或运行 UI（User Interface，用户界面）自动化。用户正在使用的进程/窗口保持。凭据使用须另行授权；隔离凭据和完整模型目录配对，分别验证凭据可用、目标投影、实际请求身份。
- 工作区起点 main/ed185cab3，upstream origin/main。已有视频/截图删除、三个索引等修改和未跟踪 `.bun/`、`packages/opencorvus/bun/`，全部保留。重叠索引只暂存本任务新增行。
- 已读：AGENTS.md；`benchmark-debug-template/SKILL.md`；当前 architecture/{04-extensions,03-control,17-code-work-agent-platform,inspect-benchmark,README}.md；10月29日 heavy-workbench-long 新输入失败记录；共享 verification fragment、LLM.composeSystem、runtime-template-registry、engineering-craft、Build/delegated-worker/orchestrator/mission core、完成工具及其输入 schema、verification-discipline 测试、real-provider-audit、read-agent-message-e2e、test-runtime-environment 和 runtime-paths。
- 全仓搜索：`VERIFICATION_DISCIPLINE|verification-discipline|ENGINEERING_CRAFT|engineering-craft` 在 src/test/architecture/records；`complete_task` 在 prompt、生命周期工具及 schema；RHS/合法输入/solve.py 在历史记录；所有 AGENTS.md（仅根目录）；相关真实 checker、入口和现有测试。未触及 UI 测试路径，没有发现需要删除的相关 UI 自动化。
- 外部依据：[Anthropic agent evals](https://www.anthropic.com/research/demystifying-evals-for-ai-agents) 区分 trace 与最终环境结果、强调多次 trial 和真实 grader；[Python csv](https://docs.python.org/3/library/csv.html) 给出标准 reader/writer 的换行和引用合同。此处采用输出验收加真实 trace 人工复核，不以模型自述计分；小样本不能证明统计因果或全域正确。

## 实施前影响分析

1. 可观察现象：封存 OC 程序对三开发模型通过，却在合法的新 MPS（Mathematical Programming System，数学规划交换格式）RHS 集合名变化时跳过数据，最终入口保存中间向量后自校验失败，完整导出未产生。原始 evidence 见 heavy-workbench-long 的“新输入真实失败的根因与评价反证”。本任务不重跑或改写该候选。
2. 直接触发点和数据根因：候选段标题首词判断误认多字段数据行，rhs 为空。产品层根因边界是从样例成功外推支持合同、完成决定没有补验证范围；不能据此证明某条提示是唯一因果来源。
3. 旧路径未根治原因：共享 fragment 要求真实目标和证据归属，却没有要求从承诺推导输入变化、独立正确性依据和最终程序消费者三类验证。Build 的 craft 只要求验证改动点；Task 负责人使用其他 core。更多开发样例重复/破坏输出测试/--help 不会自动扩大合法输入覆盖。
4. 定义和调用：唯一共享 fragment 在 LLM.composeSystem 每次请求注入，覆盖 coding/chat/work/control/mission、Task orchestrator、全部 projected runtime（含 complete/custom prompt）；原生 tool-free helper 保持专用提示。无需另造工程 prompt 配置或复制 craft 到所有角色。完成入口通过 manage_task 使用 CompleteTaskInputSchema 和 createTaskLifecycleTools；改模型可见描述，不改输入结构或执行交易。
5. 公共契约：继续由模型判断业务正确性，Host（宿主）仅维护真实持久证据、身份与生命周期。共享原则同时用于执行、委托、独立复核和最终接受；只验证子集时明确剩余未知，不能自降用户要求后宣布完成。
6. 数据和恢复：无 schema、持久格式、消息、队列、唤醒、重试、恢复、并发或终态收敛修改。现有记录没有这些异常证据，故无需以此为由扩大到调度重构；若真实运行出现此类异常，立即按 AGENTS 横审共享机制。
7. 测试与文档：原有 composeSystem 正向测试覆盖所有执行入口，新增明确共享合同断言只证明投影。真实后端 acceptance 使用生产 HTTP（Hypertext Transfer Protocol，超文本传输协议）Session/Task 入口和真实工具，不是网页验收；无 UI 产品改动。更新当前扩展架构和相关索引并跑 docs:check。
8. 交付风险：提示长度和过度测试倾向；要求检查与承诺/风险匹配，不要求穷举或固定测试数。实际模型随机性、模型/包权限和工具链可能影响结果，保留原失败和请求记录；行为前后对照只能提供有限经验支持，不能宣称消灭所有漏检。

## 方案与执行顺序

1. 先落真实 benchmark（基准验收）：两个不同任务/格式——CSV（Comma Separated Values，逗号分隔值）金额汇总、JSON（JavaScript Object Notation，通用结构化数据格式）到 JSON Pointer 叶值映射。各有少量原型样例、明确完整输入/输出合同；交付 Python 标准库 zipapp，必须从独立消费者目录实际运行。
2. checker 事前固定合法 holdout（留出输入），分别覆盖表示变化、结构/语义边界及组合；期望值为独立人工计算的明确结果，解析和比较用标准库。checker 不调用候选内部函数，不向模型暴露隐藏输入或补充测试提示。保留生成输入、真实 argv、退出码、stdout、文件结果、完整 Session/Task 工具证据。
3. 凭据获批后先跑原产品两例 baseline。coding 和直接执行的 Task orchestrator 各一例；相同模型、合同、原型、checker，隔离新项目；禁止委托，避免角色混杂。实际完整调用 trace 人工检查模型是否主动选择合法变化、独立依据、消费最终 pyz，是否完成判断与证据匹配。
4. 修改唯一共享 fragment：实施前按用户承诺推导验证范围；分别检查开发样例、合法输入合同和最终入口/依赖/输出；按格式/数据/控制边界选择合理变化和独立 oracle；拒绝测试只证明拒绝合同；修改后更新受影响证据；完成前检查覆盖、冲突和未知。完成工具和 summary schema 描述引用同一原则，不新增字段或 gate。进一步追到真实模型工具面：`tools.ts/materializeManageTaskTool` 暴露 `manage_task`，内部 complete_task 的 description 不会自动进入该公开工具，故修改公开 wrapper 和复用的 CompleteTaskInputSchema，而不是只修改内部不可见文案。
5. 聚焦测试通过后，以同样两题 fresh 真实执行验收。若失败先查真实 trace 和产物根因再改，再按已授权额度执行；不通过不能标 goal complete。保留 baseline/after 差异和局限，不将基线已通过误报为新增收益。
6. 人工复核代码、真实程序和 trace；完成文档检查、相关类型检查、范围提交。fresh fetch，merge origin/main，检查完整 origin/main..HEAD，正常 hook 后 push，不创建 tag/Release/PR。

## 环境、超时与验收标准

- 使用仓库现有隔离 bootstrap、生产 server runtime、RealProviderAudit。auth/models 来源由显式环境变量给出，任何内容不进入 spec、日志或提交；程序在独立临时项目运行。
- 用户已明确授权：openai/gpt-6.1-sol，baseline/after 四任务及预检累计最多120流式请求。无活动180秒判失败，实际 Session/Tool/provider 活动更新时钟，轮询本身不更新。长任务以定时检查结果推进，不持续 tail。
- checker：每个最终 pyz 在独立消费目录、使用 Python isolated mode 执行，解析实际输出并与每项固定业务结果相等；还核标准库依赖合同。不存在/执行错误归为明确交付失败，不用 --help 或退出码替代结果。
- after 两任务全部合法输入、最终入口和输出合同通过；人工 trace 有模型主动执行合同扩展验证及独立核对、最终打包程序消费证据；完成判断不能把未验证范围说成已验证。全部必要局部检查通过、提交与推送后才标完成。

## 当前状态

checker 的四个正向局部合同测试通过；JSON 比较按真实类型/键/值，数值1和1.0同属JSON number且等值，不以序列化字面差异判业务失败；boolean与number分别判型。13个固定输入及人工期望不变。已收到用户对上述隔离验收的明确授权。

baseline 已真实结清并原exec退出0：CSV 6/6、JSON 7/7，38实际流式请求；配对副本退休、源auth/models字节保全。CSV真实模型自己新增六个测试（源码和pyz分别消费），包含引用/多行/Unicode、重排/metadata、精确大数、空数据和生成记录。JSON原Task completed，包含真实manage_task/complete_task和最终发布。不能将这些已有行为归为修复收益。

随后按方案修改共享fragment、公开manage_task描述及summary说明；没有改内部不可见description、schema结构或Host判定。聚焦25项共享投影/政策合同及8项真实公开工具组装合同全部通过。after使用同两题fresh项目和剩余82请求硬额度；仅新增物理请求已知文本probe观察，不改变任务prompt、可见工具或checker。probe用于确认原文实际进入Provider请求，并非以源码摘要证明业务正确。

after已正常结清并原exec退出0：CSV6/6、JSON7/7，42实际精确Sol流式请求全部HTTP200/reader settled/EOF。配对凭据/目录副本退休、源字节保全。前后80/120，余40额度退休。两个operator prompt逐字相同。after CSV自己运行7组实际归档测试（独立金额期望、顺序/重复关系、隔离目录及带空格路径）；JSON自己运行8组，在最终重建后复跑，再自然发布与完成；完成summary明确独立依据、自验身份、已验证输入边界、递归/内存和重复名称语义限制、非穷尽性。39个执行请求真实携带共享原文，3个memory helper保留专用提示；20个Task请求真实携带完成summary说明。

完整[原始证据和独立消费者结果](../../artifacts/2026-11-01-delivery-verification-scope/README.md)已归档；人工二次复核已完成，接受这两个有限场景。baseline本来13/13，after仍13/13，不能宣称量化改善、全域问题永久消除或唯一提示因果。当前修复是补齐产品统一验证/接受合同，并在不同格式与两真实入口证明其可执行、产物正确、完成判断有范围。原MPS候选和历史分数保持。

本地检查：37项聚焦正向后端测试（Bun33+Python4）、核心package typecheck、docs:check（352ops/26groups）、architecture-index（20文档）和目标diff空白检查均通过。未发现应清理的死实现。三个共享索引仅暂存本任务新增行，未混入已有修改；新出现的并行界面修改也保留。代码和证据完成范围复核，提交、fresh fetch/merge及正常hook推送以实际Git历史/回执为准；Goal在真实远端交付前保持active。

暂存审查发现真实证据交付问题：根`.gitattributes`的`* text=auto eol=lf`把已归档CSV的CRLF（Carriage Return/Line Feed，回车/换行）及引号字段内换行转成LF，实际staged quoted-records与已运行原件字节不同。只读全仓属性定义及Git官方gitattributes合同后，在当前唯一根配置面为本证据目录添加精确`-text`规则并保留CR行尾空白语义；不改程序、原输入、其它目录或验收结果。不用源码摘要门禁，直接比较暂存blob与具体已执行原件以验证真实身份/完整性；重新暂存并以四个确切归档和原CSV/JSON完整数据核对。

属性更新后普通git add沿用旧stat缓存，首个comparison.json原件核对仍揭示暂存转换；随后只对本次证据目录执行git add --renormalize，53文件staged blob逐字节等于已归档原件，git diff --cached --check通过。四个pyz各仅包含__main__.py且与旁置真实main.py字节一致。该证据交付修复已验证，无新增模型请求或业务输入改变。
