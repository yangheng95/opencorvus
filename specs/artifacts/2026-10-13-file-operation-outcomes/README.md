# Explorer 操作结果与刷新回执证据

对应 [规格](../../records/2026-10/2026-10-13-file-operation-outcomes.md)。本人隔离真实 /ui 前后截图、原始 HTTP 与文件事实、限定正向检查及 Native Host 正常收尾证据在本目录；旧批证据不充当本批验收。

- `before/01-delete-member-error-overwritten.png` 与原观察：实际Delete200、404、required GET500后，旧反馈仅含最后刷新错误，没有完成一项事实，截图已呈现并人工查看。
- `before/delete-fault-input.json`、`delete-physical-and-api.json`：本人完整原输入、同scope隔离移动和唯一规则故障、实际404/200正文及完整保留字节。
- `before/*launcher-joined` 与 `runtime/before/`：真实身份、正式私有资源、普通shutdown、Host/Target exit0、排空/请求清理/父join；runtime日志保留实际原始请求ID/状态/根因。
- `reviewed-scripts/`：实际私有launcher/observer完整字节gzip快照，依赖当时绝对scratch路径，不是可直接复制运行的独立工具。
- `parallel-link-audit/`：一层并行只读的14真实TCP调查、报告与原回执。它证明调查身份/执行，不代表链接行为正确；已发布404、目录链接类型分歧和相对链接复制500均未在本批修复。产品链接源码没有修改。

gzip解压逐项原字节比较只用于归档保真，不作为功能验收摘要。

- `after/01`至`07`：真实Delete完成1项、原404与500各Details、诊断正文末尾、同错误切中文保持详情owner；`08`真实恢复后的手动Refresh及搜索。
- `after/09`至`11`与原观察：Move成功回执1项、原PATCH500及三个required GET500全部原请求。
- `after/12`至`14`与原观察：Copy成功回执1项、原POST500及两个required GET500；physical publication和失败响应明确区分。
- `after/15`：真正文件选择器上传17字节、独立成功事实与恢复列表。
- `after/*publication-and-repair`：原完整CRLF/marker与每次限定实体保留/修复事实，没有重发mutation。
- `after/launcher-observed-exit`、`runtime/after/native-host-settled`：900秒deadline_exceeded/Target1，物理、排空与请求完成；不能称普通shutdown0。
- `post/actual-api-and-bytes.json`：同一原after实体项目，新源码CLI15真实请求（14个200、明确404一个）及10完整文件字节。post普通shutdown、Host/Target/父join0。
- `validation/`：61聚焦纯服务/214断言、最终产品/新测试类型、CSS、格式、限定diff、正式build和文档检查原日志/独立exit；保留scratch类型解析失败和checker平台路径假设失败后正确重跑。
- `reviewed-scripts/launch-before-visual.ps1.gz`：原实页使用的launcher版本；`launch.ps1.gz`增加仅精确本人已退休项目的post准入；两版不混称相同字节。

全部16张截图实际呈现并人工查看。真实并发/项目退休、search失败、post-open停止/失败的全部视觉与POSIX仍未覆盖；纯服务collector不能替代这些验收。publication后元数据和外sink未知聚合分支继续下一批。
