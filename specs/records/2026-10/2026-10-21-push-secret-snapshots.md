# 推送中间提交的密钥检查与快照去重

## Recall

494单agent持续自主迭代，不委托。493 696cc64789091306bde46d93c7a43a436af8d8ce原1821正常push exit0，35f04f fresh fetch确认HEAD=origin/main；生产未改，原.bun/与packages/opencorvus/bun/未跟踪保留。原149目录完整配置10秒保存/5秒整份恢复仍未达，不因转入独立可修复工具链问题删除原要求。用户明确要求OpenAPI（开放接口描述）检查与推送阻塞安全解决、不能只记录问题；本轮针对真实推送密钥检查缺口与重复工作，不更改检测规则或绕过hook（钩子）。

已读493/492 Recall及实际push日志，.husky/pre-push，完整script/secret-scan.ts/ScanOptions/parser/Git index/tree/blob分批与scanText，.github/workflows/test.yml调用及script/github-actions-workflow-contract.test.ts只涉及原命令的契约。全仓精确搜索parsePrePushLocalRefs/secret-scan imports/listTrackedEntries等：parser只有本文件main调用，无现存scanner专用测试；CI（Continuous Integration，持续集成）是bun run script/secret-scan.ts，pre-push是同命令加--pre-push-stdin。没有涉及UI（User Interface，用户界面）自动化路径，禁止新增或运行此类测试。

