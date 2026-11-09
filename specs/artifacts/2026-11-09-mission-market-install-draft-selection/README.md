# 多步任务市场安装与草稿选择证据

[规格与复核](../../records/2026-11/2026-11-09-mission-market-install-draft-selection.md)。隔离的真实桌面 `/ui`，1280 × 720，未提交草稿或执行请求。

- [01](01-before-draft-default-selection.jpg)：旧版草稿只选 Dynamic。
- [02](02-before-market-install-action.jpg)：旧版聚焦 Deep Research 的项目安装动作。
- [03](03-before-success-says-automatically-selected.jpg)：旧版成功提示称已为本次任务选中。
- [04](04-before-draft-now-has-two-selected-squads.jpg)：旧版安装使选择从 1 变为 2。
- [05](05-after-focused-project-install.jpg)：新版英文真实项目安装前的键盘焦点。
- [06](06-after-installed-option-remains-unchecked.jpg)：安装后原搜索获焦，Deep Research 可选且未勾选。
- [07](07-after-explicit-selection-adds-the-squad.jpg)：显式勾选 Deep Research 后成为两项。
- [08](08-after-english-install-only-notice.jpg)：英文只确认项目安装，并说明可在列表中选择。
- [09](09-after-chinese-draft-keeps-one-selection.jpg)：中文草稿保留查询、焦点和唯一选择。
- [10](10-after-chinese-install-only-notice.jpg)：中文安装提示。
- [11](11-after-cancel-keeps-missions-empty.jpg)：取消后回到空任务页，创建按钮获焦。

[读取检查器](check-mission-market-install.mjs)在真实开发服务运行时校验其 `/doc` 和业务响应；[落盘检查](audit-owned-data.py)在服务退出后核对项目文件、请求事件和数据库。两个服务各自的资源记录、检查响应及[落盘检查结果](owned-final-check.json)随本目录保存。
