# 204 单一进程能力中的原生启动/截止/结算

## Recall

用户要求持续自主迭代 Sources 和子侧栏 Rendering，最新要求只用单 agent。当前 HEAD/origin=7686c9ca，工作区开始干净；主聊天最终长场景200通过，但子侧栏尚无当前视觉复核。201–203原153全库只读已确认当前结构/Task/发布/输入/权限/消息/记忆闭合；上一轮未启动副本。补查到原153 `closed-log-audit-custody.json` 实际 parentSession30224/parentExit0/joinedtrue，原生关闭记录仍完整。项目配置安全字段显示全局model=openai/gpt-6.1-sol、全局和项目层未声明plugin/MCP/channel；这尚不代替完整有效配置/资源目录审计。

应用 benchmark-debug-template（端到端调试模板）技能，已读实际 SKILL.md；保留已有动态请求无活动预算。这里的绝对截止是隔离服务的资源寿命上限：手工阅读期间服务有意空闲，不能以日志空闲判为UI失败；不改变模型活动超时或原Task预算。原生清理仍必须等待实际监督器/输出/request（请求目录）结算，不把截止导致的非正常退出称为业务通过。

## 现象、触发点、根因、影响面

历史启动器等待ready（就绪）40秒，随后前台父进程等待Host退出，没有给Host请求有限寿命。Host直接调用ProcessSupervisor.spawnHostCommand；调查发现这个低层接口的deadlineAt参数主要用于清理等待预算，本身未安装持续运行截止。单纯传入参数仍不能解决服务悬挂，是旧路径未根治原因。

当前成熟能力是 util/process.ts 的createProcessFacade：一个请求控制租约覆盖spawn（创建进程）及运行，期限触发同一受监督Handle终止并汇合物理/输出；supervisedHostProcessFacade适配单一ProcessSupervisor。它缺少传递既有的terminateChildrenOnRootExit（根进程退出时回收后代）策略，直接替换会丢失现有Host的前台子树合同。

全仓搜索定义/调用：supervisedHostProcessFacade仅util/process.ts的spawnHost/runHost、plugin/index.ts两处、shell/command-inactivity.ts和plugin-process-facade.test.ts四处；Task版本另有单一入口。共享诊断--owned-host当前四个调用者是live-sol-launch、history-ui-native-launch、explorer-selection-46-launch、owned-settlement-qualification-19；归档preimage（修改前档案）只作为历史数据，不更新。已读ProcessSupervisor Windows请求/输出/ready/terminal/settled、原生Rust cancel/Job逻辑、ProcessFacade控制/截止/适配、相关正向功能测试、174/201–203方案。

这次不是调度或Task生命周期异常，未发现真实共享队列异常；排除模型/工具选择、消息协议、UI组件/布局、版本/发布变更。公共进程能力签名影响内部调用者，必须同步更新，不能保留一参数兼容路径。Task能力现有行为保持原明确策略。

## 唯一实施方案

1. supervisedHostProcessFacade增加必填布尔参数terminateChildrenOnRootExit，由唯一适配器传给当前ProcessSupervisor。所有已有生产/测试调用者显式false，保持原语义；Task适配内部也明确false。诊断Host显式true，不复制适配器。
2. --owned-host参数加入必填绝对UTC（Coordinated Universal Time，协调世界时）毫秒截止；验证safe integer（安全整数）且尚在未来。使用上述当前facade.spawn和原生Job，删除原直接spawn分支；保留同一stdout/stderr回压转发、真实target/parent创建身份、ready/settled物理/output/request证据。记录deadlineAt和terminal.reason，deadline_exceeded即使原进程代码0也以Host1交付，不能伪造自然通过。
3. 四个当前调用者同步传递：NativeService600000毫秒，Task准备600000+Task900000的物理上限1500000，历史900000，普通explorer600000，资格诊断600000。普通原有资格预算/Taskopened后的900000仍由现有checker（检查器）管理，不给普通服务套历史900000，不新增PowerShell看门狗或另一清理权威。
4. 正向测试：真实前台根退出7且其子树结算，真实持续输出子树到deadline得到deadline_exceeded/实际结算；同行正常短命令得到exited0及原输出。用当前生产适配器/真实Windows监督器，保留实际证据。再通过修正后的--owned-host做一次自己的短截止资格观察，保存原工具退出和实际ready/settled/操作系统身份，不能用单元测试代替实际Host。

## 输入、输出、验收与限制

输入是自己拥有的隔离小进程/子树、显式期限、自己的环境和证据目录，不使用凭据，不调用模型，不操作用户进程。输出是原始stdout、实际过程身份、期限/自然退出原因、完整物理+输出+请求清理及原父进程退出码。期限资格Host1是预期的显式截止合同，业务成功资格仍要求自然0。

修改前保存准确差异与preimage；实施后集中正向测试、包类型检查和现有文档检查。补公共进程架构说明、记录、三层索引，范围提交/拉取合并/审查全部待推送提交/正常推送。当前174副本仍不准启动，须独立完成文件/恢复条件与全库身份复制资格；这一轮进程工具合格不能冒充子侧栏截图验收。

实施复核发现私有191 `contract.ps1` 直接读取旧179无terminal.reason的事实，已无法代表当前必填reason合同。按仓库过期测试规则，保留其原样档案并移出当前可执行工具；不补造旧原生reason、不重新运行原179、不引入兼容。当前正向前台/native截止与自然终态测试承担本轮能力验证，旧191/179结果保持历史含义，不能重判。
