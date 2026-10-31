# 设置项名称的页面发现证据

对应[方案与根因](../../records/2026-10/2026-10-31-settings-control-discovery.md)。2026-10-31，单agent，在自有38451/38452原生开发服务 `/ui` 使用隐藏内置浏览器进行真实交互，1280×720桌面；全部18张截图已经人工查看。基线main-DXSogkYB.js，候选main-C9RR4r9v.js。

基线设置搜索只检索页面名/id/少量别名，因此Language、Theme、Proxy及中文语言无法发现已有的外观/网络设置。命令面板原有语言快捷切换正常，但同一设置目录的别名也被其局部文字投影遗漏。现两个入口共用CONFIG_SECTIONS的检索文字；General/Appearance/Network引用自身控件的已有翻译key，没有复制另一份标签或全文索引。筛选保持选中页，只有显式激活才导航，不修改设置。语言和主题快捷命令保留。

| 截图 | 实际观察 |
| --- | --- |
| [01-before-language-en.png](01-before-language-en.png) | 英文语言关键词显示无匹配页面 |
| [02-before-proxy-en.png](02-before-proxy-en.png) | 英文代理关键词显示无匹配页面 |
| [03-before-language-zh.png](03-before-language-zh.png) | 中文语言关键词显示无匹配页面 |
| [04-before-palette-language-zh.png](04-before-palette-language-zh.png) | 原有语言快捷命令正常，缺外观页面入口 |
| [05-before-palette-proxy-zh.png](05-before-palette-proxy-zh.png) | 仅已有对话命中代理，没有网络设置命令 |
| [06-after-language-result-en.png](06-after-language-result-en.png) | Language发现Appearance；General仍保持选中直到显式激活 |
| [07-after-language-open-en.png](07-after-language-open-en.png) | 实际激活Appearance，语言控件可见 |
| [08-after-proxy-draft-en.png](08-after-proxy-draft-en.png) | Proxy实际打开Network；两代理开关均原样关闭，填写非敏感草稿 |
| [09-after-unmatched-draft-en.png](09-after-unmatched-draft-en.png) | 无匹配时Network和原草稿保留；随后Escape清查询，草稿手动还原空值 |
| [10-after-theme-open-en.png](10-after-theme-open-en.png) | Theme实际打开Appearance，不执行主题切换 |
| [11-after-notifications-open-en.png](11-after-notifications-open-en.png) | Notifications实际打开General，不操作通知或权限 |
| [12-after-palette-proxy-en.png](12-after-palette-proxy-en.png) | 命令面板Proxy发现Network；随后Return实际打开网络页 |
| [13-after-palette-language-en.png](13-after-palette-language-en.png) | Appearance与原两语言快捷命令并存；随后实际打开Appearance |
| [14-after-proxy-open-zh.png](14-after-proxy-open-zh.png) | 中文代理实际打开网络 |
| [15-after-language-open-zh.png](15-after-language-open-zh.png) | 中文语言实际打开外观 |
| [16-after-theme-open-zh.png](16-after-theme-open-zh.png) | 中文主题实际打开外观，原跟随系统/简体中文保持 |
| [17-after-palette-proxy-zh.png](17-after-palette-proxy-zh.png) | 中文命令面板出现网络，随后实际点击该设置命令 |
| [18-after-palette-language-zh.png](18-after-palette-language-zh.png) | 中文外观入口和原两语言快捷命令并存 |

13/17/18保留实际账本异步搜索加载中的瞬间，本地设置命令已可用；不把这些图当账本加载完成。另实际输入中文权限、Git、诊断、通知均发现通用，并从通知激活通用；原recurring别名发现定时任务。返回应用后重新进入设置，明确打开通用、查询清空、焦点在搜索框。只有实际页面交互及截图是UI验收，未新增、修改或运行UI自动化测试。

普通Node前端构建/renderer检查、类型检查及2语言2671键检查通过。未保存或测试网络代理，未改通知、权限或主题，未执行定时任务/模型；两隔离配置文件字节相同。[verification.json](verification.json)是脱敏摘要。92表原216597→216599→216601，全部原记录所有列保持；仅每次启动增加lease/grant各1，schema9。733条原账本/36428624Token、75附件、十三Git项目28 tracked、十三+三十九+二十二+三文件、原对话/Goal/Sources和两个paused远期定义均保持。

两服务公共shutdown200，原exec/native/launcher均0，物理/输出/请求及OS出生身份结清后，四份auth/models配对副本退休；源认证元数据及模型目录字节/元数据保持。共用首启固定deadline，退休余3448777/2899558ms，没有延长运行窗口。模型请求0，跨批累计1118；用户18571实例及真实数据库/进程未操作。不宣称所有设置字段、全部命令/语言组合、原生Tauri或移动端覆盖。
