# 完整配置的物理读取与原生启动观察

2026-10-21，单开发 agent；[实施前 Recall 与裁决](../../records/2026-10/2026-10-21-config-physical-path-cost.md)。本轮为诊断进展，没有生产修复；完整保存10秒/恢复5秒仍未达标。

## 交错本地观察

当前完整原数据149 Project/198 Session/schema3，逐项实际目录读取。每轮149²=22201次，12并发，每个项目输出逐项等于原 Promise 输出。它是文件系统局部诊断，不是配置、网页或整体性能资格。

| 原运行时 | Promise / native / native / Promise 毫秒 |
| --- | --- |
| [Bun1.4.0](bun-1.4.0-result.json) | 910.422 / 812.540 / 767.303 / 764.890 |
| [Node25.7.0](node-25.7.0-result.json) | 917.526 / 832.830 / 817.161 / 852.546 |

149个原目录、独立目录、junction与大小写路径结果相同；Bun的missing/non-directory输入为相同ENOENT、不同syscall（lstat/realpath），Node两种API观察相同。没有支持生产替换的稳定大幅收益。第一工具误用PATH里的Bun1.4.3，原[失败日志](bun.log)发生在错误细节断言、性能轮开始前；随后明确使用当前冻结Bun1.4.0。失败与正式观察没有混用。

[Node官方Promise语义](https://nodejs.org/api/fs.html#fspromisesrealpathpath-options)、[native callback](https://nodejs.org/api/fs.html#fsrealpathnativepath-options-callback)、[Bun锁定Promise源码](https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.0/src/js/node/fs.promises.ts)和[callback源码](https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.0/src/js/node/fs.ts)说明接口表面；实际收益依照上述运行结果判断，没有因native命名新增实现。

## 同一完整请求中的混合负载

新的独立数据库为原数据库的完整SQLite（Structured Query Language，结构化查询语言的本地数据库实现）只读序列化副本，完整canonical复制，所有原项目仍作为实际候选；不是缩小项目集。当前正式482 UI（User Interface，用户界面）与源码CLI（Command Line Interface，命令行界面）18841经原production Config service→browser HostTransport→公开HTTP（Hypertext Transfer Protocol，超文本传输协议）完成保存、恢复与四并发读取。

[原始安全汇总](mixed-result.json)记录263352次文件系统调用、896次原spawn，全部来自pass-through观察；[观察器](profile.ts.txt)保留原参数、Promise、值和错误，不读取/归档文件正文、环境、Provider请求正文或凭据，也不新增stdout消费者。带观察器的绝对耗时不能替代无观察器验收。

| 实际请求 | 保存 | 完整恢复 | 最长并发读取 | 原判定 |
| --- | ---: | ---: | ---: | --- |
| 原writer93366 / reader33574 | 18568.570ms | 18440.229ms | 18674.123ms | 10s/5s失败，四读20s通过 |

保存窗口294次同步spawn，区间并集6909.749ms；恢复292次，6516.327ms。保存窗口原注册目录realpath45436次、stat44696次；恢复45129/44394次。其Promise累计等待均有大量重叠，不能相加当墙钟、磁盘或CPU（Central Processing Unit，中央处理器）独占时间。

一个实际stat观察区间261.071ms，与同一次同步spawn的260.655ms区间重叠；恢复的一个原native request readFile区间260.736ms，与同步spawn区间重叠260.019ms。这证明完成观察包含主线程无法执行回调的时段，不能把最长Promise等待全部归因磁盘。探针没有内核I/O完成时间，不能据重叠声称真实磁盘部分已精确测出。没有据此增加缓存、并发常数、线程或另一监管器。

## 实际页面与原数据

[01](01-complete-general-before.png)为原Ask设置；[02](02-complete-providers-writing.png)在第一次真实保存中打开Providers，显示实际加载说明；[03](03-complete-providers-visible.png)显示已读取227 Provider、Connected OpenAI；[04](04-complete-ask-restored.png)在完整恢复后显示Ask。四张都实际呈现并人工查看，没有UI自动化或界面源码变更。四个公开reader均200，模型目录8133，目标模型gpt-6.1-sol。

原七表3665行在源QA再次逐项核对全部rowid/完整data/时间完全一致，源数据库size/mtime不变；独立副本中的所有原Message/Part/Session/Tool/protocol和Project身份/归属也逐项保持，changedProjectFields为空。最终151 Project/199 Session/520 Message/1159 Part/1411 protocol/119 request/119 outcome/schema3；额外项目/会话来自新的独立服务与真实预检。整份parsed canonical恢复原值；观察器未记录原项目目录写入。未操作用户18571或用户数据库，不归档完整数据库/原消息全文。

## 原句柄、失败与退休

[结算](native-settlement.json)：启动前检查器误继承空canonical断言，原[错误日志](launch.log)在Provider audit安装前退出1，0模型请求；原native物理/output/request及精确出生时间已经结算，完整runtime对退休。修复为完整原canonical比较后才启动新的final occurrence，没有重启活跃服务。该失败随后复制不存在的日志又遮蔽launcher receipt，工具也修正为日志存在时复制；失败原工具exit1与native exit1均保留，未编造成功launcher。

最终原服务52880 exit0、公开shutdown200、physical/output/request/launcher结算，原reader33574与writer93366均exit0。固定独立预算4、实际2次gpt-6.1-sol流式200、原reader EOF（End Of File，流读完），含全部预检/辅助，未使用2次退休，没有业务模型输入。清理工具打印分母曾残留6，实际审计与判定始终4；文案已修正，未重新清理已退休副本。

[凭据退休](credential-retirement.json)：1377文件/167067231字节/5实际秘密值clear；3个自有空junction逐一核验后跳过重复遍历。失败与成功runtime完整auth/models均在各自原native结算后退休，private完整对在最终source EOF及原52880 join后退休，源凭据metadata未变、没有refresh/exchange/源写入；完整private模型目录退休前与源逐字节相同。自有50关闭。当前架构、schema、UI、公共接口和迁移没有改动。
