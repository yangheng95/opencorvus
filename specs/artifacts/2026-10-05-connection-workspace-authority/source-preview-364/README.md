# 364 文件来源匹配行预览

[Recall与方案](../source-preview-plan-364.md)。真实search_code文件来源现在带有与工具输出一致的匹配行预览：当前Tooltip展示最多四行，保留原文字和空白，不增加每条来源的按钮或列表高度。同名文件可通过原路径和实际正文辨认。

## 证据

- 01–06：英文键盘预览，普通文字、缩进与emoji、字面markup、长行四行、内联载荷省略、甲乙目录切换。
- 07：来源激活后，实际文件编辑器选中方案甲第2行。
- 08–11：中文侧聊来源预览、复制反馈、折叠/展开和另一目录。复制只验收控件反馈，359首次复制未知没有被关闭。
- 12–13：轮滚动后没有tooltip，保留原中间结果；14才是指针到达来源后的实际中文浮层。
- 每张截图及同名JSON为实际手动页面观测，亲自复核；JSON仅辅助理解，不含UI断言。
- `checks/runtime-qualification.json`：真实数据库/工具输出/文件输入匹配，Main10、Side历史10、Side新增2共22条，9请求均真实gpt-6.1-sol流式EOF，NativeService合格。
- `live/`：只读canonical、真实Provider/HTTP/native/进程回执与完整supervision链；压缩大记录保留完整文本。当前前端main-C_UK_gz4.js由真实服务HTTP200返回。
- `checks/`：原检查日志、脚本及归档完整性/凭据扫描。改前search_code实际12pass/2fail保留；修复后23聚焦测试、SDK正规生成、8/8类型任务、overlay build及CSS检查通过。

只有一个scope，port18364、固定600000ms、累计请求预算12。原handle82701实际exit0，432207ms内Native exited0/output/request清理完成；页面关闭、配对凭据清除、端口释放全部有回执，没有重开或延长。未启动子开发agent或产品成员。
