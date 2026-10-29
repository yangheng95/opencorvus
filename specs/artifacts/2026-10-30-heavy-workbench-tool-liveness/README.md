# 长程Tool有限执行期限：共享根因与修复资格

[修改前Recall/横向影响/实施方案](../../records/2026-10/2026-10-30-heavy-workbench-tool-liveness.md)记录用户十题目标及本次阻断。L06原Task的35分钟Bash在约20分钟被父暂停guard中断，诊断却标成180秒LLM idle；原Tool已开始副作用，UnsafeRetry正确拒绝重放。Task随后自动恢复，原件保留，不能将此错误当候选业务0分或宣称旧PID已热修。

当前修复让真实执行器自身武装的固定timeout/有界cleanup对象通过内部typed observer和同一Tool progress写者提交，才可为精确SDK call有限延后暂停观察。普通metadata、MCP Task保留期与裸Promise不获放宽；普通Provider idle/无lease暂停继续有界。SDK同步/Promise/AsyncIterable返回语义保留；Bash物理terminate/dispose用同一绝对cleanup截止。普通和Scoped MCP的caller signal传入既有RPC/Task恢复函数，不宣称取消查询就停止了远端工作。

主方最终聚焦53项/7文件、94.71秒、146断言通过，类型检查通过。实际链覆盖SessionPrompt→SessionLoop→SDK→Bash/真实进程→持久deadline/真实文件，及真实工具timeout、caller abort和stdio MCP取消通知。受控Provider不是真实LLM能力验证，测试中的缩时等待不是benchmark小时证据；原自然L06试跑和之后的清洁评分/对照仍分开。

- [主方原件](primary/README.md)：原错误/命令元数据、真实red、最终固定源/53项、类型与实际进程资格、首次验收脚本问题。
- [独立横向源审](source-audit/REVIEW.md)：Task/Mission/Session、取消与恢复路径的三个共享问题。
- [独立实现审查](implementation-review/REVIEW.md)：返回形状/有限治理/cleanup与实际资格；最终收敛以其addendum为准。

原始源/收据/反例均ZIP保留，当前生产实现仍只在原package路径。无新持久表、路由、配置面或伪消息；没有UI修改/自动化、GPU恢复、用户进程操作或新LLM smoke。十题冻结/有效小时/新双系统成绩仍未完成。
