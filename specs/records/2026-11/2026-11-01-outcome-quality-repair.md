# 交付可靠性、正式方案选择与真实端到端修复

## Recall与本次授权

用户先停止十题探索并要求判断系统优劣，随后明确：“那就想先解决并端到端测试这些问题”。本轮只修OpenCorvus当前共享执行/验收行为及相应真实端到端消费，不恢复十题心跳、不追加新的职业题或Codex对照。原benchmark automation保持PAUSED；旧海运/预测/月结/SQLite/Wasmi原件、原失败和成绩全部保留，不修封存候选冒新成绩。

已读当前AGENTS、benchmark-debug-template、原delivery-verification-scope记录和architecture/inspect-benchmark、当前verification fragment、LLM.composeSystem、runtime-template-registry、engineering-craft、CompleteTaskInputSchema、manage_task公开组装/内部生命周期、原真实Session/Task runner及独立checker边界。全仓搜索共享fragment/所有投影、完成schema定义和调用、quality/objective/selection同语义与现有验收脚本。当前HEAD/upstream9d94e8f4，工作区196条foreign/staged空；保外部媒体删除/索引重排/Bun/并行UI改动，不branch/worktree/reset/clean/rebase/force/noverify。不委托。

## 实施前深度与影响分析

- 直接已证故障：海运候选自写MPS reader误认合法RHS数据为段标题，自校验误拒可行解并中断导出；预测候选正式selector选择弱于已有其他方法，July局部损失很大。它们是原候选实际数据/控制流问题，不是生产host调度故障；不能仅据此断言某提示或底层模型是唯一因果根源。
- 当前统一verification已要求承诺→合法变化/独立预期/最终入口，在coding、Task orchestrator、complete runtime每个真实请求投影；此前13/13→13/13没有证明效果提升。本轮不重复这两份旧CSV/JSON题、不把提示包含/测试数当效果。
- 仍缺的明确行为：比较性任务如何区分可行、验收通过和实际质量；如何从正确的数据切分/目标度量选择最终方案，并把最终配置/manifest实际执行与所选方法绑定。成熟格式工具的复用应在当前共享事实源明确，避免重复手写部分parser与同源自验。执行时采用原项目已有/标准库能力，不绑某宿主/某RHS关键字。
- 单一实施面：在当前唯一verification fragment补足上述质量选择/成熟格式依据；公开CompleteTaskInputSchema与manage_task只引用同一共享原则并说明正式方案证据，不新增schema字段/业务gate/host强制工作流或模型路由。生产事务/持久schema/调度/消息/工具授权面不改；无新共享异常证据，横向调度审计不适用。
- 测试：投影/schema单测只能证明模型可见合同。实际端到端必须经过现有生产Session/Task→真实流式Provider→真实工具→发布的Python zipapp→隔离目录独立业务消费者，分别记录运行/格式正确、质量、最终选用方案和完整交付。没有UI产品改动，本轮明确验收后台生产API和程序数据输出，不用UI自动化或网页外观替代。
- 风险：提示增加约束可能导致冗长/过度检查；只在任务有质量目标/备选方法时触发，并与用户目标及预算相称。当前单一prompt仍不能保证能力根治，有限前后样本和模型随机性不支持全域因果结论。若baseline已正确，不把after同过说成提升，也不换seed凑失败。

## 新的有限端到端合同

使用一个新的完整“需求预测与补货发布程序”修复任务，包含原始训练/验证需求、营业状态、库存输入、三个已有策略、存在训练/验证口径错误和过期正式配置的原型。要求从源事实重新比较策略，按明确验证损失选择正式方案，交付可从独立目录运行的deliverable.pyz、源码、真实指标和补货表。并覆盖合法CSV表示/列序/带引号名称等输入变化；最终预测及补货以独立明确业务预期核算，不读取候选内部parser/报告自述作真值。

事前冻结所有公开原型/合同、私有合法输入和独立期望，同一新任务分别经coding Session和直接Task执行，修前/修后各一次共四次。它是产品行为回归，不称重型任务/十题成果/统计成熟或总体模型排名。保存原输入/原交付/每条真实请求/工具结果与完整消费者向量；区分生命周期completed、程序运行、正确性与连续质量，无合成100。

先对新消费者作必要正确/合法/真实错误最终programme消费，验证正式配置误用及质量损失能被真实输出发现；只用于检查工具有效，不用作者参考代模型结果。随后先跑当前实现baseline，再修改共享实现与聚焦测试，最后同冻结合同after；不通过时保原错、定位当前实现/runner/消费者根因，只做有证据的必要修复，不扩框架或新任务。

