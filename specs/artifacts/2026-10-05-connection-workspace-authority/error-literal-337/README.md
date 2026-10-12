# 337 工具错误正文原文

[Recall和根因](../error-literal-plan-337.md)。336的[真实失败截图](../read-summary-336/06-actual-error-details.png)中，Windows路径\.codex在错误正文被Markdown解释成.codex。当前工具错误正文用原始文本节点，保留标点、换行和原生选择；Details仍保留完整诊断。

## 人工真实页面验收

Root在开发模式 http://localhost:18313/ui、Work Chat中操作并查看每张截图；不使用UI自动测试。

- [01 多行字面错误](01-multiline-literal-error.png)：实际缺失路径、空行、两条建议路径，反斜杠/方括号/下划线/括号完整。
- [02 原生选择](02-error-native-selection.png)：鼠标选中整个错误正文并复制；[实际复制文字](live-01/manual-copied-error.json)人工检查完整，原剪贴板已恢复。
- [03 完整Details](03-original-diagnostic-details.png)：原始classification、origin和callID保留。
- [04 来源打开中间帧](04-successful-source-beside-error.png)：文件点击后内容仍在加载，不作为完成证据。
- [05 窄列与已加载文件](05-narrow-error-and-loaded-file.png)：错误自然换行，实际文件两行内容可见，Sources正常。
- [06 键盘重开](06-keyboard-reopened-error.png)：Enter重开错误，保留字面内容；正文底部可随页面滚动。
- [07 历史返回](07-history-literal-error.png)：离开到另一真实会话再返回，完整错误保持。

## 运行事实

[输入文件](live-01/actual-input-files.json)、[canonical对话/工具/来源](live-01/canonical-current-conversations.json)和[实际后端检查](checks/actual-backend.json)核对一次真实失败、一次真实成功、失败消息各行和两条建议路径、请求归属、原文件内容以及6次gpt-6.1-sol流式请求HTTP200/EOF。后端检查没有DOM、剪贴板或截图断言。

[原执行句柄](checks/validation.json)：47719类型、25954构建、7508启动均实际exit0，docs通过；实际服务main-CZcZi190.js。自建页120关闭，精确进程/端口/输出/请求和复制的auth/models配对清理完成。日志及监督回执无损gzip，33份文本/解压证据凭据扫描0匹配，私有原日志保留。

声明覆盖当前主对话真实路径及共享错误组件，不扩展为全部子会话或Rendering闪烁矩阵通过。错误消息中的Markdown样式链接当前按原文字面显示；不会为诊断再建立另一解释器。
