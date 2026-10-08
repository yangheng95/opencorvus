# 204 原生页面运行器的有限请求寿命

## Recall

用户要求单 agent 持续修复 Sources/子侧栏 Rendering。当前交付起点7686c9ca；201–203只读原153全库事实已完成，174历史副本仍待启动准入。[204方案](../native-history-deadline-plan-204.md)在修改前写明根因、唯一能力、全部调用点、验收和限制。应用 benchmark-debug-template（端到端调试模板）技能；服务绝对资源寿命和模型无活动超时是独立条件，没有延长旧请求或重判原失败。

## 修改与真实结果

低层ProcessSupervisor.spawnHostCommand的deadlineAt没有持续运行请求控制，因此仅传参数不能收敛悬挂服务。Host改用已有ProcessFacade控制租约与单一监督器；共享适配器必填根退出回收策略，既有生产调用明确false，诊断Host明确true。所有四个当前--owned-host调用者同步传递必填绝对截止：普通NativeService600000毫秒、Task准备600000加实际Task900000的总物理上限1500000、历史900000、Explorer/资格诊断600000。记录并核对真实ready.deadlineAt，不保留旧参数兼容分支。

NativeService原出生后600000资格和Taskopened后900000资格仍由现有checker（检查器）管理；新增物理上限在发起Host前计算，可能比出生后上限更早若干启动毫秒。这是服务有限寿命，不是放宽验收预算。Host输出转发保持回压，settled等待真实物理/输出/request清理，明确记录terminal.reason。截止Host退出1；自然退出保留真实代码，不能将完整清理等同业务成功。资格归约器要求reason=exited。

当前包真实checker `bun run test test/foreground-process-facade.test.ts test/plugin-process-facade.test.ts`：两个隔离文件分别2/4通过，总6通过、实际退出0，详见current-checker.log/exit.json。新增前台子树根退出7、持续输出子树截止deadline_exceeded、正常同行exited0及实际输出的正向功能测试；另四项既有插件/信号/分离能力测试通过。后端typecheck实际16583=0，五个当前PowerShell文件解析通过；这些都不是UI（User Interface，用户界面）测试。

修正后的同一真实--owned-host另执行两次自己的原生进程：

- `host-deadline-01`：Host62632/Target21112，明确deadlineAt1791489120150。持续输出到截止，2026-10-08T19:52:00.214Z真实settled，terminal.reason=deadline_exceeded/exitCode1，原Host退出1。物理、输出、请求清理齐全，原创建身份均dead_or_reused（死亡或已复用）。诊断父脚本退出0只表示这个显式期限合同通过，不是服务业务0。
- `host-natural-01`：Host75148/Target74256，自然根退出7并回收其后代，19:53:07.191Z真实settled，reason=exited/exitCode7，原Host退出7，两个操作系统创建身份均dead_or_reused。stdout保留实际子PID。这里故意保留7，验证原始退出事实传递。

每次launch/ready/settled/parent-joined/stdout/stderr原样保存。current保存当前工具源，preimage保存原源。发现私有191decoded（解码数据）合同仍使用旧179无reason记录，依仓库过期测试规则原样归档为preimage/retired-191-contract.ps1.txt，移出当前工具，不补造旧reason、不重跑原179或删除原验收结果。五个在本次观察窗口生成的FFI（Foreign Function Interface，外部函数接口）pile文件按绝对路径/出生时间审核后移入私有目录，记录generated-file-custody.json，未递归清理。

## 尚未完成

此轮没有调用模型、复制凭据、启动真实历史副本或操作用户页面；没有UI源码变更、新UI测试、版本/发布动作。普通Sol完整流程在新Host下尚待实际复核，原153全项目有效文件配置/恢复消费条件和完整复制身份仍需确认，174仍待准入；真正子侧栏Sources/Rendering截图尚未验收。进程修复不能代替视觉效果。文档/索引/范围提交/上游合并/正常推送后继续单 agent，goal（目标）保持active（进行中）。
