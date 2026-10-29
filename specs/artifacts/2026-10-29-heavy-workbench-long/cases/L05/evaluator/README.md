# L05评估侧局部工具

当前包括mini协议和[顺序事故现场](scene-source/README.md)建设性资格，不能评估完整L05或发布总分。合作HTTP服务源码在`../public/l05_effects.py`；`current-source/l05_worker.py`是只接受执行器已验证accepted events的小参考，不能视为通用ingest验收实现。

首次冷跑把该服务、worker、`current-source/qualify_l05.py`复制到一个只含源码的新FLAT_SOURCE目录，运行`python qualify_l05.py --source FLAT_SOURCE --out NEW_OUTPUT`。输入是公开协议的明示三事件及T/X边界探针，不读取旧数据库或答案；输出真实库/命令/HTTP/进程和检查收据。可复跑性只为这个小能力，不算候选小时。

`current-source/check_l05_state.py --events accepted-events.json --local business.sqlite --remote remote.sqlite --out assessment.json`只读核对给定accepted事件所覆盖的**完整tenant分区**。原mini为A/B，T/X是分离探针；其他分区不能借此判通过。exit0是business_success，exit2是business_mismatch或run_invalid，JSON状态区分业务失败与设施/格式错误；没有正式分数。逐身份、完整载荷、重复行及真实远端receipt绑定均有核对。

[故意错误控制](counterexamples/README.md)与当前正确参考隔离，仅用于证明checker能鉴别具体坏终态。[主方原件](qualification/main/README.md)保留旧执行源与数据库；[单层独立复核](independent-review/REVIEW.md)已另目录冷跑与SQL/HTTP边界/两错误控制验证，原件另封存，不覆盖首次原件。完整版本化脏现场、历史修复/epoch/监测/职业交付及全rubric仍pending。
