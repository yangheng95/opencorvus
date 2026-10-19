# 配置保存耗时证据

[Recall、根因分析与 benchmark 合同](../../records/2026-10/2026-10-20-config-write-cost.md)。

| 实际 scope | 当前项目数 | 保存 / 恢复 |
| --- | ---: | ---: |
| before | 52 | 78.7s / 49.5s |
| after：合并并行 pipeline | 53 | 22.7s / 6.1s |
| verified：配对边界与物理比较实验 | 54 | 21.9s / 4.1s |
| final：撤回物理比较实验 | 55 | 21.9s / 4.2s |

首次 before 与一次 tsc 并发，绝对耗时受影响；其余 perf 测量期间没有测试或构建并发。每轮完整使用当时注册和活跃目录，项目数随真实 Provider preflight 增加，没有为了过线裁样本。并行 span 的相加时长不是 wall time。

**完整性能 benchmark 仍 failed**：冷写 10s 目标未满足。暖恢复 5s、已观察实际配置读取 20s、接受与完整 canonical 恢复通过。后续继续调查共享目录准入；不把本表当成所有配置字段或所有硬件的性能保证。

- 01：before 真实配置读取超时；02–03：第一版等待及读取成功；04–05：第二版等待与成功；06：最终源码实际读写后 General 的 Ask。
- `checks/`：原生调用脚本、生产 checker、原始精确 requestID 阶段、HTTP 读取事实、benchmark 失败结果、相关检查输出（保留最初错误夹具与类型错误，后续已修复重跑）。
- `runtime/`：四个 scope 的物理/output/request 结算、公开 shutdown、join、凭据对退休及八次真实流预检的选定事实。完整模型目录与凭据绑定，凭据内容、DB 和 Provider 完整响应不入库。

49 个去重正向用例通过；页面只用实际交互、截图和人工视觉复核，无 UI 自动化。归档内容（含 gzip 解压）已检查实际凭据值披露。
