# Windows dot 与混合 reparse 访问事实

原 fixture-ID `df2ea0df-f134-4503-aea1-a2597ff25c9e`，六个独占实体 case、12 个预声明 marker 共 338 UTF-8 字节。Prepare Node 首次一次；Read Node/Bun 各首次一次、32 个只读 operand，同原成员身份、readlink 和完整 marker 字节绑定。没有 File API、服务、模型或界面验收。

| 原执行 | 原 Target stdout/stderr | 原 Host parent stdout/stderr | 原 terminal |
| --- | --- | --- | --- |
| prepare-node | 76484B / 0B | 76484B / 72B | exited 0 |
| read-node | 269998B / 0B | 269998B / 0B | exited 0 |
| read-bun | 272927B / 0B | 272927B / 0B | exited 0 |

各 phase 固定执行上限 30000ms、真实目标输出无活动 3000ms。唯一消费目标流的是生产 ProcessFacade.run；原 handle 的 terminal/settled/outputSettled、物理/输出/request 收尾以及完整文件/parent writes 均 fulfilled，Root parent 自然 close0。Host 缓冲至结算才转发，外围未添加假无活动计时或活动字节。完整发生轮次、PID/birth、原输入、所有原 byte 与收尾在 runtime 下，不借另一 phase 的退出证明当前 phase。

Prepare Host 自身 stderr 的原 72B 为 `[opencorvus bootstrap] detect system proxy: spawnSync reg.exe ETIMEDOUT`。它在目标 ready 前产生，不在目标捕获内；原 reg child 身份与详细 cause 未取得。该发现已触发共享机制横向调查，不能把 Target stderr0 或 Host exit0 当代理探测正常。两个只读 phase 自身 parent stderr 均为原0B。

四个 dot case 的 `u` 原 readlink 都是 `v\\..\\goal`。`v` 分别普通目录、绝对目录符号链接、junction、断开的绝对目录符号链接；`u` 和未经 path.join 折叠的原 `v/../goal` 访问在两宿主均读 `tree/goal` 的完整预声明正文。断开 v 自身 followed stat/realpath 的 ENOENT 仍保存。因此本 Windows 输入的相对替换阶段先折叠，不能用 POSIX 的逐组件访问规则外推到它。

mixed-junction 的 S 是绝对符号链接到 B/J，J 是 junction 到 D/data，r 原 text 为 `../goal`：直接 D/data/r 读 D/goal，S/r 读 B/goal。mixed-absolute-symbolic 将 J 换为真正绝对符号链接 T，直接 r 与 S/r 都读 D/goal。这证明符号链接递归解析要传回访问 namespace；junction 的实体目标不能覆盖外层相对上下文。

64 个实际 native metadata 查询都有效并原 CloseHandle 成功，entry 身份前后稳定；普通 tag0、SYMLINK `0xa000000c`、MOUNT_POINT `0xa0000003`。已知普通 readlink EINVAL、断开 v 的 followed ENOENT 为原访问事实，未转成成功。此结果只资格这两个 Windows 宿主及有限混合路径；POSIX、未知 tag、I/O/close 失败、未来树、竞态和生产 loader 未由它资格。

[archive-manifest.json](archive-manifest.json)逐项记录 46 份原件共 1,457,244B 及压缩方式；gzip 解压后与原文件直接逐字节一致。历史 inline reader 四原件完整保在 history；当前共享 reader 是唯一当前实现，没有重跑旧20案。tools 中保存此次原 consumer、提案及完整替换块；syntax 的四份原0只证明语法。完整大输出/fixture/源码以 gzip 保存，未删节或改写空格、换行。
