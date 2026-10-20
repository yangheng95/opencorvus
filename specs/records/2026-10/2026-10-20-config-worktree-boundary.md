# 配置快照与项目工作树边界

## Recall

持续单 agent，自主调查、修复、真实验收并正常提交推送；用户后续单 agent 要求覆盖旧 goal 中三 Astra 文案，不委托。上一轮是 progress：20b67437570fba7476a07d67eeeb2030a651fd29 已提交，fetch/merge 后完整待推集合仅本任务，通过全部正常 hook，push 后 fresh fetch HEAD=origin/main。44 个正向后端用例/176 断言、完整原生服务与实际 gpt-6.1-sol streaming、全部 41 并发 GET 已验证；页面最长27387→17355ms，但 cold16789.526/restore17368.494ms 仍未达到10000/5000ms。开始仅既有 .bun/、packages/opencorvus/bun/ 未跟踪，全部旧历史保留87 Projects/schema2；上一轮服务、检查句柄、临时完整 auth/models 对均已结算退休。

继续 benchmark-debug-template（基准测试调试模板），不降低原指标，不清库、不跳过 Project、不增加长期缓存，不创建分支/工作树，不运行 UI 自动化、不重启或刷新用户18571进程/窗口。构建仅校验内存迁移，不碰真实用户库。隔离真实模型验收沿已授权完整凭据与 models 配对，内容不进入日志/spec/Git。新服务必须保留完整QA412历史，原native physical/output/request/launcher和checker完全结算后才退休两套文件。

## 修改前分析

已读AGENTS、449 Recall/证据、05-config 当前候选/identity lease/独立snapshot合同、448 Git修复决策、443配对snapshot历史、395只读快照用途、Config加载/只读reader/全局候选与reconcile、Project.fromDirectory/注册路径/物理Git解析、Instance工作树context/identity lease、配置层级/候选验证/Git发现现有后端测试。全仓搜索snapshotForProject、readOnlyProjectSnapshot、readOnlyWorktreeBoundary、gitRepositoryPaths、--show-toplevel；前者当前源码只在Config导出与配置层级测试调用，历史隔离预检亦有用途，必须保留独立只读语义。Config唯一git调用就是该helper；Project解析及Engine GitProcess是另两处。Engine提供原始Git command结果，不拥有Project/Config边界决策，排除本轮改动。

可观察现象：449实际87项目candidate一轮仍额外执行87次config.snapshot.worktree，总重叠等待34.6–39.5s（不是墙钟），全保存16–17s。代码明确这些调用已经位于Instance.provideProjectIdentity callback中，之后before/after使用同一捕获边界；仍另行hostGit rev-parse --show-toplevel。性能影响程度尚待完整after实测，不能从重叠累计直接推导收益。

正确性根因：Project仅认当前目录自己的.git，普通子目录保持独立非Git项目；Config helper却让Git向上搜索父仓库、text.trim路径，并在任意非零返回目录猜测。两者在普通子目录、损坏local .git、Git缺失和POSIX路径末尾空白时可得不同边界。Project已有严格Git双路径parser、command-unavailable/command-failed/invalid-output错误及Git原安全检查；Config仍平行维护旧推断。旧443只复用两份snapshot间的额外Git查询，448只改Project parser，尚未统一Config与已准入工作树的事实。

调用/数据影响：全局候选已持有有效Project identity lease，其context.worktree来自该次准入的sandbox，普通项目/linked worktree/注册execution目录各有原边界；Config.get也以该context为边界。候选直接消费它，保留初次/准入身份重查、Project物理队列、SQLite generation、完整before/after稳定配置source、全部模型/Skill/profile验证及runtime结算。不能把Project.project.worktree（linked的主仓库）误当Instance.worktree（当前sandbox）。独立snapshot无Instance，不得为消除查询而创建Project、写marker或启动runtime。

当前未观测新的队列/调度/恢复/终态异常。本轮不改共享调度、队列、lease、Task/Mission/Session occurrence或DB协议；这些消费者继续通过当前Config及原Project/Workspace/context获得同一配置。若真实验证揭示新共享异常，立即横向审计全部生产入口/正常终态/重试重启/串并行/多项目，不按单例降级。

## 实施前方案与验收

