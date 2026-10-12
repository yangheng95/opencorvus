# 334 PDF 来源文字选择

[Recall与修改前分析](../../artifacts/2026-10-05-connection-workspace-authority/pdf-selection-plan-334.md)。单agent验证并补齐PDF原文选择与复制，复用当前PDF.js。

共享阅读器现在以同页TextLayer支持原生选择/复制，显示几何与画布一致，页/缩放/宽度变化一起取消旧渲染并清理旧文本。真实验收又发现空白容器可选会按PDF节点顺序带入行号，已将选择范围限定为实际文字节点；没有重排原PDF、复制后处理或第二解析路径。

三轮开发模式页面各6次真实gpt-6.1-sol流式请求，全部200/EOF。16张人工查看截图保留原始及中间失败与最终结果；最终标题原生复制、125%字形对齐、快速翻页后第二页和Artifact跨run拖选均实际复核。深阅读top336关闭/重开保持。原生双击仍受字体run边界影响，未实现自定义分词。

类型、三次构建及原启动句柄均exit0，自有页面与全部服务/输出/请求/复制配对收拢。没有UI自动化。完整[证据与限制](../../artifacts/2026-10-05-connection-workspace-authority/pdf-selection-334/README.md)保留canonical附件Sources仍显示摘要名称的未解决问题，后续优先调查。
