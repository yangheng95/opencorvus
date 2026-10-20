# Git启动下限与发布源码核对

[修改前方案与Recall](../../records/2026-10/2026-10-21-git-startup-floor.md)。493单agent；生产未改，Bun1.4.0/现有446监管helper/Git2.45.1.windows.1。**完整配置保存10秒/整份恢复5秒仍未达成；此处是保留149输入的真实组件诊断，不是完整配置、UI（User Interface，用户界面）或新Sources/Rendering资格。**

## 实际命令对照

[六组原结果和分析](analysis.json)：相同149原Project/148Git目录，每目录两次串行、全组并发12，296个原生产Process.runHost/native helper，正反顺序各一次。query实际两行rev-parse输出逐项等于489原始bytes，version真实输出2.45.1.windows.1，cmd真实输出独立QA标记。原15秒无活动、输出限制与物理监管保持。

| 组 | 墙钟ms | 父同步helper spawn累计ms | 最大主线程计时间隔ms |
| --- | ---: | ---: | ---: |
| query-a | 16178.8192 | 11562.8589 | 642.9194 |
| version-a | 15898.8240 | 10861.7637 | 480.8291 |
| cmd-a | 13018.7836 | 9946.4903 | 460.4722 |
| cmd-b | 13722.0966 | 10470.1300 | 608.3683 |
| version-b | 15166.7101 | 9000.7725 | 525.8051 |
| query-b | 16680.5172 | 11509.7555 | 927.3815 |

query接近version，移除Git后的cmd也13秒，支持多数成本属于共同进程创建/监管路径，而非仓库内容解析。同步spawn在同一主线程串行发生，累计9—11.6秒；它与并行子进程生命期重叠，不能再相加得总耗时。父CPU（Central Processing Unit，中央处理器）不含native/Git。墙钟含原实际结算与raw证据写入，导入与前后物理资格在外。不能凭此直接选择新协议或声称完整性能修复。

各组-result.json为原结果，-raw.json.gz为完整原request/spawn/output/ready/settled观察；解压字节一致只证明归档完整。分析按每个`--request`真实路径连接对应helper，再核对request_id/runtime occurrence（执行轮次）/owner出生/ready-settled target/helper及active_processes0/原helper close0；不用整个批次PID（Process Identifier，进程标识）集合或PID复用后的记录当身份。Node内存观察器只记录原调用数据，没有mock（模拟）或替换进程。

## 已发布版本源码

[官方资产HTTP200事实](official-assets.json)来自[官方2.45.1发布页](https://github.com/git-for-windows/git/releases/tag/v2.45.1.windows.1)与[资产清单](https://github.com/git-for-windows/git/releases/expanded_assets/v2.45.1.windows.1)，标准HTTP（Hypertext Transfer Protocol，超文本传输协议）下载三个原资产，tar先列后只提取指定文本，没有执行外部脚本/安装/编译。

[发布源码与安装版本观察](published-source-observation.json)：发布PKGBUILD绑定2.45.1.1.965b16798d，bundle分支65321f91；已安装入口FileVersion/ProductVersion2.45.1.windows.1。此版本源码已经在无console时设置CREATE_NO_WINDOW、传递句柄并等待真实Git；安装级环境/MSYS配置准备也是入口合同。排除“仅新版才隐藏无console窗口”的源码猜测，不改内部二进制路径。版本绑定没有重现安装二进制构建；OS（Operating System，操作系统）具体成本和二级Git子进程出生仍非本组证明。GPL2外部源只读、不在归档再分发，保留官方完整来源。

## 收尾和下一边界

[六个原外层scope完整结算](physical-scopes.json)，原67954/39437/74061/10131/94491/29390均exit0、物理/output/request/launcher完成、精确原host/target出生dead_or_reused；总1776项原native request物理证明与helper close0，全部live0。runtime/data文件列表为空，无新DB initializer、凭据/catalog、模型或业务输入。用户18571、Git安装、用户进程均未操作。

[源完整保留](source-preserved.json)：schema3/integrity ok，149Project/198Session/518Message/1155Part/1407protocol/119request/119outcome共3665行与原rowid/字段/时间/bytes/mtime一致。只读源库，源库/私人完整历史不提交；[149输入身份](input-projects.json)只保留原目录列表，query原比较对象见此前[490原输出](../2026-10-21-native-query-scope/original-git-outputs.json.gz)。

下一生产方案需完整处理公开字节流/背压、取消/期限/后代/父死亡、detached转移/重启、所有Host/Task/Mission/Session和跨Project合同；490私有buffer-at-end scope未具备此资格，不能直接搬入产品。原5秒/10秒失败、492候选撤回和单agent约束继续有效。
