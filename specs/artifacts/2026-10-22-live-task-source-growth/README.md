# 活跃 Task 来源与正文追加证据

见[Recall、分析、调查和边界](../../records/2026-10/2026-10-22-live-task-source-growth.md)。开发仅一个agent；产品内两个成员是被体验的Task责任参与者。生产修复保留原成员turn的真实Interaction子卡与规范导航，不改调度、权限、数据或模型合同。

| 证据 | 事实与边界 |
| --- | --- |
| [原缺陷](04-dismissed-permission-missing-inline.png)、[正式修复](07-after-dismissed-inline-permission.png) | 原Escape两个弹窗后只剩running Tool，无法审批；正式构建可从原inline按钮Allow Once，两次首来源实际完成。没有API代批或自动授权。 |
| [原Sources](03-b-first-source.png)、[正式Sources](08-after-b-first-source.png) | 实际B首来源、原标题/独立复制控件及随后正文。当前en-US，来源与模型原文不翻译。 |
| [before失败](05-before-service-unreachable.png)、[after失败](09-after-service-stall.png) | 两服务全局health、成员读取、正常shutdown均超时；after最后B2审批HTTP也超时，不能算成功。 |
| [资源与Provider结算](resource-summary.json) | before14/32、after12/32，26/64实际Sol流式；23原EOF、3仍reading。两原服务deadline_exceeded/exit1，各物理/output/request/精确出生结清，8份runtime/private auth/models成员退休。 |
| [等待链](native-wait-chains.json)、[实际匹配符号栈](symbolized-native-stacks.json)、[早期导出符号栈](export-only-native-stacks.json) | 主线程条件变量与Wasm atomic wait；CodeView身份匹配实际1.4.0二进制的官方PDB。WCT单节点无cycle不能排除未知同步原语。未保存参数、寄存器或内存dump。 |
| [原图片事实](after-image-facts.json)、[修复后的原PNG检查](repaired-original-image-check.json) | arXiv2实际内嵌643字节11×14 PNG；sharp Windows原包本地缺index.cjs，降至旧Wasm。官方同版本归档完整，冻结强制重装后，同原Bun1.4.0、同实际图片经生产prepareModelImageInput 15ms返回有效PNG，并实际加载sharp0.35.5原生模块。Provider/UI重新验收不冒称已完成。 |
| [数据观察](data-preservation-observation.json.gz)、[原行详情](original-row-facts.json) | 两scope初始90表全部原行、源bytes/mtime、schema3和canonical核对。before原3容量租约自然变化；after还有2原assistant被恢复为ProcessExecutionInterruptedError、1Prompt owner接管、Project记忆归并变化。不是“所有目标原行保持不变”。源DB完整保持。 |
| [before真实首读](before-first-source.json)、[after真实首读](after-first-source.json) | 当前生产parser/merge处理真实public Task snapshot。第二次非空delta读取均原超时，未伪造payload、EOF或Task终态。 |
| [依赖重装记录](dependency-reinstall-original.log)、checker/ | 冻结lock重装修复本地缺文件，不改包版本或lock。checker保存实际方法供复核，引用原私有scope及既有监督器，不是UI自动化测试。官方PDB、归档、完整DB、原行原文和凭据不提交。 |

九张图均在真实自有内置浏览器页面呈现并人工查看；01–05原before146，06–09正式after147，均已关闭。用户18571未刷新、重启或关闭。旧页reload只用于原权限弹窗的临时复现边界，不当作修复；after无需reload即可完成两个首来源inline审批。没有新增版本或发布。
