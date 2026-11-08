# 目录优先级批次证据

对应[方案与结果](../../records/2026-11/2026-11-08-directory-search-priority.md)。

前态：全新隔离开发实例 38920，startup occurrence `iteration-20261108-b01-before`；公开 `/find/file?query=match&type=directory&limit=1` 返回 `[".hidden\\match-0/"]`。项目包含 25 个真实隐藏匹配子目录和 `m-a-t-c-h/seed.txt`，模型调用 0。

- [修复后真实公开接口输出](public-search-after.json)：新进程 38921；普通查询可见路径优先，显式隐藏查询保留原身份。
- [前态真实文件搜索](01-before-visible-file.jpg)：实际 1280×720 页面，原路径命中。
- [后态打开原文件](02-after-open-original-file.jpg)：实际点击搜索结果，路径与正文完整，Save 禁用；已人工查看。

四项真实文件/公开 HTTP 测试通过，25 次断言；旧实现相同新增用例失败，期望 m-a-t-c-h/、实际 .hidden\\match-0/。核心类型、文档及架构检查退出 0。目录专用行为由公开接口与功能测试证明，截图只证明真实文件浏览/点击阅读，没有将文件界面称为目录查询消费者。本人两实例公开关闭 200、原启动句柄退出 0，模型调用 0。
