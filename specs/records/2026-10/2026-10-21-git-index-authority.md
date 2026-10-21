# 密钥检查的Git暂存区权威读取

## Recall

495持续单agent自主迭代。494 565567a64d27f0e35f5b40d35ec8e2404c79fa25原61673正常push/d201d3 exit0，35423b fresh fetch确认HEAD=origin/main；六个真实Git/CLI（Command Line Interface，命令行接口）正向测试、独立types与正常hooks通过，中间历史/安全错误和同71757输入78.42→40.17秒已交付。原.bun/及packages/opencorvus/bun/未跟踪保留。原149目录完整业务配置10秒保存/5秒整份恢复仍未达，不借工具链增量删除旧验收。用户要求自主解决问题，禁止子agent、UI（User Interface，用户界面）自动化、绕hook、改用户进程或数据库。

已读494 Recall/唯一scanner与六项正向测试、实际push、当前security-permission边界及全仓helper引用。精确搜索显示parseGitIndexEntries/parseGitIndexPaths/listTrackedFiles/gitIndexPath/readUInt32BE只有本scanner定义/内部调用，生产main实际只需listTrackedEntries；新tests只用scan/parsePrePushUpdates，SDK（Software Development Kit，软件开发包）无此接口。所有去重、历史、保护输出及原六模式/忽略行/1MiB/Gitlink/stage0合同继续保留。

