# Git索引权威与暂存内容大小

[修改前Recall、全仓引用和实施方案](../../records/2026-10/2026-10-21-git-index-authority.md)。495单agent；唯一scanner改用Git自身索引读取与真实blob（Git内容对象）大小，删除旧二进制读取链。没有DB（Database，数据库）迁移、Provider/模型/凭据/catalog或用户18571操作；**原完整业务配置10秒保存/5秒整份恢复仍未达成**。本轮没有新UI（User Interface，用户界面）视觉资格。

## 实际失败与同输入修复

[六个原Git仓库](before-reproduction.json)及[同一仓库修复后结果](after-reproduction.json)：

| 输入 | 旧checker | 当前行为 |
| --- | --- | --- |
| SHA-256（256位安全散列算法） | 实际两项文件却返回空、暂存假key漏检 | 完整64字符对象身份及明确错误 |
| index v4 | unsupported version 4 | 正确完整路径与暂存报告 |
| split index | 路径空，报告定位也空 | Git还原全部真实路径 |
| sparse index | 把outside/树当blob报错 | 完整叶文件及正确报告 |
| cacheinfo | 把缓存stat的0当内容大小 | 真实不可变blob1048633 bytes |
| 相对GIT_INDEX_FILE | 在宿主目录找文件而ENOENT | Git按其仓库归属正确读取 |

六项完整元数据精确等于真实Git权威，五个实际CLI（Command Line Interface，命令行接口）在同一原fixture返回exit1/正确文件行规则；六个原index bytes/mtime保持。cacheinfo大于原1MiB边界，仅验证真实大小且保留既有资源策略。只有生成假材料，未使用真实凭据。

[CRLF（Carriage Return and Line Feed，回车换行）真实复现](crlf-reproduction.json)：工作副本/缓存1200041 bytes，Git归一化后的暂存blob800040 bytes；旧按缓存大小排除而0发现，当前按真实blob大小返回normalized.ts:1/provider-key。1MiB约束对象被纠正，规则没有放宽。

共同根因是旧实现固定20-byte对象/62-byte记录、v2/v3路径布局，忽略共享/稀疏解释，且用工作副本stat判断内容。当前唯一Git ls-files --stage/--full-name/-z与既有cat-file元数据负责完整事实，stage0/Gitlink语义保持；旧helper无生产消费者，整体删除，没有手写兼容层或fallback。

## 当前正向合同

[最终20 pass/43 expect](tests-qualified.log)，Bun1.4.0、真实Git而非mock（模拟）：原六项历史/安全错误合同继续；SHA-1（160位安全散列算法）和SHA-256分别验证真实v2/v3/v4/split，包括空格/中文路径；sparse完整叶文件、cacheinfo大小、换行归一化、相对替代index、Gitlink和明确坏index错误。[最终types](scanner-types-qualified.log)实际exit0。

[第一次扩展v3失败](tests-complete.log)保留：Git无扩展flag时把请求v3实际写回v2，输入header断言正确失败，18 pass/2 fail，不能标20通过。fixture改用真实skip-worktree扩展再要求v3，实际header等于3、后续完整内容合同都通过。没有修改生产读取器来迎合假标签。[17项](tests-first.log)/[18项](tests-final.log)早期结果也保留。

## 固定71787输入与成本

[真实前后比较](comparison.json)使用565567a64完整tip与精确原index。所有path/OID（Object Identifier，对象标识）/mode保持，after全部71787个size与实际不可变tip元数据精确一致；[19741项旧stat大小纠正](cached-stat-corrections.json.gz)和[当前完整元数据](index-snapshots.json.gz)保留。原index bytes保持。

| 组件 | before | after |
| --- | ---: | ---: |
| 墙钟ms | 40077.3537 | 42061.8762 |
| 真实Git调用 | 372 | 374 |
| blob读取查询 | 36270 | 36270 |
| blob响应bytes（含头） | 1497520386 | 1497520386 |

本对照约+1.985秒/+4.95%，新增两次元数据调用。此修复以正确性和安全交付，**没有提速声明**；494去重仍保留，不恢复漏检读取器。原before/after-result.json保留各自Git调用/时长/输出量，Git不可变内容身份不是被禁止的可变源码摘要门槛；压缩解压相同只证明归档完整。

## 原scope与数据

[两个原native scope](physical-scopes.json)原81830/65573均自然exit0，物理/output/request/launcher完整、精确host/target出生dead_or_reused，runtime/data空；外层原Job（Windows作业对象）终态覆盖本组Git后代，不以观察超时或PID（Process Identifier，进程标识）名字代替终态。

[源保留](source-preserved.json)：schema3/integrity ok，原149Project/198Session/518Message/1155Part/1407protocol/119request/119outcome共3665行及rowid/字段/时间/bytes/mtime保持。没有源initializer/业务输入、模型或凭据复制。只归档元数据/脚本/原失败，私人DB/历史和主index二进制不提交；真实复现仓库留在忽略的自有scratch，测试临时仓库按精确父目录和非链接条件清理。

相邻[旧实现文本](secret-scan-before.ts.txt.gz)用于核对历史，不属于生产路径。[官方索引格式](https://git-scm.com/docs/gitformat-index)、[Git staged-file协议](https://git-scm.com/docs/git-ls-files)、[update-index扩展与版本](https://git-scm.com/docs/git-update-index)支持选择；实际安装Git2.45.1逐项验证。没有主仓branch/worktree、no-verify、force/rebase、tag或Release。
