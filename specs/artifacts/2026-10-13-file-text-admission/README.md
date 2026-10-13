# 文件文本准入真实证据

对应[方案与Recall](../../records/2026-10/2026-10-13-file-text-admission.md)。

- binary-editable-before.jpg：实际18432/ui将含NUL和非法UTF-8的受控文件显示为可编辑文本。
- binary-saved-before.jpg：实际追加文字并保存后，界面显示干净保存状态。
- before-save-bytes.json：真实保存前后字节，记录FFFE变为两个U+FFFD编码的事实。
- binary-readonly-after.jpg：同一原始字节文件经修复后显示Read only和不可编辑说明。
- unicode-saved-reloaded-after.jpg：有效中文、表情、BOM、CRLF正文实际追加、保存并重载。
- after-save-bytes.json：同一二进制原字节保持；文本磁盘字节与预期包含BOM/CRLF的内容逐字节相同。
- before-test.log.gz / after-tests.log.gz：原隔离runner完整输出；改前7pass/19fail，改后本批26项及4份回归合计39pass/0fail、228断言。

四张截图均人工查看，没有UI自动化断言。后态18433开发服务使用同一项目和正式创建的空Chat；生产代码与真实文件路由，无模型请求或合成消息。前后原服务均通过/shutdown自然exit0并关闭各自页面。类型与文档检查通过；范围为Windows浏览器1280×720英文深色桌面，未验证原生Tauri或其它平台。
