# Git 可执行入口重复解析成本

## Recall

519 继续单 agent，不委托。用户要求持续自主体验修复、真实验收后提交推送；最新单 agent 要求优先于长期 Goal 中旧的 Astra 描述。518 为 progress，已推送 2b4c3e49bf231e0284ca70f1e94e7284719bc84f，fresh upstream 相等，只有原 .bun/ 与 packages/opencorvus/bun/ 未跟踪。完整 166 目录两轮保存/恢复约 14 秒，20 秒读取通过，10 秒保存/5 秒恢复仍失败。所有原服务、页面与配对授权已结算。

本批只测尚未裁决的重复 executable（可执行文件）解析，不重复已排除的外部函数绑定、文件 API（应用程序接口）替换、简单 worker（工作线程）、内部 Git 二进制、并发常数实验。读取当前 Project.discoverGitDirectory、gitRepositoryPaths、hostGit/executeGit/gitProcessArgs、Process.runHost/environment、ProcessSupervisor.spawnWindowsCommand/resolveWindowsCommandExecutable/原 native 生命周期，及 475/478/483/491/518 记录和当前 task-runtime-directory 架构；全仓搜索相应定义和调用。

## 修改前分析

现象：166 目录完整验证仍约 14 秒。518 四次准入内 Git 163/161/161/161 次；重叠阶段累计时长不能直接当总等待或 CPU（中央处理器）耗时。直接触发：Project 先 whichAsync("git")，只保留布尔可用性；后续 hostGit 固定命令名 git，Windows supervisor 再按实际 child environment（子进程环境）解析一次。重复查询为代码事实，其实际成本、是否值得改变公共 GitOptions 仍未知，不能先扩接口或宣称根因已解决。

公共影响包括所有 hostGit/taskGit、Host/Task/Mission/Session 的 Git 工具与 shell（命令解释器）启动、PATH/PATHEXT（命令搜索路径/后缀）、原 timeout（超时）/abort（取消）/stdin（标准输入）/输出/错误/跨平台及正常、失败、取消和恢复终态。此阶段没有新调度异常；若出现立即按共享机制横审全部生产入口与执行轮次，不归因探针或单场景。生产代码、公共接口、配置、schema（数据库结构）、用户数据及 UI（用户界面）均暂不修改。新候选须先补完整公共合同与风险方案。

## 先行可证伪诊断

1. 只读已完整关闭的 config-admitted-discovery-518-after 自有数据库及原物理结算证明；冻结完整 90 表原行、schema3/integrity、数据库与 canonical（规范配置）字节/修改时间。完整读取全部 166 Project，并逐个观察实际目录及 .git；不抽样、不初始化源数据库、不改真实用户服务 18571 或窗口。
2. 六个全新独立自有 native scope（原生监管范围）：resolve-a、ordinary-a、selected-a、selected-b、ordinary-b、resolve-b。resolve 只解析实际 Git 目录各一次；ordinary 对每个 Git 目录先 whichAsync，再原 Process.runHost(gitProcessArgs(args))；selected 仅把同次已解析的正式 PATH 入口传给已有 gitProcessArgs(args, executable)，仍调用同一原 Process.runHost。两者使用同一 GIT_CEILING_DIRECTORIES、longPaths 参数、超时/环境/输出/原监管，不拼接内部 Git 路径或采用私有 QueryScope。反向轮保留顺序效应。
3. 每个执行 scope 对所有实际 Git 目录各一次查询，合计上限 4 × 实际 Git 目录数；全部 166 目录在每 scope 检查身份。模型预算严格 0，不复制凭据或目录、不启动 Provider/业务任务/Goal/成员。使用冻结的正式 Bun 1.4.0、446 native 和 413 owned-host，每 scope 4 分钟边界；无活动观察超时不重启，保持原句柄到真实终态。
4. 原 observer（观察器）只记录真实请求身份/所选 executable/cwd，不记录环境或正文；完整 stdout/stderr 按项目/实际目录逐项核对，两次普通和两次已解析入口保持一致。记录总墙钟、首次解析时段、主线程计时间隔与父 CPU；不相加重叠 Promise、不把组件计时冒充完整配置或页面验收。
5. 全部原命令返回、metrics live0、请求目录清理与原 native/output/request/launcher/精确出生链结算后，再核对源全字段与全部实际目录。收益若小或不稳定不扩 GitOptions；有足够证据才另补实现和正向测试方案，随后返回原全量配置 checker（检查器）与真实页面。没有 UI 修改不新增页面资格，也不运行 UI 自动化。
6. 归档真实结果与失败，更新三索引、执行当前文档/架构检查、范围提交、fresh fetch/merge、完整待推集合审查与正常 push。原 10/5 秒目标保持，长期 Goal active，不将这次组件检查当性能完成。

