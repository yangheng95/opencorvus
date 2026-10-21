# Sources 键盘与侧栏焦点

[Recall、分析与边界](../../records/2026-10/2026-10-22-source-keyboard-dock.md)。单agent、零模型、自有Source CLI /ui18979、正式main-DhV28lza及原既有成员/来源；未确认新生产缺陷，源码未改、条件after未启动。

| 图 | 已实际查看的页面 |
| --- | --- |
| [01](01-source-copy-focused.png) | Source A复制控件作为初始焦点 |
| [02](02-keyboard-tool-open.png) | 原生Tab到邻接Tool并Enter展开 |
| [03](03-control-end.png) | 同Tool焦点CtrlEnd到尾部 |
| [04](04-tab-returns-tool-payload.png) | 不重设焦点Tab回Raw Input可见区 |
| [05](05-home-tab-expand-input.png) | CtrlHome后Tab/Enter展开输入 |
| [06](06-keyboard-close-handoff.png) | Return关闭整栏，焦点交给header |
| [07](07-keyboard-reopen.png) | 原header Return重开，原展开与位置恢复 |
| [08](08-keyboard-source-b-copy.png) | Space/ShiftTab/Tab到B来源复制及反馈 |
| [09](09-real-paste-verification.png) | B真实CtrlV结果为原ACL URL |
| [10](10-real-paste-source-a.png) | A真实CtrlV结果为原arXiv URL |

[原焦点/几何/实际粘贴](manual-observations.json)保留每个真实动作后activeElement、followLock与阅读top，未做DOM/组件/截图断言。SourceA到Tool、End到尾后Tab回payload、Home后Tab回展开、整栏焦点交接均为真实行为。部分控件用指定目标作键盘焦点准备，不称为从页面起点纯Tab发现；重开后下一Tab实际是Create goal，没有声称一步进入Dock。

Cua clipboard.readText在08后返回上一轮三行代码，原观测保留而非改写。09/10用原生CtrlV粘贴到自有composer分别得到原ACL/arXiv URL，均真实清空且未发送；这才是本次复制验收。宿主实际粘贴与工具读取为什么不同尚未知，没有据后者误修产品。Source唯一location/host writer已核对；没有新复制实现或后备。

[原物理结算](physical-terminal.json.gz)/[摘要](resource-summary.json)记录公开shutdown200、原5655 exit0、native/output/request/launcher/精确出生全部关闭、109关闭，模型0/max0、exhausted=false，无授权或模型目录副本。[数据摘要](data-summary.json)/[完整检查](data-preservation-observation.json.gz)为90表156566原行全字段/身份/时间、计数、schema3/integrity/canonical/source bytesmtime保持，Provider activity391→391。

[真实请求](network-observation.json)与[完整错误安全字段](error-observation.json)保留零投影环境11条配置error：4server均ProviderModelNotFoundError/400，其余为同config.validate与UI传播；[browser观察](browser-errors.json)为空不抵消server事实，不称凭据或数据库失败。无真实模型资格。

[实际秘密值扫描](credential-scan.json)覆盖当前全部交付和解压内容。脚本依赖原生监管器/413及私有路径，不是独立包；原数据库/全行私有快照/完整日志/授权不归档。本轮没有连续帧、活跃流或Main/Side/Mission/WebView2全部键盘矩阵资格，长期Goal active。
