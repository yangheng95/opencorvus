# 正文挂载与Rendering的实际归因

[实施前Recall、完整分析及边界](../../records/2026-10/2026-10-21-render-mount-causality.md)。单开发agent，两个顺序隔离Source CLI开发/ui；仅私有被动诊断构建，生产源码和库文件未改。模型预算0，无auth/models复制。

## 人工截图

- [01原任务尾部](01-original-main-tail.png)、[02打开原成员](02-original-member-open.png)、[03两个真实Sources](03-member-two-sources.png)。
- [04展开原工具结果](04-original-source-result-open.png)、[05返回成员列表](05-member-list-retained.png)、[06同成员返回](06-member-returned-sources.png)、[07调宽](07-member-wider-sources.png)。
- [08Main原请求](08-main-original-request-after-scroll.png)、[09回Main尾部](09-main-tail-after-reading.png)。
- [10第二轮Main](10-range-main-initial.png)、[11打开成员](11-range-member-open.png)、[12调宽](12-range-width-change.png)、[13回原请求](13-range-main-request.png)、[14原来源](14-range-original-sources.png)、[15隐藏Dock](15-range-dock-hidden.png)、[16重开Dock](16-range-dock-reopened.png)。

16张实际呈现均已人工查看。主区域英文控件与原中文任务/模型内容保留各自身份。模型配置提示来自零凭据阅读scope，未重试/发送，不能宣称Provider或新模型流已验收。没有UI自动化、DOM断言、组件测试、截图基线或连续帧保证。

## 因果与原始记录

- [第一轮最终144事件](before-console-010.json)、[第二轮最终178事件](after-console-008.json)、[派生观察摘要](observations-summary.json)和[描述器](describe-observations.mjs)：每个页面的同一成员四段正文保留；第二轮26个实际虚拟窗口，15次行回收逐项对上实际items/indexes。摘要只描述日志，未设置UI通过/失败断言。
- [原504时间关联](prior-correlation.json)与[提取器](correlate-prior.mjs)：旧窗口只有最初一次完整conversation读取；14条原浏览器诊断全是ResizeObserver delivery。相近时间不能替代原虚拟范围或连续视频。
- [实际库与调用位置](library-observation.json)：当前virtua版本、实际方向buffer、窗口items选择及contentRect测量代码片段。外层clientHeight包含输入区padding，不能代替库内容viewport判断可见回收。
- [私有诊断构建](build-diagnostic.mjs)、[before构建](build-before.log)、[after构建](build-after.log)。after仅增加观察，不能当修复版本；构建日志保留原警告。
- [描述器首次重跑失败](description.log)与[修正重跑](description-corrected.log)：EEXIST来自重复创建派生文件，现仅派生输出可重复生成，原console未改。

## 范围结算

[数据准备before](before-data-preparation.json)、[after](after-data-preparation.json)、[原行联合比较](data-preservation-observation.json)：两scope各90表145033原行所有字段保持，Provider activity364→364，schema3/integrity、完整canonical和源文件元数据保持。

[before物理结算](before-physical-terminal.json)、[after](after-physical-terminal.json)、[资源处置](scope-disposition.json)、[正式文档检查](checks.log)。原exec/native/output/request/launcher/精确出生完整结束、公开shutdown200、自有85/86页关闭，实际模型0。复现工具：[数据准备](prepare-data.ts)、[保留核验](preserve.ts)、[服务](serve.ts)、[启动](launch.ps1)、[公开停止](shutdown.ps1)、[结算](settle.ps1)。私有数据库/完整原行JSON不提交。

本轮证明当前完成态Main回收的具体窗口原因及同一成员阅读身份，未证明504每次原触发、活跃新流、多成员并发、重连或完整性能。生产未改，不制造新Rendering补丁；继续真实活跃矩阵。
