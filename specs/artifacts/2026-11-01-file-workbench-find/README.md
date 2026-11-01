# 文件工作台查找：真实页面验收

单agent在自有后台页面使用开发服务`/ui`验收，未操作用户窗口。原图直接由页面截图保存并逐张人工查看，无图像编辑；没有UI（User Interface，用户界面）自动化测试。

| 原图 | 实际观察 |
| --- | --- |
| [01](01-before-preview-conversation-find.jpg) | 基线Markdown预览Ctrl+F错误打开对话查找/0消息。 |
| [02](02-before-source-find.jpg) | 同一Source已有正常CodeMirror查找面板，可直接复用。 |
| [03](03-before-settings-conversation-find.jpg) | 基线设置General页也被隐藏对话抢占Ctrl+F。 |
| [04](04-after-unsaved-preview.jpg) | 候选未保存草稿在预览中可见，头部提供查找按钮。 |
| [05](05-after-preview-find-first.jpg) | 预览Ctrl+F切回同一源码，搜索Alpha855定位第3行。 |
| [06](06-after-find-next.jpg) | Next定位第5行第二处，原草稿仍保留。 |
| [07](07-after-search-undo.jpg) | Previous/Escape后Ctrl+Z恢复保存基线及可见保存状态。 |
| [08](08-after-redo-preview.jpg) | Ctrl+Y重做恢复完整草稿，再次预览正文一致。 |
| [09](09-after-find-button-retained-query.jpg) | 预览头部查找按钮恢复同一Alpha855查询并聚焦输入。 |
| [10](10-after-saved-reopened.jpg) | 真实保存、关闭、从Explorer重开，磁盘稿与入口正常。 |
| [11](11-after-settings-find-scope.jpg) | 设置页Ctrl+F保持General页与设置搜索焦点。 |
| [12](12-after-chinese-file-find.jpg) | 中文按钮与查找面板，Draft855命中第7行。 |
| [13](13-after-board-find-scope.jpg) | Mission看板Ctrl+F保持当前看板及其原搜索入口。 |
| [14](14-after-chinese-conversation-find.jpg) | 返回原Work后，主对话Ctrl+F正常打开中文对话查找。 |
| [15](15-after-chinese-preview-shortcut.jpg) | 再开文件区，中文预览快捷键恢复同一文件查询和焦点。 |

两个本批新文件均为149字节，公开file/content与物理内容逐字节相等；所有旧文件和项目Git（版本管理）身份保留。基线和候选的数据行增量来自真实文件新建/保存发布及其执行租约，不是迁移或消息。九个原Goal事实一致，模型请求新增0/累计1180。详见[数据与验证汇总](verification.json)和[方案与完整记录](../../records/2026-11/2026-11-01-file-workbench-find.md)。

类型、2676键/两语言、普通构建和renderer公共面检查通过。首次误写i18n:check为不存在的脚本，已按当前package声明重跑check:i18n通过。未新增或运行UI自动化，不把类型/构建当作视觉验收。

范围限制：本批实测项目Markdown文本；只读绝对来源、非Markdown文本和二进制预览未重新进行实页验收。它们的读写边界沿用现有文件/编辑器合同。没有模型执行、Goal运行、预览原生全屏或旧Sources/Rendering问题的重复验收。
