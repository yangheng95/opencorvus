# 逐行比较阅读证据

对应[调查、根因与实施方案](../../records/2026-11/2026-11-04-review-reading.md)。图片均为本轮真实开发 `/ui/` 页面原图，已逐张人工查看；没有 UI 自动化、截图基线或像素断言。

三个独立原生实例：38681/main-BGYH6iZ3.js（原态，隐藏页253）、38682/main-Cgu2kpoY.js（中间态，254）、38683/main-DuXKZypz.js（最终，255）。复用已退役本人隔离数据中的908真实Office会话与870-after真实指南会话，不注入工具/用户消息或比较夹具。新模型请求0；用户18571窗口和数据库未操作。

|截图|人工复核结果|
|---|---|
|[01](01-original-line-comparison.png)|原 summary.md 第二次真实修改为+31/−19，数字列没有标题，改动只有符号/颜色。|
|[02](02-current-summary-file.png)|从历史比较的“阅读当前文件”进入真实当前摘要预览，B-006更新与最新统计可读。|
|[03](03-labelled-comparison-narrow.png)|中间态窄侧栏已有Old/New与−Deleted/+Added，原文和行号保持。|
|[04](04-labelled-comparison-wide.png)|稍宽但仍上下布局时，说明行仍清楚。|
|[05](05-full-reading-comparison.png)|中间态发现：收起左导航并扩大右面板后，680px切换点过早进入58/42双栏；Deleted折到下一行，正文重新变窄。这不是最终通过图。|
|[06](06-final-narrow-comparison.png)|最终普通构建的窄侧栏说明和真实+31/−19保持。|
|[07](07-final-expanded-comparison.png)|同一桌面扩大面板后仍用上下布局，五项英文筛选一行，正文获得完整宽度。|
|[08](08-final-chinese-comparison.png)|中文原行/新行与−已删除/+新增，原行号与状态保持；左上用量悬浮提示不是消息正文。|
|[09](09-final-current-file.png)|中文历史比较→当前文件，完整Markdown预览与当前更新可读。|
|[10](10-file-comparison-unchanged.png)|文件编辑器的原磁盘→草稿身份与相同内容空态保持，普通应用内弹窗，无文件写入。|
|[11](11-original-file-creation.png)|返回原审阅，第一次创建+35/−0；原行空、新行有真实行号，正确表达创建。|
|[12](12-original-binary-version.png)|非文本分支仍显示“创建时的文件版本”和规范下载入口，独立于当前文件；本轮没有消费下载或重做字节下载资格。|
|[13](13-single-file-context.png)|真实870指南单文件审阅，两次修改独立，第二次+62/−0；列名清楚，上下文43行折叠，原49行上下文/新50行之后新增保持。|
|[14](14-expanded-original-context.png)|真实Enter展开43行，上下文第4行起两列原行号保持。|
|[15](15-keyboard-collapsed-context.png)|真实Space再次收起，恢复3→47的原上下文与49→50新增边界，焦点环在原summary控件。|

[qualification.json](qualification.json) 记录三个实例的公开状态、原始比较来源、库/项目/附件保护及进程收敛。类型检查、构建和HTTP/数据库数据检查仅证明各自合同，不代替上述真实交互与人工视觉。

实现范围为已记录比较的共用DiffView说明行、现有diff样式、现有file-review容器切换点、四个中英字段。通用TextDiffView、DiffLineRow、文本比较、行号/统计、来源/权限、文件编辑器版本身份及原始数据保持。没有API/SDK、schema、迁移、版本或发布变化。

验收局限：只验收当前1280桌面可实际达到的窄/扩大面板；800px以上未改动的双栏分支未本轮实际呈现，不宣称全尺寸通过。没有新模型执行、Side Chat、运行中流或新的任意文件写入/下载资格。没有用旧模型自述或历史截图替代本轮界面证据。
