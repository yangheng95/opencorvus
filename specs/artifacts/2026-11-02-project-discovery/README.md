# 项目选择中的查找（884）

仅本人后台项目CLI（Command Line Interface，命令行接口）开发页面38586/38587/38588，源为883-final完整合格数据。29张JPEG（Joint Photographic Experts Group，图像格式）原图均已实际呈现并人工查看；用户18571及其他窗口未操作。

- [01-before-board-project-menu-en.jpg](01-before-board-project-menu-en.jpg)：原看板菜单保留目录身份，但没有输入查找。
- [02-before-project-typeahead-en.jpg](02-before-project-typeahead-en.jpg)：原创建菜单输入737后仍展示原候选，801未变。
- [03-after-board-search-737-en.jpg](03-after-board-search-737-en.jpg)：新增看板搜索737，仅真实737目录候选。
- [04-after-board-selected-737-en.jpg](04-after-board-selected-737-en.jpg)：Enter明确选择737，筛选结果与原目录一致。
- [05-after-create-empty-match-en.jpg](05-after-create-empty-match-en.jpg)：创建无匹配查询有英文说明，目录仍为737。
- [06-after-create-cancel-search-en.jpg](06-after-create-cancel-search-en.jpg)：Esc关闭搜索、恢复737，原请求保留。
- [07-after-create-goal-project-query-en.jpg](07-after-create-goal-project-query-en.jpg)：100项中的非首屏870-after项目可直接搜索。
- [08-after-create-goal-project-selected-en.jpg](08-after-create-goal-project-selected-en.jpg)：Enter选中870-after，完整目录与原请求保留。
- [09-after-create-windows-path-en.jpg](09-after-create-windows-path-en.jpg)：完整Windows801目录查询定位同一命名项目。
- [10-after-create-forward-path-en.jpg](10-after-create-forward-path-en.jpg)：正斜线完整801目录查询定位同一命名项目，选择前仍保留旧目标。
- [11-after-anonymous-query-en.jpg](11-after-anonymous-query-en.jpg)：手动表单按d3b428查询匿名项目。
- [12-after-manual-anonymous-selected-en.jpg](12-after-manual-anonymous-selected-en.jpg)：匿名项目明确选中，原标题/说明及全路径保留。
- [13-after-board-all-projects-en.jpg](13-after-board-all-projects-en.jpg)：全部项目选值已恢复；截图位于关闭动画，稳定看板以27为准。
- [14-after-inline-command-palette-en.jpg](14-after-inline-command-palette-en.jpg)：原内联命令面板737查询返回原六条记录。
- [15-after-inline-conversation-search-en.jpg](15-after-inline-conversation-search-en.jpg)：原Mission801会话搜索29消息中的批准返回13项。
- [16-after-inline-time-zone-en.jpg](16-after-inline-time-zone-en.jpg)：原内联时区London查询候选Europe/London。
- [17-after-time-zone-escape-failure-en.jpg](17-after-time-zone-escape-failure-en.jpg)：失败证据：第一次Esc错误关闭整个设置页。
- [18-final-time-zone-escape-retained-en.jpg](18-final-time-zone-escape-retained-en.jpg)：最终英文：第一次Esc关闭时区候选并恢复Asia/Shanghai，设置、标题和提示词保留。
- [19-final-second-escape-outer-en.jpg](19-final-second-escape-outer-en.jpg)：最终英文：候选已关闭后的第二次Esc才交给外层关闭设置。
- [20-final-time-zone-escape-retained-zh.jpg](20-final-time-zone-escape-retained-zh.jpg)：最终中文：第一次Esc保留时区、标题和提示词，随后正常取消。
- [21-final-board-search-737-zh.jpg](21-final-board-search-737-zh.jpg)：最终中文737搜索；截图为进入动画，稳定结果以24为准。
- [22-final-create-empty-match-zh.jpg](22-final-create-empty-match-zh.jpg)：最终中文无匹配说明；截图为进入动画，稳定说明以23为准。
- [23-final-create-empty-stable-zh.jpg](23-final-create-empty-stable-zh.jpg)：稳定中文无匹配提示与未提交草稿。
- [24-final-project-query-stable-zh.jpg](24-final-project-query-stable-zh.jpg)：稳定中文直接搜索非首屏项目，原目录直到明确选择才改变。
- [25-final-project-selected-zh.jpg](25-final-project-selected-zh.jpg)：Enter明确选中870-after，完整目录与中文原请求保留。
- [26-final-inline-command-query-zh.jpg](26-final-inline-command-query-zh.jpg)：最终原内联中文命令面板801查询返回原七条记录，Esc正常关闭。
- [27-final-board-801-stable-zh.jpg](27-final-board-801-stable-zh.jpg)：最终稳定801看板筛选，目录及唯一原Mission正确。
- [28-final-inline-conversation-search-zh.jpg](28-final-inline-conversation-search-zh.jpg)：最终原内联中文会话搜索仍29消息/13批准匹配。
- [29-final-conversation-search-closed-zh.jpg](29-final-conversation-search-closed-zh.jpg)：会话搜索自有Esc关闭后，原Mission阅读仍在。

[手动操作](actions.csv)、[完整资格](verification.json)、[根因与共享机制调查](../../records/2026-11/2026-11-02-project-discovery.md)。

实际行为：项目名/父目录/完整Windows及正斜线目录/匿名后缀可查；100项中非首屏项目可直接选中。输入查询、无匹配、Esc或未选择就移焦保持原目录，Enter明确选择才改变目标；AI请求和手动标题/说明保留，创建默认跟随看板筛选。英文和中文均实际交互。16–17暴露的Esc事件穿透已修于共享组合框：18/20第一次Esc只收候选并保留设置草稿，19第二次才关闭外层。原命令面板和会话搜索各自的关闭合同保持，最终26/28/29再次验证。

三阶段实际0模型请求/累计1260，原native句柄89866/16975/92375均exit0，public shutdown200，出生身份/物理/输出/请求结清，六份配对认证/完整模型目录副本退休。schema9/92表，旧业务行258687→258689→258691→258693，仅各阶段新增两条进程租约；100项目业务文件/Git、229附件、来源DB及原认证/完整模型目录均保留，零文件系统豁免。最终真实bundle为main-B6mbMiSX.js。

边界：没有有效创建/执行Mission、Goal或日程，没有调用模型，不把未提交表单当作真实模型端到端验收。未逐一覆盖全部项目、主题/缩放、屏幕阅读器软件、真实输入法组合、完整路径Tooltip悬停或所有故障/重连路径。13/21/22含进入或退出动画，23/24/27才作为稳定视觉证据；17是保留的真实失败。初次快速关闭窗口后紧接导航曾未生效，稳定页面再次普通点击成功，根因尚未证明，未宣称导航修复。原生日期/时间在中文20仍呈11/02/2026和09:00 AM，后续需核对本地化合同，本轮未修改。无UI自动化或合成消息。
