# 会话查找键盘实页证据

对应[实施前分析与方案](../../records/2026-10/2026-10-28-conversation-search-interaction.md)。全部22张JPEG由内置浏览器真实开发CLI `/ui`直接捕获并人工查看，无修图或截图断言；用户18571与其他窗口未操作。使用原八消息Chat/Work，全程无认证副本或模型请求。

## 原失败与阅读基线

- [01](01-work-menu-before.jpg)：真实Work归档项错误写作“归档此 Chat。”。
- [02](02-work-empty.jpg)、[03](03-work-single-result.jpg)：中文无结果0、刷新后原查询保持、阶段三原ID/作者/work/中文日期/1条结果；[04](04-work-enter-location.jpg)为Enter高亮原阶段三。
- [05](05-work-multiple-results.jpg)：7个阶段匹配，真实goal-controller/work作者和原顺序；[06](06-work-arrow-enter-location.jpg)为Down+Enter高亮阶段一。
- [07](07-work-second-escape-before.jpg)：连续两次Esc仍停在查找，第一下仅清空查询，是原失败。
- [08](08-chat-original-error-result.jpg)：普通跨项目切Chat后，session aborted精确匹配原停止消息。
- [09](09-tab-clears-query-before.jpg)：实际Tab聚焦Refresh但mcp丢失，三结果变成已载入8，是原失败。

## 改后与最终焦点

- [10](10-tab-query-preserved-after.jpg)：初次修复后Tab保持mcp和三原结果；Enter刷新也保持，后发现原生disabled仍令刷新焦点丢失。
- [11](11-escape-draft-focus-after.jpg)：一次Esc已关闭且草稿完整，但当时焦点仍是WebArea；文件名不能证明焦点通过，此处保留准确失败范围。
- [12](12-english-header-menu-after.jpg)、[14](14-english-sidebar-menu-visible-after.jpg)：真实英文标题和侧栏都显示Archive conversation。[13](13-english-sidebar-menu-after.jpg)是菜单关闭/点击未达成时的页面，不能当菜单通过证据。
- [15](15-final-refresh-keeps-focus.jpg)：最终构建Tab→Enter刷新后mcp、三原ID与Refresh焦点都保持。
- [16](16-final-escape-restores-draft-focus.jpg)：最终一次Esc返回原textarea焦点，完整“最终键盘返回草稿763”仍在。
- [17](17-final-chinese-work-menu.jpg)、[18](18-final-chinese-work-search.jpg)、[19](19-final-escape-restores-menu-focus.jpg)：最终中文Work标题归档对话、原阶段三单结果及本地日期、Esc返回原菜单Trigger焦点，均在在线实例实页确认。
- [20](20-final-chinese-sidebar-menu.jpg)/[21](21-final-chinese-sidebar-menu-visible.jpg)没有打开目标菜单，不计通过；[22](22-final-chinese-sidebar-menu-located.jpg)才显示真实中文侧栏“归档对话”，此时预设正常关闭已完成、界面离线，只证明本地菜单文字/布局，不证明在线归档功能。没有执行归档动作。

## 实现、检查和数据

Search只处理自己的输入Esc，用官方noResetInputOnBlur保留Tab查询；共享Combobox其他消费者默认行为保持。共享Dialog通过可选returnFocusTarget复用原可见/连接/禁用/焦点校验，触发前捕获目标，来源切换返回null退休。Refresh用现有aria-disabled样式和同一busy动作条件保留焦点。两处归档菜单共享原双语文案，改为准确的“归档对话”/Archive conversation，无API、SDK、schema、权限或Provider变更。

当前类型、普通Node/Vite最终构建main-CM7QQMFI.js、双语2语言2612键与文档检查见[checks.json](checks.json)。本轮UI-only没有新增/运行自动化测试；此前762的20项非UI合同不冒充本轮页面验收。原中间结果保留。

四原exec/native/launcher0、公开shutdown200、物理完成/输出排空/请求清理及精确出生身份退休；原40分钟截止07:33:29.842Z保持，最终余508522ms。四库101312/101314/101316/101318原行逐字段保持，最终101314/101316/101318/101320行，源库保持、schema9/integrity ok、三个Project原输入保持，完整catalog副本均退休、源catalog字节/元数据和auth元数据保持。Provider0/累计759。见[runtime-and-data.json](runtime-and-data.json)。

未完成实页：80条以上真实长会话分页、真实IME、请求在途切换，以及其他Dialog消费者的完整交互矩阵。普通跨项目、中文空态/刷新、原文/错误、方向键/Enter、Esc与最终焦点已按各图所述范围确认，不把单次通过扩大为所有场景。
