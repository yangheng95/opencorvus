# helper 启动隔离的实际边界

2026-10-21，单开发 agent；[实施前 Recall 与方案](../../records/2026-10/2026-10-21-native-launch-isolation.md)。本轮只有私有原型和真实验收证据，**生产实现保持原样**。完整保存10秒/恢复5秒仍未达标。

## 原型测的是什么

只把真实 Windows helper 的创建和管道读取放入标准工作线程；原request、进程身份、文件读取、ready、durable settlement与清理仍在主线程的原ProcessSupervisor。线程没有导入应用执行模块或创建另一runtime occurrence。它与475把整个Process移至线程的实验不同，文件读取不再和spawn共占同一事件循环。

这是[Bun运行时loader](https://bun.sh/docs/runtime/plugins)中的私有替换，没有写入生产源码、增加产品接口或打包线程传输。原型文本附在[preload](preload.ts.txt)、[adapter](adapter.ts.txt)、[worker](worker.ts.txt)，不是可交付能力。官方[Node工作线程](https://nodejs.org/api/worker_threads.html)和[ChildProcess事件](https://nodejs.org/api/child_process.html#class-childprocess)仅提供通信与事件语义；收益依照下列本机实际结果判断。

## 实际正向合同

[首个真实输出/exit7](smoke-result.json)与[单线程](contracts-result.json)、[三线程](contracts-three-result.json)均自然完成。两个四场景合同各有5个实际helper：512KiB二进制输入、4718592字节stdout与2097152字节stderr/exit9逐字节相同；活动后代截止和独立自然peer、操作员取消、65536字节输出上限均产生原明确receipt。各自原生物理、输出和请求结算完成，所有实际工作线程自然exit0。

这些合同没有覆盖worker意外退出、等待启动期间的全部取消组合、detached、restart或打包，不可扩大为整个生产生命周期通过。初始[相对preload错误](smoke-preload-missing.log)在导入前失败；[env结构化克隆错误](smoke-env-clone-error.log)在创建helper前失败，原request清理完成。修为绝对路径及首次await前的普通env/cwd快照后再进行正式实验。没有将工具故障当产品根因。

## 全149目录的交错局部负载

[八组完整结果](local-matrix.json)：每组149目录、12并发、44402次新鲜stat及44402次realpath，148个实际Git目录执行296次原Process.runHost；剩余1个非Git目录仍参加全部文件读取。2368次测量命令的实际stdout/stderr均逐项等于main-a；另有11次上述合同命令。没有数据库initializer或凭据/模型请求参与这一局部阶段。

| 组 | 墙钟毫秒 | 主线程最大计时间隔毫秒 |
| --- | ---: | ---: |
| main-a | 16894.518 | 415.906 |
| 单启动线程-a | 16617.408 | 47.320 |
| 单启动线程-b | 15187.374 | 59.394 |
| main-b | 17403.974 | 259.063 |
| main-c | 18741.218 | 267.257 |
| 三启动线程-a | 14574.388 | 51.790 |
| 三启动线程-b | 14642.008 | 139.033 |
| main-d | 18594.101 | 600.942 |

这说明隔离降低了本机主线程停顿，三启动线程在此混合负载中有方向性收益；不能把计时器间隔冒充画面帧时间，也不能把并行线程的spawn累计值相加当墙钟或CPU（Central Processing Unit，中央处理器）独占时间。3仅是明确对照，不成为生产常数。所有11个原本地scope及原宿主/Target出生时间检查见[原生结算](local-native-scopes.json)，全部原工具/句柄exit0，没有terminate线程或观察超时重启。

## 完整配置原路径

[完整对照与原请求](full-config-comparison.json)使用两个独立、完整原149 Project/198 Session/schema3副本、完整canonical、当前正式482 UI（User Interface，用户界面）与源码CLI（Command Line Interface，命令行界面）。原production Config service→browser HostTransport→公开HTTP（Hypertext Transfer Protocol，超文本传输协议）checker、全部目录和原门槛保留，未装载483文件系统观察器。variant只在私有loader下运行。

| 原scope/句柄 | 保存毫秒 | 完整恢复毫秒 | 最长并发读取毫秒 | 判定 |
| --- | ---: | ---: | ---: | --- |
| baseline25393，writer5310/reader62103 | 17829.531 | 17563.075 | 17935.612 | 保存/恢复失败，读取通过 |
| 私有variant82248，writer19717/reader69453 | 15624.482 | 15320.596 | 15731.222 | 保存/恢复失败，读取通过 |

两组四read均200、227 Provider/8133模型；完整原parsed canonical与Ask恢复。此处只有一对完整路径观察，不能包装成跨环境稳定比例。仍远离10秒/5秒，且正式异常恢复/打包等未验证；当前收益不支持将复杂私有传输直接引入生产。

[01](01-baseline-general.png)、[02](02-baseline-provider-wait.png)、[03](03-baseline-provider-loaded.png)、[04](04-baseline-ask-restored.png)为原实现设置、保存中等待、目录和恢复；[05](05-variant-general.png)、[06](06-variant-provider-wait.png)、[07](07-variant-provider-loaded.png)、[08](08-variant-ask-restored.png)为私有变体对应实际页面。八张全部实际呈现并人工查看；没有UI自动化、UI源码修改或视觉提速宣称。

[图片与原写入区间](frame-timing.json)保留实际Cua页51/52、端口和原PNG落盘时间；02/06分别在各自第一次保存中，03/04/07/08在完整恢复后。相同页面恢复为相同数据，截图可以一致；不以重复画面判定Rendering异常。落盘时间不冒充呈现帧延迟。

## 数据、线程与凭据

两个副本分别逐项核对原七表3665行及源库size/mtime，原Project身份/归属和所有Session/Message/Part/Tool/protocol事实保留，changedProjectFields均为空。最终各151 Project/199 Session/520 Message/1159 Part/1410 protocol/119 request/119 outcome/schema3。原QA数据库和用户18571未操作写入，不归档完整数据库或原消息全文。

两个原服务公开shutdown200、原句柄join0及physical/output/request/launcher结算，原writer/reader同样exit0。variant在原runtime settlement之后、原服务退出之前自然关闭三个工作线程；[896条实际helper关闭/输出事实](service-worker-facts.jsonl)均属于实际主进程92516，三个原worker各exit0，原输出均drained。

独立模型预算8=baseline4+variant4，实际2+2=4个gpt-6.1-sol流式200、原reader EOF（End Of File，流读完），包含全部预检/辅助，未发业务模型输入；unused4退休。单scope cleanup receipt中的maximumBatch4为该scope边界，组合预算在汇总中明确为8，未扩大任何运行中额度。

[退休记录](credential-retirement.json)：5612文件/331543026字节按5个实际秘密值检查clear，两个runtime完整auth/models在各自原source EOF与native结算后退休，private完整对在两scope结束后退休。源凭据size/mtime不变、没有refresh/exchange/源写入，完整private模型目录与源逐字节相同。自有51/52页面关闭。未更新版本、schema、架构、公共协议或创建Release。
