# 主方微型协议实际执行原件

原件来自`D:/opencorvus-benchmark-runs/l05-effect-qualification-20261030`。`originals.zip`保留首次执行源码、真实命令/PID/HTTP、服务和业务SQLite、故障/重启/并发收据，以及两种错误控制的实际数据库和checker响应。不是候选成品或完整L05参考。

run-a自然exit0，5.189533秒/40个明确输出/状态核对；A/B三联合身份逐项正确，账A70/B200。T/X分别是依赖和并发超额/全额重放探针，checker公开记录只评完整A/B分区。main-core-state-assessment.json为business_success；counterexamples分别命中B缺账/效果及提前sent造成三个外部效果缺失。

首次未知ACK不是预灌数据：服务requests明确GET unknown后首次POST applied/dropped1/consumed1；worker实际transport_unknown。后续GET原收据、确认前自有进程中断、pending保留、服务重启及原键重放/确认依次成立。所有服务正常stop、自有worker只按握手Popen句柄结束，无用户进程、UI、Provider/GPU/solver。[独立审查](../../independent-review/REVIEW.md)另目录唯一冷跑/逐身份SQL和边界通过当前局部范围，不把本小例时长/计数冒充数小时或成熟题。
