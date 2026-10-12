# 357 来源窄侧栏阅读

[Recall与方案](../side-width-plan-357.md) · [月记录](../../../records/2026-10/2026-10-13-side-width-357.md)。单agent开发，读取真实既有会话；长期迭代目标继续active。

## 修复

Side可见时直接拖宽由浏览器原生锚定保持读点；真实缺陷出现在切换标签期间改变宽度。[宽栏第19条来源](03-side-wide-single-line.png)打开文件后缩窄，返回[变为第12条](06-side-return-after-hidden-resize.png)。旧top920.8像素在新布局指向不同内容。Subagent的inactive controller重建也只有数字位置合同。

Main已有的Source/Markdown锚点提取与解析移为唯一无状态共享实现。Side和子会话把真实Source身份或原Message/block偏移保存在各自既有有界阅读Map，恢复交由原setupAutoScroll.resolveTop；pending期间不采集中间几何。Main的历史加载和虚拟化pin保持同一owner。没有新消息、缓存、滚动写入者或计时器。

## 实际页面

| 操作 | 实际来源/正文 | 原偏移→恢复偏移 |
| --- | --- | --- |
| Side701→File隐藏缩至381→返回 | [第19条乙20行](09-fixed-side-source19.png)→[同一来源](10-fixed-side-return-narrow.png) | −10.05→−10.01px |
| Side正文701→File隐藏381→返回 | [原完整段落](14-side-prose-wide-paused.png)→[同一段落](15-side-prose-narrow-restored.png) | 70.16→70.10px |
| Main942.2→文件560.2→关闭 | [第45条甲14行](16-main-source-before-file.png)→[窄栏并打开甲20行](18-main-file-loaded-line20.png)→[宽栏原来源](19-main-return-wide.png) | −7.40→−7.29→−7.40px |
| child701双列→File隐藏301单列 | [第28条乙29行](22-child-wide-paused.png)→[同一来源](24-child-narrow-return.png) | −2.075→−2.063px |
| child成员列表改回701→返回 | [同一第28条](25-child-list-return-wide.png) | −2.075px |
| child正文701→列表隐藏381→返回 | [原段落](26-child-prose-wide.png)→[同一Message/block](27-child-prose-narrow.png) | −83.16→−83.44px |

上述均为原生点击、滚轮、拖动、菜单操作后实际截图人工复核。只读DOM几何用于解释，不是自动断言。[原Side几何](before-side-positions.json)、[Side来源](fixed-side-positions.json)、[Side正文](fixed-side-prose-positions.json)、[Main](fixed-main-positions.json)、[child来源](fixed-child-positions.json)、[child正文](fixed-child-prose-positions.json)。Source身份使用原canonical值；正文恢复段落偏移，不承诺宽度变化后同字符换行位置。

27张截图全部保留。04和17是文件Loading的中间画面，不计文件加载验收；05、18、23分别显示真实乙21、甲20、甲10行。08为第15条，09才对齐原第19条；11只是正文定位中间样本。12→13因宽栏实际maxTop2348夹取，29.30→34.16px，不计精确恢复；14先实际上滚接管后15证明明确段落恢复。21仍是380px且误打开成员下拉，22才是实际701px；未将21算作宽栏验收。历史副本没有凭据/目录，Main的模型配置提示不是已授权生产状态。

## 真实运行与检查

| scope | 原handle/exit | Native耗时 | 正式前端 |
| --- | --- | --- | --- |
| before，18343，页156 | 97625/0 | 159633ms | main-BzN8YRth.js |
| after，18344，页157 | 38913/0 | 237639ms | main-Cf1X2t4t.js |
| child，18345，页158 | 82786/0 | 221745ms | main-Cf1X2t4t.js |

三个600000ms独立窗口均先关闭自建页面再公共shutdown，原handle明确exit0、Native正常exited、物理/输出/request闭合；精确自有Bun文件出生范围核实后归档。均使用当前全源准入及完整90表副本，没有Task重启、模型发送或开发子agent。

[实际runtime checker](checks/runtime-qualification.json)对原历史与当前副本完整Message/Source内容逐值匹配：before/after各11 Message和192 Source（Main64、Side继承64及新64），child13 Message和66 Source（子搜索64及其余2）。同时核对真实前端HTTP200和Native结算。这些不是页面视觉断言。当前历史Provider审计为available:false，不能拿它宣称新的模型资格。

typecheck6105、build25283、CSS及runtime checker均exit0；[docs检查](checks/docs.log.gz)。准备时参数/完整copy准入失败均保留，未启动Native；初版checker误读无凭据审计shape的失败日志亦保留，按实际合同修复后重跑通过。完整脚本/日志见[归档清单](checks/archive-receipt.json)，[凭据扫描](checks/credential-scan.json)包括解压内容。压缩逐字节回读只证明归档完整性，不是源码摘要验收。

本轮未完成同文件重复标签密度重设计、SourceExcerpt内层、原Research Studio大历史或新的持续流式Rendering验收，继续后续体验。没有UI自动化测试；范围外CI记录保持用户原改动。
