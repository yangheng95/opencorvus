# 表单内搜索的回车归属证据

[规格和复核](../../records/2026-11/2026-11-09-form-search-enter-ownership.md)。隔离的真实开发 `/ui` 桌面，1280 × 720；只保存一份未执行草稿。

- [01](01-before-mission-search-focused.jpg)：旧版英文，专家团搜索获焦，原请求为空。
- [02](02-before-enter-focuses-request-error.jpg)：旧版在搜索按回车就进入整表校验。
- [03](03-before-scheduled-project-arrow-focus.jpg)：旧版定时项目搜索回车留在搜索，Down 将焦点交给项目。
- [04](04-after-mission-enter-keeps-search-focused.jpg)：新版英文，搜索回车留在原查询和选中状态。
- [05](05-after-explicit-action-validates-request.jpg)：明确点击后，原英文错误和请求框焦点保持有效。
- [06](06-after-chinese-valid-draft-enter-keeps-search.jpg)：有效中文表单的搜索回车留在查询处。
- [07](07-after-explicit-draft-save.jpg)：明确保存后出现唯一草稿和待规划卡片。
- [08](08-after-scheduled-enter-keeps-search-focused.jpg)：定时项目搜索回车保留焦点和 0 项选择。
- [09](09-after-scheduled-explicit-target-selection.jpg)：Down 后显式空格选中项目，计数为 1，随后取消。
- [10](10-after-memory-explicit-search-result.jpg)：记忆页回车发起实际本地搜索并显示空结果。

[真实响应检查器](check-form-search-enter.mjs)核对实际 `/doc` 和 Mission/定时读取；[落盘检查](audit-owned-data.py)与[输出](owned-final-check.json)记录项目文件、请求事件和唯一草稿。各阶段启动记录和读响应在本目录保存。