1. 先新增真实后端正向合同，原实现复现：父Git目录有显式dynamic/full_access，普通非Git子项目应为global base/ask且与该子项目正常Config一致；损坏local.git和Git缺失映射ProjectGitDiscoveryError明确reason/status，普通目录在Git缺失时仍可读取有效global配置。linked/alias保留当前sandbox来源；POSIX特殊路径保留明确平台边界。只用真实文件与Git/原checker，不用UI测试或源码字符串断言。
2. Project中将已存在的Git文件/命令可用性/严格路径解析/展示路径提取为单一只读发现primitive，供fromDirectory和新的只读worktreeBoundary使用。fromDirectory原identify、registry、两次发现与admission保持；boundary只返回sandbox，不执行identify/marker/DB写入。只读普通目录明确返回自身；存在.git时必须成功得到原严格事实，否则保留typed错误。
3. 删除Config旧readOnlyWorktreeBoundary及其唯一hostGit import。独立snapshot调用Project.worktreeBoundary保持每次独立发现和只读配置reader；全局候选在原identity callback中消费Instance.worktree，不增加有条件fallback、旁路、缓存或另一个身份来源。
4. 聚焦正向回归配置边界、全局所有Project验证/retention、候选Skill、配置层级、Project Git发现/别名/linked及必要类型/格式/文档/OpenAPI检查。原UI/Goal内容不改，但真实开发/ui手动操作保存期间会话，截图人工复核；全部并发GET计入。
5. 以449交付冻结全历史after为before（源码差异为当前最终格式及同一生产逻辑），新450隔离after使用同一正式441界面和原helper，完整88+历史、同一配置service→HostTransport→HTTP保存/恢复，实际gpt-6.1-sol流式预检。cold≤10s、restore≤5s、全部真实并发GET≤20s；失败照实记录并继续根因迭代。
6. 更新05-config唯一边界合同与索引、记录实际证据/限制，精确新artifact目的地与实际敏感值扫描，退休临时配对，提交所有本轮改动；fetch/merge、完整待推集合复核、正常hook push、fresh fetch及结束status。性能未通过不标goal complete。

## 修改前实际失败

原checker完整结算exit1：1 pass、1 POSIX skip、4 fail。普通子目录的独立snapshot和已注册子项目的global candidate都因旧Git边界越过父目录而抛NonCanonicalConfigFileError（实际为父配置被误判成冲突，不把推测的继承结果当观察）；损坏child.git snapshot却成功返回配置，Git缺失则是普通Error/500，均不符合Project精确错误合同。main/linked/alias来源用例已通过，保持其现状。此时尚未修改生产源码。

## 实施与局部验收

Project新增只读worktreeBoundary，共用原严格Git路径发现；fromDirectory复用同一private discoverGitDirectory，identify/SQLite/marker仅留在原注册路径，原初次/准入复核保持。Config旧猜测helper和唯一hostGit import删除，standalone继续独立只读发现，global配对snapshot直接消费原identity lease中的Instance.worktree。没有新缓存、注册旁路或数据格式。

原8556 checker joined0：边界5 pass/9断言和Project Git5 pass/14断言，两个POSIX明确skip。原69866回归checker joined0：配置层级23/72、所有Project候选4/28、真实candidate Skill目录7/7、物理身份3/5、identity retention4/14；合计51正向用例/149断言、2平台skip。backend类型检查原70108 joined0。格式化只另调整Config既有applyEdits表达式换行，无行为变化。独立snapshot调用链仅目录stat/本地.git/原Git/物理显示路径，没有identify、注册或DB写入。

完整性能轮次后补同一真实服务的公开HTTP触发用例：在原QA根新增持久450父Git fixture，其配置dynamic/full_access；只注册其普通child，经GET/config→PATCH/global/config→GET/config→PATCH/global/config恢复验证，确认真实candidate不因父source误报冲突。保留父fixture及新注册child供未来全历史验收，不删除或缩减Project。该补充晚于已冻结的两次性能日志，不将额外写入混入原性能窗口。

## 真实验收结果与交付

原完整历史88 Projects下cold13158.709ms、restore12379.774ms；对比449已交付87 Projects的16789.526/17368.494ms，均有改善但仍未达到10000/5000ms。初次/准入Project身份发现86/84组照旧，每组原Git查询仍保留；before/after snapshot各88个，模型/Skill/profile及原runtime结算完整，没有清库或跳过候选。重叠阶段累计不能当墙钟节省。

本轮全部25个真实并发GET均HTTP200，最长10041ms，原20000ms页面门槛通过。不同轮次手动点击的到达时间有差异，不将17.355→10.041s全部归因于代码成本。真实会话ses_hKc91xeyK1NVxgLXwyR7预检分别证明credential usable、catalog projected、实际gpt-6.1-sol streaming，手动页面显示真实OK、Ask和模型，首页与Goal入口截图已人工复核，无UI源码改动或自动化测试。

公开HTTP补测原14861 joined0，4个原响应均200且requestID有效，子项目base/ask与global username累积正确，canonical完整恢复。该fixture与注册child保留，最终只读SQLite结果schema2/89 Projects；88为性能轮次集合，89为补测后集合，不能混称。没有触及用户18571应用、用户项目或用户数据库。

原checker74671 joined0、公开shutdown200、native launcher96180 joined0，精确Host/Target dead_or_reused，原physical/output/request全部结算、runtime auth/models退休后才删除private authority复制对；源授权metadata保持。归档目的地在写入前核对精确新绝对路径，归档文本扫描实际敏感值。最终证据见[artifact入口](../../artifacts/2026-10-20-config-worktree-boundary/README.md)。

05-config更新为唯一准入sandbox事实及独立只读发现合同，三索引同步。类型、格式、文档、架构索引和OpenAPI（开放应用程序接口）路由6规则/35文件检查通过。新只读primitive不执行Project注册、marker写入或DB写入；没有schema或持久协议变化。POSIX两个特殊路径分支未在Windows验证。完整保存性能仍失败，后续继续调查Project身份发现与原生启动成本；goal保持active，不宣称全部完成。
