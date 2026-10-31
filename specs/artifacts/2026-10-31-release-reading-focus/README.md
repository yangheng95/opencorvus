# 版本日志阅读与返回焦点证据

对应[根因与方案](../../records/2026-10/2026-10-31-release-reading-focus.md)。2026-10-31，单agent，自有原生开发服务38453/38454的 `/ui`，隐藏内置浏览器1280×720；19张原图全部实际呈现并人工查看。基线main-C9RR4r9v.js，候选main-BeU9pWqt.js。

基线在About内部入口和历史/详情替换后将焦点留在BODY；返回历史又强制顶部，丢失旧版本行的位置。下一Tab实际可进入历史搜索，不声称它跳出应用。现打开详情后交给真实版本标题，返回后交给仍属当前筛选的原版本行并滚至该行；当前筛选不显示该版本时回到原搜索输入。关于的内部阅读动作交给本地化页面标题。没有新选择副本、滚动缓存或全局焦点恢复机制。

| 截图 | 人工复核 |
| --- | --- |
| [01-before-about-en.png](01-before-about-en.png) | 关于版本0.1.40与技术信息；随后实际展开技术明细 |
| [02-before-installed-en.png](02-before-installed-en.png) | 关于进入本版本离线英文日志，诊断为BODY焦点 |
| [03-before-history-tab-en.png](03-before-history-tab-en.png) | 历史切换后BODY，但下一Tab能到搜索；原假设部分未复现 |
| [04-before-old-version-position-en.png](04-before-old-version-position-en.png) | 键盘在长列表旧版本v0.1.25的阅读位置 |
| [05-before-old-version-detail-en.png](05-before-old-version-detail-en.png) | Enter打开详情，BODY/scrollTop0 |
| [06-before-return-lost-position-en.png](06-before-return-lost-position-en.png) | 返回后重置顶部，旧版本不在视口 |
| [07-before-filter-return-en.png](07-before-filter-return-en.png) | 筛选0.1.25保留，但从当前版本返回仍BODY |
| [08-after-about-entry-focus-en.png](08-after-about-entry-focus-en.png) | 关于进入日志后H1焦点 |
| [09-after-history-current-row-en.png](09-after-history-current-row-en.png) | Tab/Enter到历史，当前版本真实行获焦 |
| [10-after-old-version-heading-en.png](10-after-old-version-heading-en.png) | 旧版本H2获焦，原生键盘焦点框可见 |
| [11-after-old-version-return-en.png](11-after-old-version-return-en.png) | 鼠标返回原版本行，scrollTop1615 |
| [12-after-keyboard-row-return-en.png](12-after-keyboard-row-return-en.png) | Enter/Shift+Tab/Enter完整键盘返回，原行蓝色焦点可见 |
| [13-after-filter-return-search-en.png](13-after-filter-return-search-en.png) | 窄筛选不显示安装版本时，返回保留查询并聚焦搜索 |
| [14-after-empty-filter-return-en.png](14-after-empty-filter-return-en.png) | 0匹配时仍可打开安装版本并返回原搜索 |
| [15-after-clear-history-en.png](15-after-clear-history-en.png) | Escape清除后保留历史搜索焦点、恢复76版本 |
| [16-after-same-version-language-zh.png](16-after-same-version-language-zh.png) | 同一v0.1.25通过现命令切中文，正文/日期更新且选中保留 |
| [17-after-old-version-return-zh.png](17-after-old-version-return-zh.png) | 中文键盘返回v0.1.25，scrollTop1342；网站路径为zh-cn对应版本 |
| [18-after-filter-return-search-zh.png](18-after-filter-return-search-zh.png) | 中文窄筛选原查询及搜索焦点保持 |
| [19-after-about-entry-focus-zh.png](19-after-about-entry-focus-zh.png) | 中文键盘关于入口聚焦翻译后H1，Escape最终回原关于按钮 |

另实际验证普通Settings入口仍聚焦原设置搜索，最终关闭回Settings；未改变其原有嵌套Tooltip/Escape层次。[verification.json](verification.json)保存脱敏数据与真实手动焦点观察；这些DOM观察只作辅助，不是UI自动化测试或视觉替代。未新增、修改或运行UI自动化测试。原生焦点框直接沿用浏览器，不增加新样式层。

普通Node前端构建/renderer检查和类型检查0。原日志正文、解析器、版本及发行均未改。92表216601→216603→216605，全部原记录所有列保持，仅每次服务启动新增lease/grant各1，schema9。733条原账本/36428624Token、75附件、十三Git项目28 tracked、十三+三十九+二十二+三原文件、既有对话/Goal/Sources及两个paused定义保持，两独立配置字节相同。

两服务公共shutdown200，原exec/native/launcher0，物理/输出/请求及OS出生身份结清后四份auth/models配对副本退休；源认证元数据和模型目录字节/元数据保持。共用首启固定deadline1793438129648，退休余3300680/2871300ms，不延期或重启；模型0，累计1118。用户18571实例/真实数据库/进程/窗口未操作。未实测屏幕阅读器发声、每个历史版本、原生Tauri、移动端或所有焦点竞争时序。
