# 整数参考搜索：廉价诊断与真实状态

这些是评估者数学工具资格，不是OpenCorvus/Codex候选成绩或有效工作时长证据。`originals.zip`保留128份完整执行源、原始命令/日志/输入/计划/向量/原失败；独立报告在[原生审查](../../../independent-native/REVIEW.md)与[CP-SAT审查](../../../independent-cpsat/REVIEW.md)。根节点没有incumbent时，业务结果为未知，不以一个文件缺失错误打0分。

| 实验 | 自然终态/秒 | 可行上界 | 原生数值界 |
| --- | --- | ---: | ---: |
| native根节点 | solution limit/4.08 | 未得新解 | 47039.5 |
| native旧计划warm | time limit/30.01 | 51263 | 47281 |
| CP-SAT同一整数矩阵 | FEASIBLE/30.02 | 49032.9 | 47230.3 |
| native新计划交叉seed | time limit/60.01 | 49032.9 | 47275.9 |

每份可行计划都进入真实独立业务CLI；独立agent另外从输入重算925项业务、1488整数坐标/1096行。CP与交叉seed动作相同，没有第二次改善。严格有理连续下界约46220.2662、整数金额格点下界46220.3始终单列；以上native界不伪装精确证书。当前仍不能认证1%，不调松阈值。`portfolio-assessment.json`记录此阶段终态，不覆盖后续后台实验。

原SciPy1.15.3 milp把HiGHS native status16误映成status4且丢bound/nodes，当前整数实现已整体替换为官方highspy1.8.0；唯一`build_model`保持不变，连续linprog仍独立。`Dockerfile.highspy`基于既有科学镜像只加highspy；实际镜像ID为`sha256:0d004f89b0b6c7d4f9779f3e938863315731b38cacaff7559f43999ef4f98f83`。wheel与SciPy内置HiGHS虽同标1.8.0，Git标识不同，不能称同二进制。

`Dockerfile.cpsat`基于operations镜像新建`/opt/cpsat`虚拟环境，OR-Tools9.15.6755，实际镜像`sha256:3c8d0d24b07246e24772630788b8c79ca6a8d080b5e43734c0b85778ed585f73`。NumPy2只在此虚拟环境，观测依赖见`requirements-cpsat-observed.txt`；构建配方没有锁全部传递依赖，不能把版本观测伪称可跨时完全再现的锁定。研究入口在`comparison-source/`，只导入已经独立重建核验的整数矩阵，不另写业务模型、不中途自动切换算法。

CP最初命令快照只保存start/session，终态来源缺口已从原Codex可见工具调用/响应补齐：`cpsat-terminal-original-*.json`绑定同call_id、session87433和chunk069218/exit0。原快照与缺口历史原样保留，[独立追加核对](../../../independent-cpsat/terminal-addendum/ADDENDUM.md)9项通过；没有重跑求解或复制隐藏推理。

`active-quality/`是后续唯一CPU参考界资格的固定源与启动收据：同矩阵、最好已验hint、8worker/seed20261029、primal relative gap0.009、最多3600秒，达到目标立即自然结束。它在便宜诊断后回答是否可支持拟1%，不属于候选时长/用户总额度，六个旧昂贵容器仍Paused。`callback-known/`真实手算6验证原生callback输出正确计划/进度；完整后台输出尚未封存为终态，后续按Recall指向外部原件再审查。

后续已[自然终态并封存](quality-reference/README.md)：1332.55秒、成本47808、native界47380，拟1%比例已有主方完整可行见证，独立追加审查仍pending。`active-quality/`及上段保留启动/早期快照历史，当前没有新增活跃计算，不按旧表重启该运行。

当前独立追加已认可基例native信任口径并完成预注册，最新判定以quality-reference为准。大向量和完整逐周业务账在各自`originals.zip`原路径逐字节保留；可读`business-summary.json`明确标为派生摘要和原件成员定位，减少重复展开，不改写原件。复跑先在自有新目录完整解包并用新输出根。
