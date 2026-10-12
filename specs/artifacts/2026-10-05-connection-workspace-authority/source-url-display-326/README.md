# 326 来源 URL 的可读文字

2026-10-12，单agent。[实施前Recall](../source-url-display-plan-326.md)。依据325真实Sources截图修复无标题来源的编码文字显示，纯UI改动，只触及SourceParts的现有显示投影。

## 结果与人工复核

同一个北京市公开查询URL，从[325两行编码标签](../source-utf8-325/screenshots/01-source-and-complete-prefix.png)变为[一行可读中文标签](screenshots/01-readable-query-and-fragment.png)。两个真实查询分别显示“北京市”和“北京市%7C上海市”，站点仍独立可见；没有把查询参数猜成发布者标题。第三个实际来源继续显示发布者标题`URL() - Web API | MDN`，位置显示`developer.mozilla.org · #参数`。

[完整Tooltip](screenshots/02-query-source-navigation.png)同时保留可读标签和完整原始编码URL。[Source点击实际导航](manual-navigation.json)打开独立tab100/101：查询参数及%7C保持原样；[MDN章节截图](screenshots/03-official-chapter-opened.png)显示真实“参数”章节；[查询资源截图](screenshots/04-query-resource-opened.png)显示原公共API响应。第二个API说明其完整条目exlimit降至1，并提供continue；本次证明实际URL导航及显示，没有把它冒称为两篇完整文章读取。

四张截图均由主agent查看。第三方参考tab98只用于读取真实`#参数`链接，已关闭；原页面tab99和点击产生的100/101也已关闭。没有源码文案、DOM、组件渲染或截图自动化断言，没有合成Source消息或浏览器fixture。

## 实现与事实边界

唯一显示函数以标准decodeURIComponent还原非ASCII百分号序列中的可见文字；编码ASCII（包括百分号、分隔符和空格）、Unicode控制/分隔/默认不可见码点、非法UTF-8序列保留原始可见表示。标题仍采用发布者原文，Source ID、原URL、href和preview地址保持数据契约；没有依赖、缓存或第二套标题策略。非ASCII编码只在路径/查询预览和fragment位置显示中使用此函数。

人工页面证明了中文查询、编码%7C保留、中文fragment、实际标题、Tooltip与真实点击；没有把这三个来源推广为全部Unicode码点或所有侧栏场景的视觉验收。其余字符分类属于代码审查范围，持续目标仍保留后续体验空间。

[规范后台数据核对](canonical-source-contract.json)只验证真实模型工具输入、持久化Source与Provider终态，不检验任何UI文案或像素。普通Work Chat `ses_-zUSCwzWLzz87iU7Z8vG`的三次webfetch均完成，三个Source身份与输入对应；HTML页面发布者标题真实保留。7次gpt-6.1-sol流式请求（含预检）均HTTP200并正常读到末尾，原12请求预算内，没有派发Task/worker。

## 验证与退出

[Overlay类型检查](typecheck.log.gz)执行器49596 actual exit0；[正式构建及renderer公共接口检查](build.log.gz)34399 actual exit0，正常开发`/ui`实际提供本轮构建。没有运行单独Vite服务或UI自动化。[文档检查](docs.log.gz)345操作/25组通过；07-panel重复过时的仅HTML标题描述已对齐当前HTML/XHTML/Markdown元数据事实。

[Native终态](live-01/source-url-display-326-live-01-qualified-surface-completion.json)：Native66668/Host16268物理、输出及请求收敛；18296释放，复制auth/models配对清理。原启动执行器74571已join且actual exit0。5593条当前进程运行日志脱敏归档，未知时间0条；原日志保留私有副本，压缩还原完整一致。

本轮实现、真实页面、点击导航和后台事实均有证据。剩余本轮范围提交、fetch/merge与正常push；持续goal active，不宣称全产品或全部Sources体验完成。
