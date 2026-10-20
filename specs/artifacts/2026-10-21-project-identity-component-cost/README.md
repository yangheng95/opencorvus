# 项目身份核验：组件与真实进程分段

[修改前方案及逐阶段资格](../../records/2026-10/2026-10-21-project-identity-component-cost.md)。491单agent；Bun1.4.0/Git2.45.1.windows.1，完整149目录/148实际Git/1非Git。仅自有观察器与私有Rust副本变化，**生产未改，原完整配置保存10秒/整份恢复5秒仍未达成**。无模型、Provider、凭据/catalog副本、UI（User Interface，用户界面）或用户18571/进程操作，不迁移用户库。

## 组件原结果

[十个原scope矩阵](matrix.json)。输入与原始Git bytes使用[490保留的149个原项目](../2026-10-21-native-query-scope/input-projects.json)、[489原296个输出](../2026-10-21-native-query-scope/original-git-outputs.json.gz)；全部实际目录dev/inode/realpath和每个真实输出仍逐项一致，不用可变源码摘要替代行为。

| 组件控制 | 墙钟ms | 循环stat | 循环realpath | 真实Git查询 |
| --- | ---: | ---: | ---: | ---: |
| [files-a](files-a-result.json) | 2666.231 | 44402 | 44402 | 0 |
| [git-a](git-a-result.json) | 8950.955 | 0 | 0 | 296 |
| [stat-a](stat-a-result.json) | 1074.411 | 44402 | 0 | 0 |
| [real-a](real-a-result.json) | 2565.161 | 0 | 44402 | 0 |
| [git-b](git-b-result.json) | 8949.543 | 0 | 0 | 296 |
| [files-b](files-b-result.json) | 2845.108 | 44402 | 44402 | 0 |

所有组保留149输入/原并发12/两次观察；文件组每次是149个顺序BigInt stat接149个并发realpath。Git-only使用490私有短期查询scope，独立env/cwd、原父身份/每项Job/ready/settled/output/request均保留。0计数表示该明确组件控制没有该循环，额外输入基线与Git输出物理资格仍读取；不是所有文件系统调用计数。四类组件不能相加成原混合请求墙钟，CPU（Central Processing Unit，中央处理器）字段只观察父runtime，不含Rust/Git子进程。

两次文件组合约2.7秒，不能解释私有11秒中的全部余量；Git-only约8.95秒也含可执行解析、持久发布、native生命周期、输出和清理，不能直接称作Git计算8.95秒。保留初始/准入后新鲜扫描，marker主键命中不能跳过重复物理Project错误合同。

## 分段观察排除另一猜测

[完整分段分析](analysis.json)。[git-profile-a](git-profile-a-result.json)/[b](git-profile-b-result.json)为8466.539/8523.836ms，私有Bun preload只为当前原rename模块增加内存时钟，保留参数、flags、返回和原GetLastError读取/错误。实际296次同步renameWindows首组合计326.7525ms、中位0.9295ms；不是8秒主因。**不改MOVEFILE_WRITE_THROUGH、不删sync、不加文件worker/FFI绑定缓存。** 各组相邻native-profile.json.gz保存全部原时段。

[native-profile-a](native-profile-a-result.json)为8797.207ms，当前私有Rust只增加线程局部Instant时钟。296项的helper发布、owner/Job、悬停创建、ready/恢复、真实exit、Job zero、settled、输出/监测join均绑定原request。恢复至target exit中位197.0042ms；目标exit到Job zero中位0.0245ms、settled后输出join约0.1833ms。该大窗口尚不是Git本体的已证根因；并行累计64秒不是8.8秒墙钟。

## Trace2的身份与扰动

已声明的[native-profile-b](native-profile-b-result.json)只在自有env启用[Git官方Trace2](https://git-scm.com/docs/api-trace2)，写入自有JSONL（JavaScript Object Notation Lines，逐行数据）文件，argv/数据/配置/持久化不变。[原始2368事件](git-trace2.jsonl.gz)包含296个SID和各自完整start/exit/atexit；全部exit0。该带诊断组11863.384ms，不能拿它替代无Trace2性能。

[296项关联记录](trace-correlations.json.gz)按148个真实worktree及每worktree两次严格串行观察绑定原request；不能用“某PID（Process Identifier，进程标识）出现在整个批次集合里”判定目标相同，因为中途可能复用PID。正确关联后296个native root PID与对应Git Trace PID都不同；Trace ancestry报告第一层git.exe。这支持所选C:\Program Files\Git\cmd\git.EXE入口额外产生Git进程的线索；其精确子进程出生身份与启动器源码尚未核对，不能仅凭路径/名字判定性能根因。

Git内部Trace2 exit时钟中位110.549ms，其中start后Windows ancestry事件窗口中位87.264ms，ancestry后至exit中位5.861ms；该组native root恢复至exit中位324.071ms。Trace2的祖先枚举/记录明显扰动该样本，不能从带Trace2时长减去无Trace2时长推导精确启动成本，也不能因此猜测Defender或系统异常。原scope物理权威仍是原Job active_processes=0，Trace PID不替代出生时间或Job证明。

## 保留、收尾与下一边界

共133206次计数stat+133206 realpath循环、1776次成功Git观察，模型0。十个原scope均原exit0/4分钟资源边界/未重启；[native物理、output、request、launcher及原host/target出生复核](physical-scopes.json)完整。Git scopes各自helper自然退出，每项输出与请求清理实际完成；没有活跃资源等待。

[源库保留](source-preserved.json)：schema3/integrity ok，原149Project/198Session/518Message/1155Part/1407protocol/119request/119outcome共3665行，全部rowid/字段/时间及源bytes/mtime保持；只读源库，没有其initializer或业务输入。没有新实际页面/视觉资格，也不声称原完整Config→HostTransport→公开HTTP（Hypertext Transfer Protocol，超文本传输协议）checker通过。

下一步先审计Git启动器官方实现与实际环境/生命周期，保留既有internal-path/worker数等已排除方向，不直接绕过用户选择的Git。代码还显示discoverGitDirectory解析Git可执行路径后只保留布尔存在性，hostGit随后再次解析；向后传递当次真实解析结果的影响和实际收益尚待独立资格，不能在这里凭重叠等待累加作提速结论。生产优化必须保留两次真实Git/物理重复检查、原所属与全部原checker条件，不用新缓存或改变错误归属。长期Goal active。

每个结果摘要的相邻.json.gz为原完整bytes（含逐项证据）；归档解压逐字节相同只证明保存完整，不作为性能门槛。私有native源[native-main.rs.txt.gz](native-main.rs.txt.gz)、Cargo输入、观察/准备/分析/校验/启动脚本相邻；不提交可执行文件、源库或完整私人业务历史。