本次用户新增“解决并端到端测试”用于这四个有限真实OpenCorvus执行及预检，使用已有openai/gpt-6.1-sol、新自有隔离runtime、成对auth/models分别核usable/projected/actual；新请求上限合计120，非复用旧80/120或退休40额度/旧凭据副本/服务。凭据不进入prompt/log/spec；只使用源文件进行受控staging，原源不动。所有LLM流式；无活动180秒按真实运行活动更新，不设候选最低时长、不把轮询/生命周期/缓存当有效工作。完成后自有runtime自然收敛再dispose并清副本；不操作用户进程。

代码与新checker/有限输入先落盘并验证，baseline在产品修改前实际执行。相关聚焦检查/类型/docs后范围commit，正常fetch merge审全部待推/完整hook/push。不发布版本、不恢复心跳。最后按实际结果列出已修/已测/效果仍未知的部分；“通用原则已实施，行为根治未证”只能由充分新证据改变。

## 准备与原始错误

外部原根为`D:/opencorvus-benchmark-runs/outcome-quality-selection-e2e-20261101`。六个固定输入是营业变化/星期模式两种业务情景，各有普通、带引号Unicode与嵌入换行、列序/额外列/记录顺序变化。显式业务MSE分别为`last=1500/7,open=0,weekday=500/7`和`last=3250,open=1000,weekday=0`；独立未来预测及补货逐行固定。正确programme和选错/数量错两个完整zipapp实际消费由聚焦Python测试验证；原旧CSV/JSON checker/test/runner先保外部original-tools，不复用为本次效果证据。

首apply_patch组合Delete/Add同文件被工具拒绝，未修改文件；改为两次精确替换。第一次启动命令使用package工作目录却把冻结路径写成repo相对，freeze/copy报路径错误，但PowerShell继续启动runner；该原工具输出保留。合同/源代码及六情景已在启动前落盘、测试通过，registration在真实运行前写入，单独frozen副本是在coding开始后补存；不声称所有归档先于模型。没有改变原输入/预期或给正在运行的模型反馈，产品baseline源仍未改。后续命令显式ErrorActionPreference=Stop。

