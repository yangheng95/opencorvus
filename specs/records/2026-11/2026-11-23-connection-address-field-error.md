# 在连接地址字段关联实际校验说明

## Recall

用户要求本人独立持续分批迭代。先记录根因、影响，再实施、实际桌面交互与逐张截图复核，执行聚焦正向测试，范围提交、同步上游和正常推送。前批 `1a6015a8c` 已确认与远端 `main` 相同，原有 177 项工作区状态逐条一致。本次在专用本机实例验证地址格式和连接反馈；没有使用模型、真实凭据或外部连接。

已读唯一连接表单 `ServerConnectionSettingsGroup`、父 `NetworkPanel` 独立的 Proxy（代理）能力、`TextField` 的无效状态与描述关联、`Feedback` 的摘要与详情、`ServerBaseUrlError` 五类原因及现有 `saveConnectionSettings`、`saveSettings` 和健康检查回执。全仓查 `connectionFailureMessage`、`settings-server-connection-group`、`aria-invalid`、`aria-describedby`、共同样式、两语言文案和聚焦协议测试。前次[校验语言](2026-11-08-connection-validation-feedback.md)和[键盘提交](2026-11-19-connection-keyboard-submit.md)分别解决了摘要翻译与可提交性，保留了表单原有焦点。无障碍状态在提交后的真实字段错误上使用现有输入原语，并关联可见修正说明。所查范围未发现界面自动化测试。[无障碍字段错误说明](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21)

## 根因与影响（实施前）

Windows 真实 `/ui/` 40476，`main-Ck7SQNYQ.js`，正式服务入口与项目身份已核对。实际给当前 `http://127.0.0.1:40476` 添加 `#workbench`，在输入框按 Enter。底部出现 `Remove the fragment (#...) from the server URL.` 和现有 Details，输入值和地址焦点保留，但地址仍呈普通边框、实时无障碍树未关联说明（01）。真实 Tab 再 Shift+Tab 回到同一字段时，当前 `aria-invalid` 和描述引用仍空，用户名和密码本身未变。编辑恢复当前地址后原反馈消退（02）。这是实际地址格式拒绝，服务仍在已接受本机地址。[基线截图](../../artifacts/2026-11-23-connection-address-field-error/README.md)

实际根因是现有具名错误存入表单级 `ConnectionFailure` 后只供底部 `Feedback` 呈现。地址字段未消费已确认的校验结果，也没有链接同一摘要；不会用 `TextField` 原语的无效样式和浏览器语义。现有校验、Details、键盘提交和语言切换继续有用，均未完成该字段与修正说明的关联。连接不可达、未知保存失败、启用失败各有独立原含义，不能当作字段格式无效。真实复现未观察到 Task（任务）、Mission（多步任务）、Session（会话）执行、队列、唤醒、恢复、并发或终态异常。

## 方案与验收

只从正发生的 `ServerBaseUrlError` 保存反馈得到字段无效状态，启用既有 `TextField.Root` 语义和样式。地址字段通过 `aria-describedby` 连接到底部反馈中已经显示的同一条当前语言摘要，使用组件唯一标识。用户名、密码、代理和有效但不可达的地址沿现有语义。原校验器、提交、代次、Details、错误退休、焦点与网络作用域保持。不新增校验、重复文案、连接探测、配置、模型访问、公共接口、依赖、持久数据或发布。

候选真实开发页 40478，英文用片段和查询两类真实拒绝，从地址 Enter、额外用 Save 触发一次；看原字段边框、可见反馈、详情、焦点及地址描述关联。其他字段保留正常。中文再核对一次，再修为原本机地址并正式保存，确认在线及错误退休。以专用本机未监听端口触发已保存但不可达时，核对原健康反馈和正常地址语义，再恢复本机有效端点。聚焦 URL 解析、保存事务和连接端点服务测试及类型、语言、正式构建、文档和架构检查。使用真实页面和截图进行人工验收；无障碍树的实际字段和说明可作为辅助，未实际连接屏幕阅读器则不作语音验收声明。正式项目、隔离数据库和原文件保全，关停本人实例再完成范围提交和正常推送。
