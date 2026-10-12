# 335 附件来源名称与只读打开

[Recall与根因](../attachment-source-name-plan-335.md)。当前上传附件来源保留真实原名，URL、shorthand及当前存储物理路径统一解析；附件只读，普通项目文件可编辑。旧持久化来源快照不批量改写。

## 人工视觉验收

根agent在真实开发服务 http://localhost:18311/ui 逐项交互并查看以下截图；没有UI自动化测试。

- [01 PDF原名与只读预览](01-pdf-original-name.png)：16页实际PDF正常呈现，标题保留中文全角括号。
- [02 PDF选区](02-pdf-title-selected.png)：真实鼠标选区复制原文；选区截止于WO，并非完整标题。
- [03 Markdown引用](03-markdown-range-readonly.png)：重音字符/括号原名，24-25行正确定位高亮，附件标识与只读提示清晰。
- [04 只读输入](04-readonly-input.png)：按键x后仍呈现原始内容，后端原件字节验收通过。
- [05 普通文件保存](05-project-file-saved.png)：实际输入并保存，磁盘正文可核对。
- [06 重开来源](06-source-reopen.png)：原名与引用范围保持。
- [07 历史回看](07-history-source-range.png)：切至另一真实会话再返回，名称、范围与只读状态保持。

## 实际运行与检查

- [canonical记录](live-01/canonical-current-conversations.json)：真实3个read请求及completed结果；两个来源携带origin=attachment。
- [上传原始引用](live-01/actual-attachments.json)、[Markdown输入](live-01/inputs/record.md)、[普通文件保存后正文](live-01/project-note-after.md)。PDF原件为packages/web/public/papers/opencorvus-poc.pdf。
- [后端事实验收](checks/actual-backend.json)：7次实际gpt-6.1-sol流式请求HTTP200/EOF，附件原字节保持，普通文件实际保存，精确进程与配对清理收敛。
- [检查句柄](checks/validation.json)：后端13测试/44断言，文件目标服务10测试/28断言、SDK、前后端类型、build、i18n、docs通过；初始类型失败和原行为失败日志保留于checks。
- live-01中保留启动、预检、归属、物理结束和配对清理回执；运行日志、Provider审计及定时监督回执gzip无损归档，私人原始日志保留。文本/解压凭据扫描48份、0匹配。

本轮自有页面118已关闭，启动句柄70024实际exit0。当前构建main-CehUoqfl.js。声明只覆盖上述当前真实路径；没有把局部测试或模型自述当作网页验收。
