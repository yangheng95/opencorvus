# 交付承诺与验证范围：真实执行证据

本证据来自两个独立新项目、两类任务的修复前/后真实执行；不是原 maritime 候选的重测，也不是 UI 验收。完整调查、授权、影响面和方案见[Recall](../../records/2026-11/2026-11-01-delivery-verification-scope.md)。

| 任务与生产入口 | 修复前最终程序 | 修复后最终程序 |
| --- | --- | --- |
| CSV 金额汇总，普通 Coding Session HTTP 入口 | 6/6 | 6/6 |
| JSON Pointer 叶值映射，Task / base / Orchestrator 直接执行 | 7/7 | 7/7 |
| 实际 Provider 请求（含预检和 helper） | 38 | 42 |

总计80/120已授权流式请求，全部实际 `gpt-6.1-sol` / HTTP200 / reader settled / EOF（End of File，流结束）。两次进程均正常退出0，配对auth/models副本清退，源两文件逐字节保全。未使用的40次额度退休。本轮没有UI修改、截图或网页验收主张。

## 原件和消费者证据

- [前后对照](comparison.json)：完全相同的operator prompt、固定6+7合法输入与人工期望、实际请求数和原件字节复制事实。
- [baseline原结果](baseline/result.json)、[CSV原始记录](baseline/csv-trace.json)、[JSON原始记录](baseline/json-trace.json)。
- [after原结果](after/result.json)、[CSV原始记录](after/csv-trace.json)、[JSON原始记录](after/json-trace.json)。记录由现有凭据redactor在落盘前处理；不包含认证内容。
- `baseline/`、`after/` 的 `csv-consumer/grade.json` 和 `json-consumer/grade.json` 保存每次真实argv、消费目录、退出码、stdout/stderr、实际输出、人工期望；同目录保留确切输入。
- 两阶段各自 `csv-delivered/`、`json-delivered/` 保存真实最终 `deliverable.pyz` 及源码 `main.py`，与原运行目录交付原件字节相同。这里是不可改写的实验产物，不是另一份产品实现。未复制候选开发测试到维护测试树。
- 根`.gitattributes`为本目录保留原始字节；实际CSV的CRLF和多行字段不能在提交时归一化。已直接核对暂存blob与执行原件，不使用源码摘要替代业务验收。
- `baseline/csv-consumer-final-checker/` 保留按最终JSON语义比较器复核同一已封CSV程序的6/6结果。仅修正checker对JSON number字面表示的比较，没有改变任何输入、人工期望或模型产物，没有重跑模型。

外部checker通过 `python -I deliverable.pyz INPUT --output OUTPUT` 从生产项目之外的临时目录执行真实归档。CSV覆盖引用/多行、列名与metadata、空记录、精确金额和组合；JSON覆盖指针转义、数组/类型、空容器、根标量/根容器和组合。检查读取实际输出并逐层比较JSON语义；不调用候选函数，不从候选parser生成期望，不以help、schema或退出0代替结果。

## 行为复核

baseline已经通过全部用例，并有合法变化和实际压缩入口测试。不能将其能力归因于本次补丁，也不能把13/13→13/13描述为质量提升。

after CSV原始Tool `prt_g0VZeYlmk00reoSNW2sv` 实际执行七组压缩入口测试；其测试构造保留精确名称、金额独立期望，并验证顺序不变性/记录重复的已知倍数效果。调用用临时目录、带空格文件名和Python isolated mode消费最终归档。

after JSON原Task `tsk_g00VZeYxCg0045Sbu3IF`，完成Tool实际 producing Session `ses_-zUQLR1g0zzLsvGqEuAs`（与input/memory Session区分）。八组独立边界测试实际运行于 `prt_g0VZeZIcr00Dgjch0sGV`；重新构建后在 `prt_g0VZeZSd400ZB6s7X95P` 再次通过。完成Tool `prt_g0VZeZZgq00JsWXURqje` 是真实 `manage_task action=complete_task`；summary明确最终归档、独立合法边界、外部目录消费、执行者自验的身份，以及递归/内存限制、重复名称解码行为和非穷尽性。没有以独立评审名义包装自验。

after物理请求probe在39次执行请求的 `/instructions` 中找到完整共享验证原文；另3次原生memory helper沿专用提示。20次Task请求在 `/tools/23/parameters/properties/operation/anyOf/0/properties/summary/description` 中找到真实完成摘要说明。精确已知文本位置用于确认实际传递；这些观测不能替代上述业务结果和行为复核，不使用源码摘要作为验收。

人工二次复核已读实际源码、测试构造、原Tool输入/输出、最终完成summary及四个原归档的外部消费结果，接受这两个有限场景的交付行为。没有证明所有格式/任务均正确，也没有证明工程提示组合差异或某一条提示是原事故的唯一原因。

## 复现入口

- 固定业务输入/独立消费器：`script/benchmark/delivery_verification_scope.py`，`setup <csv|json> PROJECT` 或 `grade <csv|json> PROJECT --output RECEIPTS`。
- 真实运行器：`packages/opencorvus/script/delivery-verification-scope-real.ts`。显式设置 `DELIVERY_SCOPE_ALLOW_REAL_PROVIDER=1`、`AUTH_SOURCE`、`MODEL`、`PHASE`（baseline/after）、`OUTPUT`（必须为新目录）、`PYTHON`、`MAX_REQUESTS`，后七项同用 `DELIVERY_SCOPE_` 前缀。auth源相邻必须有完整models.json；每次运行前单独取得相应Provider/预算授权。
- 运行器复用生产隔离bootstrap、server、Session/Task入口和RealProviderAudit；180秒真实无活动判失败，轮询不续期。业务结果以result中的status和各case.grade为准；Python独立checker也以退出码报告业务通过/失败。原始外部运行目录分别为 `D:/myhexin-local/delivery-scope-baseline-20261101`、`D:/myhexin-local/delivery-scope-after-20261101`。
