# 262 真实文件范围来源

[Recall与修改前分析](../source-range-plan-262.md)。单agent，当前真实GPT-6.1 Sol流式普通会话，用生产read读取仓库现有read.ts两段，没有创建任务或成员。

当前新项目配置只有6行，原35/45目标检查失败，尚未发送UI请求；该失败保留在Recall。没有用旧项目55行替代当前事实，也没有写长文件夹具。改为已有公开仓库代码27/11与206/19，内容是实际范围函数和Source返回；其绝对路径在隔离项目外，经过现有只读Source editor合同。

[两条真实来源](live-01/02-real-source-ranges.jpg)分别为read.ts:27–37、read.ts:206–224。[第一段实际定位](live-01/03-first-range.jpg)可见行27–37的范围高亮；[同文件第二段定位](live-01/04-second-range.jpg)跳到206，截图可见206起的高亮和返回代码，224在截图下方，不把未呈现的末尾行当作视觉证据。真实源码没有修改。编辑器辅助只读属性为true，见03 metadata；只能辅助截图，不能代替人工验收。

[当前完整来源/工具事实](live-01/canonical-current-conversations.json)：两个成功read分别返回11/19行，总262行，metadata.preview为真实源内容；Source.path一致、range分别27–37/206–224、provider为opencorvus-read，两个源属于对应工具消息。直接当前闭库读取，完整生产output已归档，不伪造消息/Source或用哈希作为验收。

当前预检credential usable、catalog projected、actualModel gpt-6.1-sol、streaming true；完整auth/models同时复制且退休。固定600000毫秒/最多12个累计Provider请求，实际6个全部EOF（End of File，流自然结束），原前台91100实际join/0。自己IAB（In-App Browser，应用内浏览器）108关闭；Native68440/出生win32:639271966990336922、Host49488/出生win32:639271966982602379，Native实际2026-10-10T02:48:16.015Z exited/0，早于固定02:48:18.245Z。没有延长期限或为观测超时重启服务。[独立关闭读回](live-01/closure-readback.json)确认物理/输出/请求终态、精确出生已结束、18200无监听以及两个凭据文件均退休。

没有生产代码修复；本轮发现的是当前校验挡住的验收目标错误，不包装成产品修复。只完成首次加载和同一文件不同范围切换。当前范围反复激活、手动移动后重定位、关闭整个面板再打开、目录内带范围、大文件和实时子Dock仍未验，持续目标保持active。新增/运行UI自动化为零。

当前docs:check通过345 ops/25 groups，architecture-index通过18 current文档。132份公开文本的当前授权凭据扫描匹配0；其后只追加检查事实与5个自身原生产物退休的非秘密receipt。所有观察器结束后，精确单文件保留Native自身5个Bun产物；没有全仓删除/回退。三份AX文本移除行尾空白以通过Git格式检查，原始文本保留于私有raw-publications，截图未变。
