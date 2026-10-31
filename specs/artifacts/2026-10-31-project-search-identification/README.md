# 匿名项目搜索辨识实测

对应[实施前方案与Recall](../../records/2026-10/2026-10-31-project-search-identification.md)。只保存真实页面截图和脱敏验证结果；凭据、完整模型目录和原数据库不提交。

九张实图均已实际呈现并人工复核，没有UI自动化测试、快照或像素差异断言。

- [01](01-before-project-results.png)、[03](03-before-chinese-results.png)：两个原匿名Project在英文/中文下的相同通用名称。完整目录hint实际可读，不声称路径截断。
- [02](02-before-first-project.png)：实际选择后的通用匿名首页，作为另一显示语义保留。
- [04](04-after-distinct-project-results.png)、[06](06-after-chinese-distinct-results.png)：修复后的本地化短名和原目录尾号，保持原完整hint及排序。
- [05](05-after-first-project.png)：选择后的首页与侧栏，通用首页原语义保持。
- [07](07-after-named-project-result.png)、[08](08-after-named-project-selection.png)、[09](09-after-named-project-ready.png)：命名项目原名、实际选择及加载完成。08为加载中，09为完全访问状态。
- [verification.json](verification.json)：六个纯数据正向测试、真实浏览器目录选择、公开原查询及原数据/原件保全摘要。两scope零模型调用。

未发送的839草稿副本按既有60秒/持久引用GC合同回收，原失败HTTP回读及根因留在方案；没有伪造消息或改变GC。21原来源字节仍保持，六已发送媒体原件实际200且字节相同，原109已引用附件保持。
