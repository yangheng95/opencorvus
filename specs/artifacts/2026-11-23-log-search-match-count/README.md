# 日志匹配数量的实页证据

Windows 桌面浏览器中的独立 OpenCorvus 开发项目。截图由实际操作产生并已逐张查看。[方案与结果](../../records/2026-11/2026-11-23-log-search-match-count.md)

| 原图 | 实际结果 |
| --- | --- |
| [01 少量健康日志](01-baseline-no-search-result-count.jpg) | 搜索已加载的两条真实健康请求记录，界面没有数量。 |
| [02 超出视口的健康日志](02-baseline-many-matches-without-count.jpg) | 增加真实探测并刷新后，列表只能逐段查看结果。 |
| [03 已知十二条文件日志](03-baseline-twelve-verified-matches-without-count.jpg) | 正式接口核对有十二条；窗口没有表达当前匹配规模。 |
| [04 基线无匹配](04-baseline-no-match-state.jpg) | 既有无匹配说明与搜索焦点正常。 |
| [05 候选十二条](05-candidate-twelve-matches.jpg) | 英文计数和正式日志中的 12 条真实记录一致。 |
| [06 刷新十八条](06-candidate-count-updates-after-refresh.jpg) | 查询保持，新增三次实际读取后计数更新为 18。 |
| [07 高级别过滤](07-candidate-warn-excludes-info-matches.jpg) | WARN 排除该批 INFO 访问记录，原无匹配状态正确。 |
| [08 恢复级别](08-candidate-level-restores-match-count.jpg) | DEBUG 恢复同一搜索的 18 条真实记录。 |
| [09 单条匹配](09-candidate-singular-match.jpg) | 唯一真实事件使用正确的英文单数。 |
| [10 清除搜索](10-candidate-clear-restores-full-log.jpg) | Escape 恢复未筛选列表和原输入焦点。 |
| [11 中文匹配](11-candidate-chinese-match-count.jpg) | 中文计数及服务端徽标和原始技术内容同屏。 |
| [12 原详情](12-candidate-count-with-real-log-details.jpg) | 实际请求详情展开时保留当前匹配数。 |
