# 成员Sources阅读与真实网页流

[调查与预声明方案](../../records/2026-10/2026-10-21-member-reading-lifecycle.md)。487单开发agent，使用既有普通成员，不创建新产品成员。正式486前端、源码开发`/ui`、完整源库副本；用户18571/进程/数据库未操作。没有新生产修复：本次补齐真实成员网页来源流资格，未复现当前Rendering反复闪烁；有限截图不证明所有瞬时状态通过。

## 原始运行与事实

- [两个原scope结算](owned-scopes.json)：8969/93071原handle join0、各一次shutdown200、精确进程死亡、output/request/launcher完成，自有58/59关闭。原输入3759客户端TimeoutError/exit1保留，未重发；同一服务端输入随后正常完成。
- [实际六个Provider请求](provider-final.json)：包括两次预检和memory，均精确gpt-6.1-sol、streaming200、sourceEOF。预声明live8/repair8总16，repair未启用，所有剩余额度退休。
- [权限原事实](permission-lifecycle.json)：Ask在唯一PermissionAuthority中先于实际工具执行。第一原scope允许一次后217ms成功，第二1461ms成功。全局弹窗真实可见，先前局部观察遗漏。tool-request/Running或模型EOF均不能替代授权与执行事实。
- [流中聚焦](frame-source-focus.json)、[列表往返/调宽](frame-list-return-widen.json)、[关闭重开](frame-dock-reopened.json)：同一最终assistant msg_g0VYcjFZX00SaXQroFcZ无completed、实际reader=reading，正文1782/3491/6100字。真实来源属于前两条tool assistant，普通用户输入URL不算来源。
- [结束事实](frame-completion-check.json)：最终6923字、finish=stop、time.completed，两网页来源各绑定原toolPartID，六个源EOF；未重发/重启。
- [完成态保留](before-preserved.json)、[真实输入后的保留](after-preserved.json)、[实际逐字段差异](original-differences.json)：原源3665行、完整字段/时间/源库bytes与mtime保持。live副本只有原目标Session.time_updated从1792498705995到1792528205418，其余原字段完全一致。当前151Project/199Session/524Message/1169Part/1419Protocol/121ToolRequest/121ToolOutcome、schema3/integrity ok；新输入/预检/工具/模型事实追加。
- [凭据退休](credential-retirement.json)：runtime完整对在原进程及源EOF结算后退休；private完整对在3272文件/250854162字节与5个实际秘密值检查后退休。源auth大小/mtime保持，完整private模型目录退休前与源字节相等；未refresh/exchange。

## 人工查看的实际页面

全部21图在实际内置浏览器交互时呈现并人工查看，没有UI自动化、文本/组件/截图断言。没有连续帧录像或owner生命周期日志。

| 图 | 实际观察 |
| --- | --- |
| [01初开](01-member-open.png)、[02焦点](02-member-source-focus.png) | 原长历史冷解析后完整正文、README.md:2—3来源。首次Rendering不等于持续闪烁。 |
| [03列表](03-member-list.png)、[04返回](04-member-return.png)、[05重开](05-member-reopen.png) | 完成态同成员来源位置保持。 |
| [06价格](06-price-source-focus.png)、[07交付](07-delivery-source-focus.png)、[08切回](08-price-return.png) | 同名Task成员qpRU/0sM0的L2/L3归属与各自阅读位置。 |
| [09文件](09-price-file-location.png)、[10返回](10-price-file-return.png) | 实际第2行CNY 99高亮，返回原来源。 |
| [11调用](11-live-web-tool.png)、[12授权](12-live-permission.png) | 原webfetch与全局Ask，不能把等待权限当执行超时。 |
| [13首来源](13-live-first-source.png)、[14流中聚焦](14-live-source-focus.png) | 真实网页标题、站点与聚焦详情清楚可读。 |
| [15流中列表](15-live-member-list.png)、[16返回](16-live-member-return.png) | 原来源保持，实际Provider仍reading。 |
| [17调宽](17-live-member-widen.png) | 380→441，标题按宽度换行，原来源仍可见；非聚焦时不承诺固定像素位置。 |
| [18关闭](18-live-dock-close.png)、[19重开](19-live-dock-reopen.png) | 原网页阅读区域保持，无新输入。 |
| [20完成后来源](20-completed-source-position.png)、[21末尾](21-completed-end.png) | 完成后仍可读，手动滚到MEMBER487WEBEND。 |

边界：没有新增中文切换资格，没有点击外部论文导航或扩展学术结论；Task成员只有原完成态来源，本次新流仅覆盖既有普通成员。3759客户端未正常响应，不包装为exit0。完整配置保存10秒/恢复5秒仍未达；本轮不是配置性能验收。

准备/只读检查/原scope脚本在相邻`.txt`；不归档凭据、完整私人数据库或原正文日志。不改schema或已有迁移。
