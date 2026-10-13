# 387 电子表格身份与运行时语言

真实 Chat `ses_h0VKkCl7hbz3BKHVW2Xp` 的产物 `art_g0VXv65e1004ErsrwSJs`，标题 Desk budget、工作表清单。由已授权 GPT-6.1 Sol 自然发布，没有写入伪消息或产物。详见[规格](../../records/2026-10/2026-10-13-spreadsheet-artifact-identity-387.md)。

- [原始请求](chat-input.json)、[接受回执](chat-accepted.json)、[规范数据](canonical.json)与[实际checker](check-canonical.py)/[结果](canonical-check.json)：首次工具输入同时含value:null与formula被明确拒绝，模型纠正后正常发布；8个单元格、20行6列、首行冻结及SUM公式均与请求一致。
- [模型审计](provider-live/spreadsheet-artifact-identity-387-before-final-provider-audit.json.gz)：6次gpt-6.1-sol流式请求均HTTP200/EOF。传输成功与上面的实际业务成功分别核对。
- [修前中文徽标](screenshots/before-fullscreen-zh.png)仍显示Spreadsheet；[修前中文页面中的内部菜单](screenshots/before-inline-menu-zh.png)仍显示英文。这是同一工作簿先英文挂载再切中文的实际前态。
- [修后中文类型](screenshots/after-initial-zh.png)、[英文菜单](screenshots/after-menu-en.png)及[再切中文后的菜单](screenshots/after-menu-zh.png)：主agent逐步交互并人工查看，语言通过当前实例更新。
- [真实单元格编辑](screenshots/after-edited-zh.png)、[语言往返后的中文工作簿](screenshots/after-edits-language-roundtrip.png)与[最后英文工作簿](screenshots/after-edited-en.png)：B2从7改为9、B4从12重算为14、选区B3保留，标题和清单名称保持原文。
- [实际CSV下载](edited-workbook.csv.gz)为61字节，UTF-8 BOM和四行内容逐字节核对通过，Notebook=9、Pen=5、Total=14；[下载后页面状态](after-download.txt)记录焦点回到下载按钮。不是原payload中的7和12。
- [完整手工验收及收尾](manual-review.json)、[前态服务](ui-before/terminal.json)、[后态服务](ui-after-review/terminal.json)均绑定独立owner，两个页面关闭、launcher正常exit0；[模型物理与配对清理](provider-live/spreadsheet-artifact-identity-387-before-physical-terminal-and-pair-cleanup.json)在原600000ms边界内完成。模型服务没有打开页面，先完成真实模型数据并正常停止，再以无凭据生产listener提供当前私有构建的页面。
- [类型检查](typecheck.log.gz)与[构建](build.log.gz)exit0；构建7300模块、72秒。真实页面使用生产listener/recovery和私有UI，无独立Vite服务或UI自动化。

剩余边界明确保留：[全屏内部菜单](screenshots/after-fullscreen-popup-hidden.png)仍不可见；[真实popup父链](fullscreen-popup-observation.json)显示活动菜单挂BODY，[全屏归属](fullscreen-owner-observation.json)是Desk budget的独立SECTION，交由389继续处理。库内`Sheet tabs`、`Close sidebar`、`Notifications alt+T`无障碍名称仍为英文，不声称整个第三方库已完成本地化；只读、多工作表未另实页验收。387只交付类型身份和运行中可见菜单语言修复。

[归档清单](archive-manifest.json)限定54项文本/压缩证据和原始截图，内存凭据去除/扫描通过；未复制auth/models、数据库或运行目录。截图均由主agent实际查看，DOM内容仅用于手工诊断，未作UI断言。
