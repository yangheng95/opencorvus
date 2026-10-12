# 358 文件来源名称与行号

[Recall与方案](../source-density-plan-358.md) · [月记录](../../../records/2026-10/2026-10-13-source-density-358.md)。来源视觉改动已人工验收；复制读回可靠性存在尚未定位的异常，持续跟进。单agent开发，未重新派遣历史成员。

## 改动和实际画面

长文件名原来把行号挤在可换行名称末尾。现在文件标题按可用宽度省略，原范围独立呈现为英文L20或中文20行；整文件未限定范围时保持无行号标签。标题选择提取为一个实现，原路径/空白/range、完整Tooltip、无障碍名、复制目标和打开目标不变。URL来源继续原标题/主机显示。

| 最终画面 | 人工复核 |
| --- | --- |
| [Main宽栏32](32-final-main-wide.png) | 完整名称与独立行号同时可读 |
| [Main/Side窄栏33](33-final-main-side-density.png) | 重复来源row由旧37.8px降到24px，行号与复制按钮完整可见 |
| [英文双列25](25-final3-english-wide.png)、[中文双列26](26-final3-chinese-wide.png) | 701px栏保持原有双列排列；双位数中文条目325.8625px，实际两列x20/351.8625 |
| [中文301px窄栏27](27-final3-chinese-narrow.png) | 单列名称省略，范围和操作保持清楚 |
| [真实范围28](28-live-range-source.png)、[英文选区30](30-live-range-file-selection.png)、[中文范围31](31-live-chinese-range.png) | 真实read10–12/30，L10–12及10–12行，编辑器准确选择三行 |
| [终版打开35](35-final-side-file-line20.png) | 旧Side原乙文件第20行依然准确打开 |

实际partial read使用新输入文件，文件名前两个空格由原请求、Source、复制与真实打开保留。[原输入](range-input.json)、[范围复制观察](range-copy.json)。不是根据模型叙述生成Source，也没有重写历史消息。原Main/Side各64新来源加Side继承64全部保留；child64搜索、1网页、1整文件来源保留。

初版图01–14验证完整键盘Tooltip、四次甲乙20行复制、目录交界及Main/Side返回。目录caption和Tooltip代码此后未改。图17确认URL原样，18是整文件无range，不能拿read结果“33 lines”虚构1–33标签。终版直接绑定的画面为25–35。

## 迭代失败与复制异常

图16的英文Line占宽使701px短文件名从双列变单列，未通过；改为L后19恢复英文双列，但22中文仍单列，未通过。去掉中文空格、收紧range内距后24仍在双位数处混排，实际宽度合计超出content约0.725px；最后收紧名称与range间距，25–27复核通过。所有中间失败画面保留，没有用窄栏通过替代宽栏。

复制方面，初版四次:20和live的:10-12观察匹配真实位置；但final-main图34显示成功后，[最初读回](final-side-copy-initial.json)、[再次读回/实际粘贴](final-side-copy-second.json)仍为上一live值，不能计通过。草稿均清空、未发送。[可见指针复制观察](pointer-copy-observation.json)再次出现旧值；[原生输入复制对照](native-copy-control.json)正常，随后[格式读取](clipboard-items-observation.json)得到正确乙:2，[下一行复制](clipboard-followup-observation.json)的文本和text/plain均为乙:3。图38–40是对应可见操作。

根因仍未知：浏览器操作工具与应用clipboard写入边界尚未分离证明。生产链只在唯一host writer fulfilled后显示Copied，本轮未改它，不能添加读回权限或后备writer掩盖未知原因。后续成功不证明前述异常已解决。此项是持续任务的明确未满足要求；本轮交付不宣称复制可靠性已修复。

36是加载中画面，37尚未将来源滚入视口，38才是真实可见目标。工具只读DOM不支持document.hasFocus，该工具异常不当成产品异常。所有40张图均已呈现人工查看，不存在DOM、组件、源码文案或截图自动断言。

## 运行事实

| scope / 端口 / 页 | 原handle/exit | Native耗时 | 范围 |
| --- | --- | --- | --- |
| main / 18346 / 159 | 28889/0 | 296749ms | 初版Main/Side |
| child / 18347 / 160 | 84255/0 | 283610ms | 初版宽栏未通过 |
| child-final / 18349 / 161 | 26045/0 | 151308ms | 英文通过、中文未通过 |
| child-final2 / 18350 / 162 | 18883/0 | 155454ms | 中文双位数混排未通过 |
| child-final3 / 18351 / 163 | 38447/0 | 123264ms | 最终中英宽窄通过 |
| live / 18348 / 164 | 55186/0 | 212036ms | 真实gpt-6.1-sol partial read |
| final-main / 18352 / 165 | 20436/0 | 314167ms | 终版显示/定位通过，复制读回异常 |
| clipboard / 18353 / 166 | 53710/0 | 413390ms | 复制对照，根因未定位 |

各scope固定600000ms，页面均先关闭，Host/Native/端口/输出/request完整收尾。live配对复制auth entry及完整models.json，分别验证usable/projected/实际模型，5个请求均gpt-6.1-sol流式EOF，NativeService资格通过并删除复制pair。其他均无凭据完整90表历史，不属于新Provider验收。自有Bun pile按精确出生/路径在物理退出后归档。

[实际runtime checker](checks/runtime-qualification.json)只检查真实SQLite Message/Source、原文件与read输入输出、Provider、HTTP资源交付和Native事实。历史逐值匹配原本11 Message/192 Source或13 Message/66 Source；live Source range10–12、实际3行/总30行与输入一致。main文件名并不能独立证明locale版本，实际资源交付和各阶段截图分别记录。clipboard与视觉只人工复核，checker明确保留unresolved状态。

类型20319、构建8968/69180/84842/69214、最终CSS/i18n结构检查通过；[docs检查](checks/docs.log.gz)。[完整归档清单](checks/archive-receipt.json)与[凭据扫描](checks/credential-scan.json)包含全部解压文本。真实归档逐字节校验只证明归档完整性，不用源码摘要当功能验收。

附件与远端特殊文件名、原Research Studio大历史、新持续流式Rendering未获本轮独立视觉资格。剪贴板未知问题持续调查。没有发布、版本升级或用户应用重启，其他任务CI记录保持原状。