## 原运行结果与裁决

准备只读 518-after 完整 90 表 157001 行/schema3/integrity，166 个 Project 全部目录存在，其中 Git165/普通1；没有沿用 518 冷缓存中 Git163 的数量，因为本轮检查全部登记目录而不是只触发未加载的 Instance。完整冻结数据库/canonical 原字节及全字段/身份/时间，未复制授权或模型目录。

六个原 scope 按声明顺序执行且全部原 exit0：resolve-a（chunk c436dc）、ordinary-a（3692）、selected-a（58243）、selected-b（25480）、ordinary-b（77130）、resolve-b（chunk 2b5fec）。全部 Bun1.4.0/并发12，每次观察完整166目录；两个纯解析 scope 各165次解析/零Git，其余四个各165个原 Process.runHost 查询，共660/660，模型0。普通和 selected 的四套 stdout/stderr/Project ID/正式 executable 全部逐项相同；observer 记录的实际目标始终为 C:/Program Files/Git/cmd/git.exe，原父 PID/出生时间一致，没有猜测内部二进制路径。各原 Process 结果完成/metrics live0，外层 native/output/request/launcher 全部完整，六对原物理出生链当前 dead_or_reused，无重启。

| 原 scope | 查询数 | 实际墙钟 ms | 父 user/system CPU ms | 主线程最大计时间隔 ms |
| --- | --- | --- | --- | --- |
| resolve-a | 0 | 783.2788 | 984 / 2000 | 10.6379 |
| ordinary-a | 165 | 10057.5222 | 2281 / 6563 | 401.9209 |
| selected-a | 165 | 9493.6255 | 1703 / 5110 | 274.2318 |
| selected-b | 165 | 10467.3046 | 1718 / 5719 | 798.8687 |
| ordinary-b | 165 | 9808.5270 | 2078 / 7750 | 349.6259 |
| resolve-b | 0 | 376.1586 | 594 / 1766 | 9.8439 |

复用路径先快约564ms、反向轮却慢约659ms；只有两组交错，不能声称统计显著或稳定整体收益。selected 父 CPU 较少是有限组件事实，但 CPU 不含 native/Git 子进程，不能当完整配置收益。纯解析不足0.8秒且会与命令窗口重叠；不能用10秒组件减0.8秒预测整体14秒，更不能把全部9–10秒归因 Git 计算或 Defender。**不修改 GitOptions、不增加缓存/worker/并发或第二执行路径**，此微优化目前未获交付资格。

独立源复核第一次 chunk795e9e exit1：数据库/canonical 原字节与 size/mtime 已通过，但逐行 SQLite BLOB（Binary Large Object，二进制大对象）的 Uint8Array 直接与 JSON 冻结对象深比较，属于工具表示不一致。原脚本快照与明确失败事实保留；观察行沿冻结时相同 JSON 表示后，原 f3f774 exit0。完整数据库字节检查仍保留，并非只凭 JSON 掩盖类型；90表157001原行全部字段/身份/时间、schema3/integrity、canonical字节/mtime及全部166目录dev/inode/realpath相同。源只读、没有用户进程/数据库/窗口操作，没有额外Git查询、模型或授权副本。

本轮推进了裁决：排除“复用当次 which 结果即可稳定改善全量 Git 吞吐”的下一简单方案，生产保持原唯一入口；原保存10秒/恢复5秒仍未满足。下一关键缺口仍是正式 native 启动与实际目标生命周期的混合等待，需要保持原物理归属、输出背压、取消/异常/重启收敛并证明总体收益，不能引入未经资格的长驻 dispatcher（调度器）或批量 Git 旁路。没有新生产故障或 UI 修改，未虚报新页面/Sources/成员流资格。仅归档真实组件事实、源复核和完整结算，按当前检查与正常 Git 交付，长期 Goal active。

实际文档检查通过：docs:check 345 ops/26 groups，architecture-index 20 current documents；当前索引差异检查通过。归档原运行结果/日志和失败脚本均采用无损gzip，完整原行、数据库、canonical和私有输入不提交。最终打包扫描和暂存差异检查随后按实际输出核对，提交/push仍须正常hook。