已查权威[gitformat-index](https://git-scm.com/docs/gitformat-index)：Git支持index v2/v3/v4，v4路径压缩/无padding，split index解释不同，SHA-256（Secure Hash Algorithm 256-bit，256位安全散列算法）仓库OID（Object Identifier，对象标识）长度也不同；[git ls-files](https://git-scm.com/docs/git-ls-files)的--stage/-z提供原模式/对象/stage/原始路径，默认展开sparse index。采用这些成熟读取而不是扩展手写二进制兼容矩阵。真实Git对象身份/自身协议完整性不属于禁止的可变源码摘要门槛。

## 修改前分析与未知

线索：当前readUInt32BE/parseGitIndexEntries固定62-byte记录、20-byte OID且只接受v2/v3；没有解析split/sparse扩展；size来自index的工作区stat缓存而非所选不可变blob。根因候选是复制Git内部持久格式而没有让Git自身解释其完整权威，可能导致有效v4打开失败、共享索引漏/错路径、SHA-256偏移错误和按错误size读取内容。**尚未真实复现，不能先称全部已证漏洞。** 旧路径此前加强了对象内容与历史，但沿用这个旧索引解码，因此没有根治格式/元数据来源。

影响面是同一个本地pre-push与默认CI（Continuous Integration，持续集成）checker：repoRoot、GIT_INDEX_FILE、真实stage0路径/模式/OID/大小、后续cat-file及1MiB资源边界。无新业务Provider/模型、DB（Database，数据库）schema/迁移、配置、用户窗口/18571或调度/恢复变化；模型预算0、凭据/catalog复制0。若出现共享调度/终态异常，立即横审全部Host/Task/Mission/Session occurrence（执行轮次）、重试/重启/串并行和跨项目，不能用测试仓库标签降级。

## 启动前方案与验收

1. 保存494已推scanner私有原副本，在全新自有临时测试仓库真实观察SHA-1（160位安全散列算法）/SHA-256、v4、split/sparse与update-index --cacheinfo的实际输出/原checker错误。只生成假材料，不操作主仓索引/分支/worktree，不remote/push，不打印任何真实凭据。保留原失败/格式/实际Git权威元数据，未复现项标未知。
2. 已确认问题后，用唯一git ls-files --stage --full-name -z读取stage0路径/模式/OID，再用现有cat-file --batch-check取得真正blob大小。Gitlink显式保持其非blob归属/既有跳过规则，不把它错误送入blob大小读取；原分批/错误/资源约束继续。选择老版本已有的stage协议+现有batch-check，避免为了单进程新format字段提高Git最低版本，也不保留任何手写fallback或索引版本兼容分支。
3. 删除被整体替代的二进制索引读取/解析及仅服务它的无调用helper；listTrackedEntries当前输出结构保留，全仓消费者按当前事实收敛。必要删除只限该读取链，原fixture-only文件覆盖/模式选项不作无关清理。额外读取成本必须验证，不能仅以改用Git推测性能。
4. 聚焦正向真实Git合同：各格式/共享与稀疏返回完整准确file/mode/OID/stage/真实size；cacheinfo零stat缓存仍返回真正blob大小；替代索引遵循Git的确切归属；中间历史/保护输出/原六测试继续。实际生产CLI对真实暂存假key返回明确规则错误，不以mock（模拟）/DOM（Document Object Model，文档对象模型）/源码文案检查作验收。坏index走明确Git错误，不回退扫工作副本。
5. 同一固定565567a64 tip与精确相同主仓index做真实before/after checker，原owned-host资源边界/物理/output/request/launcher/精确出生终态，source3665行/bytes/mtime与实际主索引只读保持。71757是上一批冻结数量，本批新增文件后的真实数量必须按实际记录，不能硬当同样规模。旧完整Config与UI资格另计，本轮不运行UI自动化或虚报新视觉。
6. 来源/原失败/聚焦测试/完整checker及数据归档和三索引同步，当前docs/types及正常hooks；范围提交、fetch/merge upstream、全pending审查、正常push/fresh一致。无主仓branch/worktree、无rebase/force/no-verify/tag/Release。长期Goal active。

## 原真实复现与修复裁决（生产修改前）

原29229e六仓库观察器exit0，全部是实际Git及494原scanner，不是模拟二进制：SHA-256仓库Git列出base.ts/staged.ts，旧list为空且scan为空，暂存假key漏检；v4明确unsupported error；split两项文件名均空，命中位置也为空；sparse把outside/树当blob报错；cacheinfo的cached.ts旧size0、真实不可变blob1048633 bytes；相对GIT_INDEX_FILE正确在fixture由Git读取，旧手写路径却在宿主CWD（Current Working Directory，当前工作目录）找alternate-index而ENOENT。六个原数据/错误均保留before-reproduction.json，只有生成假key，无真实凭据。

由这些持久化与真实工具结果确认共同根因是手写索引解释/缓存stat而非模型、SQLite迁移或单一测试格式。选择Git --stage/-z与既有cat-file而非新的--format对象大小字段，以保留已用Git命令的版本边界。唯一当前输出仍是stage0的file/OID/mode/size，Gitlink非blob条目按已声明语义保留size0供既有过滤；blob大小来自实际对象，格式/压缩/共享/替代路径交给同一Git权威。旧解析链及parseGitIndexPaths/listTrackedFiles无生产消费者，删除影响仅这一个被替代的内部读取面，不清理无关fixture覆盖。

原83183/2522f1聚焦17 pass/31 expect，覆盖S1/S256各v2/v4/split、完整sparse、cacheinfo真实size、相对替代index、Gitlink和明确坏index错误，原494六合同保持。另沿缓存size根因加深真实换行观察，原e2609f exit0：工作/缓存1200041 bytes，Git实际归一化blob800040 bytes；原checker0发现，新checker明确normalized.ts:1/provider-key。不是放宽1MiB，而是用其本来应约束的不可变blob大小，修复有效小blob被大工作副本stat错误排除。只有生成假材料。

下一匹配benchmark仍冻结565567a64及主index原bytes；本轮修复会合法改变cached-size错误元数据，因此输入对照按file/OID/mode/stage真实身份核对，after.size另外与原tip的真实Git blob元数据逐项核对，不用旧错误size当期望值或恢复双源。当前原仓index与tip相同内容时，所选内容身份应全保持，实际文件数与读取量按实测，不预填71757。正常源码/测试变化不进入该冻结index，基准完成后再暂存。

## 完整修复资格与成本

原18a8d7在同一六个原fixture全部返回准确Git权威元数据，五个实际复制当前CLI均exit1/正确文件行规则，六个原index bytes/mtime保持；大于1MiB的cacheinfo只验证真实大小，既有资源策略保持。原28616/946b03最终18 pass/33 expect，含真实CRLF（Carriage Return and Line Feed，回车换行）归一化小blob命中；原39a289独立types exit0。

原81830/74aefb before与65573/70bf7d after均原exit0，同固定565567a64/71787文件/原index bytes；40077.3537→42061.8762ms（约+4.95%），372→374个Git调用，blob查询36270与响应1497520386 bytes均相同。本轮是正确性/安全修复，承担实测约1.985秒元数据成本，不宣称提速；494去重收益仍在，不恢复漏检读取器。

原3d5e72验证所有原path/OID/mode一致，after全71787个size与真实不可变tip对象精确一致；19741项缓存stat大小得到校正，原主index bytes保持。两个原native scope物理/output/request/launcher完整、精确原host/target出生dead_or_reused、runtime/data空；原源schema3/integrity、3665行/rowid/字段/时间/bytes/mtime一致，源initializer/业务输入0，模型0/凭据/catalog复制0。

删除旧手写读取链并保持当前公开发现结构，当前security-permission同步Git权威与真实内容大小边界。此修复没有新增UI/Provider资格，也未完成原全量业务Config性能；原10秒/5秒仍未达，长期Goal active。归档当前真实复现/原失败/匹配与正常提交推送按方案收尾。

扩展原v3资格时，原54530/bf5322实际exit1（18 pass/2 fail）：两v3输入的真实header仍为2，提前输入资格断言正确阻止了错误标签。仅传--index-version=3在无扩展flag时被Git写回v2，官方update-index说明默认2/3由扩展特性决定。原失败完整保留tests-complete.log，不把已18项通过包装20项；修fixture为真实skip-worktree扩展flag后再请求v3，并保留真实header等于3的正向资格，生产读取没有回退或改动。

原3502/5094fd最终实际20 pass/43 expect，619900 types0；v3输入真实header3并完整metadata/报告通过。原e62093归档实际0，当前[完整证据](../../artifacts/2026-10-21-git-index-authority/README.md)及三个索引同步。没有新增UI资格，下一轮优先对用户当前内置页面18571作授权范围内的只读实图核对，与已验证的隔离Home/Goal入口对照，遵守不刷新/重启用户窗口或进程；不得把旧隔离截图当成当前用户页面已修复的证据。原配置性能未达继续保留。

原3e8573 docs:check实际0（345 ops/26 groups），0f3c0b格式/diff检查0，512138 fetch origin0。当前main/upstream origin/main，只提交本轮唯一reader、聚焦tests、当前安全架构和规格/证据；原两未跟踪目录保持。正常hooks/fetch-merge/pending检查/push后再复核fresh远端，不创建版本或发布，不把原整体Goal标complete。
