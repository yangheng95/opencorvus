# CI workflow and dependency repair

## Recall

用户要求“修复ci问题”。本侧对话只修复当前持续集成（Continuous Integration，CI）失败，不继续主线程界面迭代、不委托、不创建分支或工作树、不重发安装包。当前main起点c3a5ee40c；会话组件、conversation-ui、dom-utils与07-panel-reactivity有主线程未提交修改，必须保留。

验收：最新失败run38251166220的workflow contract与dependency audit使用原检查器通过；聚焦非界面正向行为验证、完整锁文件差异审查、文档检查与推送钩子通过；推送后检查真实GitHub运行。不得忽略安全告警、降低审计阈值、删除有效检查、伪称旧安装包已修复或用局部测试替代远端结论。依赖安装不改写主线程正在使用的node_modules，先使用lockfile-only和独立临时依赖目录验证。

已读AGENTS、RELEASE、test.yml/build.yml/setup-bun、github-actions-workflow-contract/ci-scope、根与相关package manifests、Bun锁文件、package-topology、2026-10-05-dependency-remediation记录及发布日志方案。已全仓搜索相关依赖的声明、调用、锁节点、运行时打包入口和历史决定；本次检索的workflow测试没有界面自动化或负向断言。没有发现Task/Mission/Session调度异常，故不变更其状态、队列、恢复或多项目契约。

## 根因与影响面

1. verify在workflow contract第692行失败：prepare新增真实“Verify written release notes”步骤后，测试仍断言末尾固定9步，遗漏新增步骤。旧测试按位置截取，无法表达从版本检查至发布认领的当前完整顺序。修正当前步骤序列和日志检查命令契约，并实际执行根日志checker；生产发布流程本身保持现状。
2. audit报告5项实际锁定漏洞：braces3.0.3、http-cache-semantics4.2.0、katex0.16.47、postcss-selector-parser6.1.4、sprintf-js1.1.3。历史审计已保留前两项未修复事实，新增公告与锁定版本停留导致持续失败。失败阻止critical builds与三平台unit开始；不能把后续skipped当作另一调度故障。
3. 官方npm（Node Package Manager，包管理注册表）当前提供http-cache-semantics4.3.0、KaTeX0.18.11、selector-parser7.1.6；对应已公布修复范围。braces仍只有3.0.3，但实际唯一父链@parcel/watcher2.5.1→micromatch使用它，新watcher2.6.0已用picomatch；sprintf-js仍1.1.3，而tedious20.3.6起已删除该依赖。当前锁包含tedious20.0.0与mssql/tedious18.6.2两个节点，需要统一处理。
4. Watcher是后端文件监控与原生打包依赖，须验证实际文件事件与忽略规则；HTTP缓存和CSS选择器用于官网构建；KaTeX由Mermaid消费，需检验公开API及构建兼容。Tedious为Drizzle安装图中的SQL Server依赖，生产源码无直接SQL Server调用；升级到20.3.7需明确Node22和mssql旧父范围风险，验证实例/API与实际数据库路径。现有Bun版本1.4.0、Node22满足运行时要求，不能据此声称连接了真实SQL Server。

## 实施计划

1. 更新release prepare契约，使用版本校验步骤作为完整有序序列起点，纳入written notes并验证其真实命令。运行原失败的两份workflow测试及check-release-notes。
2. 通过现有单一manifest面精确更新watcher声明及http-cache-semantics/KaTeX/selector-parser/Tedious根override；用Bun1.4.0只更新锁文件。审查全部实际节点差异并保留patches/无关版本；遇到跨主版本不兼容先修正方案再继续。
3. 在独立临时依赖目录验证精确新版本的公开行为、原生watcher事件、缓存隔离与正常缓存复用、选择器转换、数学渲染和SQL参数实例；不测试或改写页面DOM。原bun audit必须无过滤通过。线上构建负责全图frozen安装与平台集成；本地不替换主线程依赖。
4. 更新证据与索引、正常提交、fresh fetch/merge并审查全部待推送提交后push。观察真实CI结果，出现后续失败继续按日志修复；无未核验的“全部通过”声明。

## 外部证据

- [原CI](https://github.com/yangheng95/opencorvus/actions/runs/38251166220)：17个workflow测试通过，1个顺序测试失败；依赖审计2high/2moderate/1low。
- [braces公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)与[watcher2.6.0](https://github.com/parcel-bundler/watcher/releases/tag/v2.6.0)。
- [HTTP缓存公告](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)与[官方4.3.0包](https://registry.npmjs.org/http-cache-semantics/4.3.0)。
- [KaTeX公告](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-238p-pmpm-9mq7)、[选择器公告](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf)。
- [sprintf公告](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)与[Tedious移除实现](https://github.com/tediousjs/tedious/commit/e936c0f98a710538ed03fab266c284cb81eddfe3)。

## 本地实施与验证

现有workflow contract已按当前prepare完整顺序修正，且正向校验实际日志命令。原两文件测试18通过/206断言；真实check-release-notes检查61个历史版本通过。没有修改workflow的审计阈值、终态判断或跳过条件。

watcher及现有7个原生声明统一升级2.6.0，四个根override分别固定HTTP缓存4.3.0、KaTeX0.18.11、选择器7.1.6、Tedious20.3.7。全部实际锁差异为18个节点版本替换、12个过期节点删除：watcher及其12个平台节点、四个选定依赖与KaTeX的commander；删除micromatch/braces链、旧watcher detect-libc、旧Tedious及其重复依赖。上游watcher不再发布win32-ia32，项目现有交付平台是Windows x64，不改变项目矩阵。现有patches及其余版本保持原值。

隔离目录只复制当前manifests、patches和完整锁图，以Bun1.4.0执行frozen安装，1645包成功安装；共享node_modules仍保持旧版本，未刷新或关闭用户应用。新增dependency-ci-contract.test.ts通过真实父包解析依赖，五个正向行为验证实际原生snapshot/事件、带brace的忽略规则、缓存命中/用户变化重验证、CSS转译、SQL参数和GUID错误契约，5通过/10断言。SQL首次冷加载驱动及Azure依赖耗时11秒超过测试默认5秒，故为该真实依赖初始化设置30秒上限后原测试通过；未修改产品超时。测试文件仅复制到隔离安装目录执行，同一文件也进入原CI后端unit入口。没有浏览器或界面自动化断言，数学展示尚未做视觉验收，SQL Server网络连接也不作完成声明。

原始bun audit无ignore或等级过滤，实际检查1731包返回“无漏洞”；Bun frozen lockfile-only验证、package-topology（10工作区）、其聚焦测试（1通过/3断言）、docs:check（345操作/25组）与diff检查通过。新的真实GitHub构建、三平台unit与service结果待推送后核验。