已读官方[pre-push四字段合同](https://git-scm.com/docs/githooks#_pre_push)、[rev-list可达集差](https://git-scm.com/docs/git-rev-list)、[cat-file实际blob字节/大小](https://git-scm.com/docs/git-cat-file)。Git object ID（对象标识）用于已声明不可变blob真实身份去重，不是被禁止的可变源码摘要门槛。

## 修改前深度和影响分析

可观察：492/493正常push的secret-scan阶段长时间无输出；源码把所有待推ref最终树与整个index相加，仅在结果hit集合去重，同一路径/同一blob因此反复读/按行执行模式。直接触发是scanRefs丢弃remote端对象信息，parsePrePushLocalRefs只取local字段，listTreeEntries只覆盖各tip；“提交凭据→后续删除→一起push”中间blob已不在tip/index，理论上可漏检。先用自有真实临时Git仓库、假形状字符串复现原checker的实际成功输出，再修，不把静态线索直接当已复现漏洞。

根因是快照选择只见最终状态，去重又只在已发现结果上，不能覆盖中间新增/更改的秘密，也不能省去同一immutable内容的扫描。原路径未根治是此前加强了pushed-tree/index身份，但没有使用完整remote→local可达变化。相关边界：同步scan返回SecretHit[]、全量tip/index、大小1MiB/扩展名/Gitlink规则、忽略行和六个检测模式、分批真实cat-file/缺失对象错误、CI默认HEAD、pre-push四字段stdin、多个ref/新ref/delete/merge。已有parser只有一个内部调用，可整体替换，不保留旧协议适配或双源。

方案只修改唯一scanner与聚焦正向非UI测试及本规格/相关文档；不改业务Provider、数据库/schema、迁移、模型/消息、用户18571或Git安装，不复制凭据/catalog，不发模型请求（本批预算0）。没有新的调度/队列/恢复/终态现象；若出现按共享机制横向审计全部Host/Task/Mission/Session occurrence（执行轮次）及重试/重启/串并行/跨项目，不称偶发。

## 实施方案（复现和修改前）

1. 保存原scanner精确私有副本；建立全新自有测试Git仓库（不是主仓分支/worktree），仅使用生成的假形状key，没有真实凭据/remote/push。原CLI（Command Line Interface，命令行接口）在该仓库实际接收四字段stdin，保留base→含key提交→清除tip的原成功输出与Git持久化事实；不打印完整key、不让假key进入本仓提交。
2. parser保留全部四字段为PrePushUpdate；删除只取tip的旧parser。每个非delete update按local减remote（新ref remote全零则从root）枚举所有新可达commit，按commit身份去重；真实git diff-tree --stdin --root -r -m --no-renames --raw --no-abbrev --no-commit-id -z读取新增/变更路径及新blob，删除项没有新内容。merge对父差异、root/rename/跨ref都进入真实新增路径；不把每个历史commit全树展开，避免新分支的历史×整仓规模。
3. 保留当前各tip完整树和整个index，再加中间新引入/更改的文件快照；用真实cat-file元数据确定历史blob大小后应用相同扩展名/1MiB/Gitlink规则。每个路径+真实blob只扫描一次，跨不同路径或不同版本均保留，先后顺序沿原tip/index再历史；没有跨运行缓存、diff-only弱化或跳过index。保留原64MiB元数据输出资源上限；超过或缺失对象明确失败，不退回只扫tip。通用script不绑定Bun专用API（Application Programming Interface，应用程序接口）。
4. 聚焦正向测试使用真实Git：中间key→清除仍返回明确file/line/pattern错误；同路径不同blob两次正确命中、同blob不同路径都报告；多个ref/新ref/root/merge新增路径、暂存区独立秘密、四字段解析与明确坏输入错误。实际CLI接收原stdin并exit1、明确错误摘要，不能只mock或字符串检查。临时仓库及假材料保留为本批自有证据，清理前核验路径与物理结束；不会将其当产品UI验收。
5. 在同一原仓固定696cc6478 tip/精确相同index运行before/after真实scanner core，各自原owned-host物理边界和固定读输入。记录耗时/输出/实际候选数，不以减少安全覆盖取提速。若性能无收益，安全漏洞仍以独立真实错误合同交付，明确性能未达；去重必须从代码与实际Git输入证明，不能加只断言“不调用/不存在”的测试。
6. 完成聚焦非UI tests、适当types/docs、真实正常pre-push全部checks，不修改pattern/allow-list/size规则，不no-verify。更新三索引，所有原scope物理/output/request/launcher精确结算、源3665行与用户数据保持，范围提交/fetch/merge/完整pending集合/正常push/fresh一致；不新建主仓branch/worktree，不tag/Release。此修复不宣称原全量配置性能或新Sources/Rendering视觉已达成，长期Goal active。

## 首轮证据与同范围错误输出修正（修改前）

原cc5724真实原CLI复现exit0/OK，但相同checker明确读取实际intermediate commit时返回secrets.ts:1/provider-key，持久化实际blob确实有生成假key；原diff-tree NUL（Null，零字节）记录也确认所选格式，不靠猜解析。修复后原d0b585在同一原fixture/四字段输入返回exit1及明确文件/规则，首次6正向测试b68c57 exit0（真实Git/core/CLI，非UI）。独立types首8f0641只因临时检查命令从根查找bun类型，而仓库依赖按workspace安装；显式使用现有opencorvus @types根后原1cf691 exit0，没有安装依赖或掩盖错误。两原日志保留。

原before26978/after49325 benchmark均已真实exit0，同696cc6478与精确原index bytes/71757文件；78.4205秒→40.1732秒、741→372个真实Git调用、72511→36253个blob读取查询、2994593485→1497175930响应bytes。基准当前全部hit为空，不能代替新漏洞正向错误合同；CLI/真实Git fixture另外证明中间历史确实拒绝。模式/忽略/1MiB/Gitlink规则保持，原完整业务配置性能仍未达。

当前触及错误输出的直接代码证据：scanText把实际匹配内容截取16字符存入SecretHit.match，main又把该片段打印到stderr；原fake中间命中也保留这部分真实生成内容。凭据片段进入诊断违反本仓凭据不入日志约束。全仓SecretHit/该match实际调用只有本scanner/main（新tests的report只用file/line/pattern），没有SDK（Software Development Kit，软件开发包）或第三方公开契约。故删除match输出字段与打印，只保留file/line/pattern/description的明确报告；内部同一发现去重仍使用实际匹配，保持不同版本/不同凭据的正确发现，不合并漏项。

旧help在尚未推送时一概声称需要filter-repo/force push也不准确；改为撤销真实凭据、移除所有待推提交及index中的凭据、若已经发布则与维护者协调清理，不自动建议覆盖远端历史。同步修正旧注释中未实现password模式/错误JWT长度描述，六个实际模式值不变。补充真实root历史、rename到可扫描后删除和明确无凭据内容的结构化错误合同，再完成聚焦验收/正常push。

最终e63546/ae9115 6 pass/10 expect，新增真实root与rename中间版本、明确安全发现对象/CLI行；最终types ae9115 exit0。同一原fixture最终453775保持exit1/file/line/pattern/description，无凭据派生内容。原7d27a7匹配器确认全部71757索引项/原index bytes准确，两个原scope物理/output/request/launcher及原出生终态完整，runtime/data均空；原源schema3/integrity及3665行/rowid/字段/时间/bytes/mtime保留。

归档首5dd424子Node失败：README已先创建新目录，而归档器错误要求目录尚不存在；此组合shell随后继续执行docs并返回docs的0，不能把它当归档成功。保存原归档器文本，核验目录只有本批README后，将前置条件改为精确该自有README、后续每个文件仍COPYFILE_EXCL，再单独重跑归档。原docs-final实际345 ops/26 groups通过；准备器错误不改变checker、测试、模型预算或数据事实。

原84ee6c归档实际exit0；[原失败、最终真实CLI、71757项匹配与所有原scope](../../artifacts/2026-10-21-push-secret-snapshots/README.md)及三个索引同步。原294160格式/diff检查0，4cbd43 fetch origin0，当前main/upstream origin/main；生产变更仅唯一scanner及聚焦测试，架构安全边界准确同步。源/用户数据库没有迁移或修改，真实Provider请求0、凭据/catalog副本0。正常提交前后审查所有pending commits并执行完整hooks推送，不把此次工具链修复当长期Goal或原业务配置性能完成。