权威依据：[Python CSV API](https://docs.python.org/3/library/csv.html)提供引用/命名字段与newline处理；[scikit-learn数据泄漏指南](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage)区分训练与评价数据并解释泄漏导致乐观估计。这里只采用契约原则，没有引入新依赖或把库存在当行为证明。

## 用户最新扩展：多个不同任务及逐次详细故障清单

用户在首baseline自然执行中明确：“接下来你的任务是执行多次不同的端到端任务，记录每次opencorvus的故障清单，描述要详细”。保留当前两个forecast baseline；修后coding仍用同forecast用于有限前后可比，其余两个真实直接Task分别执行新的文件归档交付和SQLite库存批次导入完整项目。总共五次有限真实执行；新增范围将本轮操作侧有限上限调整为180请求（修前已启动60、修后三任务最多120，包含预检），并非复用历史80/120或退休40。三个不同任务不是十题重型资格或新的Codex对照，心跳继续PAUSED。

文件任务要求从源manifest和真实二进制/文本文件产出可消费ZIP、精确路径与索引，实际外部zip消费者按内容/解压后完整树核证。数据库任务要求从合法CSV输入通过实际CLI批次更新真实SQLite文件，包含参数化任意名称、完整成功状态和不足库存的明确错误/全批次回滚契约；独立sqlite3物理重开比较用户schema/data/index/trigger及真实审计行。两题各有完整原型/公开合同/运行时/实际正确及错误programme的消费者验证，再启动模型。新题只修后运行，不混作修前修后收益。

每次run单列：任务和入口/源输入/运行时间与实际请求事实、自然终态、独立最终消费向量、故障编号/严重度/触发条件/预期实际/影响/复现argv/原source位置及根因证据/修复建议/是否实测复现/未覆盖项。模型过程中的shell/test错误与最终交付故障、观察器错误及生产异常分开。通过范围记录“所测范围未观察到交付故障”，不写零风险或全域根治。优先完成真实任务和直接故障清单，不额外作者研究或重复审查。

首coding真实交付六输入全过，原33个工具调用31completed/2error。原`prt_g0VZj3nfN00Qm1jtZfW1`将同一路径Delete/Add组合，Add预验证发现原文件存在；`prt_g0VZj4P7a0004AMf1zZd`的test_release.py上下文不相等。两者后续均恢复，最终交付不能冒失败，过程工具误用也不能抹掉。已读当前apply_patch.txt/ts、Patch公共定义和现有正向工具测试：模型可见说明讲“sequence”但未解释所有段在写入前基于当前文件预验证，容易误解为Delete后Add。现有原子验证符合数据保护；修说明的事实缺口、推荐一个Update段容纳同文件多hunk并在不匹配时读真实上下文，不改变patch运行机制。增加实际Update结果正向测试；未知该说明对总体误用率的因果效果，不扩成通用编辑框架或任意重试。

新增数据库消费者首自检失败是Python sqlite3连接context manager只提交/回滚而不关闭句柄，Windows临时目录清理WinError32。修当前seed/snapshot为显式closing，原首路径/部分输出保；相同正确/原真实错误programme在v2目录完整消费结果为bundle正确0/错误拒绝、stock正确0/错误拒绝，包含物理重开和native2不足库存明确错误。这是检查工具故障，不是OpenCorvus候选或调度故障。一次root读取trace漏encoding出现cp1252解码错误，仅改UTF-8重读；原工具输出保。

## R04交付后具体合同核查登记

R04原三个固定消费已经通过，原Task自然完成；完整阅读其main.py和HANDOFF发现同一个`relative_parts`同时验证本机source和ZIP target，统一拒绝反斜杠。原公开合同只要求target为forward-slash ZIP路径，source为相对本机目录的路径；本轮明确native Windows。因此source写`left\\a.bin`仍指向原合法源文件，target保持`delivery/raw/a.bin`。拟仅对已封原pyz增加一次具体合同诊断：取原nested-binary业务数据，source的斜杠换成本机反斜杠，先用Path实际读取证明来源/字节等同；预期仍native0且ZIP逻辑内容/索引相同。用候选前已保存正确zipapp witness对同输入正向消费，区分环境误解与候选约束过宽。先落本登记再执行；不改原三输入、消费者通过记录、阈值、候选源码或模型，不称事前heldout或新模型结果。若存在明确合同歧义则记录未知，不强行判失败。

## 本轮实际结案

五次真实执行/三类业务：R01修前coding预测6/6，R02修前Task由60阶段请求上限中断、随后原pyz诊断6/6但无自然完成/handoff，R03修后coding预测6/6，R04归档原3/3而已封原件对具体合法Windows source反斜杠输入native1（原正确witness同输入0/精确payload+index），R05数据库原三场景全部相符（0/0/不足库存2，完整状态正确）。R04仍有实测未修交付缺陷；不能以after/result.status=passed冒完整合同通过。原消费结果/新具体诊断分列，无100或强制胜负。

过程七个恢复故障：五次失败patch outcome、两个真实native1自测命令；自测40ERROR+一个派生failure是一处列集错误，另六个WinError32是一处连接关闭错误，不冒独立业务缺陷。一次上游504和验收预算中断另列；原全部输入/输出、source、首错和修复均保。共享调度异常没有新证据，不扩无关生产横审。

baseline60实际请求（59 HTTP200/1 HTTP504），after80（80 HTTP200），均真实gpt-6.1-sol且streaming，总140/本轮180上限，未用额度作废，不复用旧额度。两个隔离实例都已正常dispose、staged auth/models退休、源字节保全；after native0，baseline native1是验收cap。实际请求原文probe确认修后76执行请求带新共享规则和patch说明，50带公开完成summary；其余helper保持专用提示。这只证明模型可见，不证明行为因果或费用可比；计费未知。

已修改唯一共享verification、公开manage_task/完成summary说明及真实patch契约说明；无host业务gate、schema事务/调度/路由改动。49项聚焦正向后端测试通过，核心package tsc通过，docs:check352/26通过。格式检查发现tools.ts的既有格式问题，核HEAD同样失败，不借本任务整文件改排；新runner和工具正向测试仅Prettier格式调整。R05仍有上下文误用、R04仍有合法输入漏验，因此根治未证；不为凑提升改输入/阈值或再跑模型。

完整项目/Git原件先封，再消费；R02为dispose后中断快照，明确区别。外部complete-project-archives保五个原项目文件树、Git/缓存，原生产SQLite另外保。本仓库[故障清单与投影](../../artifacts/2026-11-01-outcome-quality-repair/README.md)含各run原源码/pyz/测试/handoff、消费、原trace ZIP和实际请求收据。精确.gitattributes规则保存该目录实际CSV/日志等原字节；身份/完整性比较不当业务验收。

运行期间peer804d6e4只改变overlay/UI及其自有索引，与本轮backend实现无重叠；保其后overlay/翻译/媒体删除/索引/Bun工作区。保存时只暂存本任务文件和三个索引自有行。所有服务/模型现已结束；本轮任务是用户要求的多次实测与详细故障记录，原十题探索及automation保持PAUSED。最后提交/fetch merge/待推审查/完整hook/push以真实Git回执为准，不预填成功。
