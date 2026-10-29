# 菜单与提示层 Escape 实页证据

对应[调查与方案](../../records/2026-10/2026-10-29-menu-escape-ownership.md)。四个独立开发 `/ui` 实例：38330基线、38331被动诊断、38332首个普通修复、38333最终普通构建main-I1f_al31.js。29张原始JPEG均实际呈现并人工查看。没有UI自动化测试、截图基线、DOM文案断言或请求拦截；JSON观察记录来自真实键盘交互，只读，不充当视觉验收。

- 01–03：组织checkbox实际聚焦；native与locator Escape都留下菜单和Tooltip。
- 04–05：真实事件诊断与普通菜单对照。window capture未取消，Tooltip收到时已取消；普通菜单原强制关闭掩盖同一选择缺陷。
- 06–08：共享根因修复后，第一次Escape关闭说明且checkbox焦点保留，第二次关闭菜单并归还组织入口。
- 09–11：Priority、Manual与单列表实际选择；恢复By project和Last updated，五项均经过交互。
- 12–16：标题菜单、Composer嵌套Parallel菜单及普通项目菜单关闭。Parallel slider仍为5，没有修改并发设置。
- 17–18：普通导航说明与真实Usage页。
- 19–20：首个普通修复的Usage选择与失败证据。20实际退出整个设置，不能视为通过；追查设置section早于document提示层抢占Escape。
- 21–22：最终普通构建选中Oct28活动桶，Escape只关闭说明，焦点、18,234,654 Token区间选择和设置页均保留。
- 23：下一次Escape退出设置并归还Settings入口。
- 24：真实Theme Select关闭后仍留在Appearance，焦点归还Theme System；未变更主题。图片右侧控件受内置浏览器截取宽度限制，选择框的键盘返回另有原生可访问性观察，未将该图称为完整控件视觉验收。
- 25–27：中文组织说明、第一次Escape关闭提示、第二次关闭菜单并归还入口。
- 28–29：恢复English，By project/Last updated实值复核，外部指针点击关闭菜单。原生菜单打开时其它页面控件从可访问性树隐藏，语义heading定位无匹配；查看实图后在页面标题位置点击，成功关闭，未强制点击或更改DOM。

`diagnostic-events.json`为真实被动事件记录；`usage-observation.json`保留首次失败，`usage-final-observation.json`保留最终选择/焦点事实。`data.json`逐行核对四实例及其源库，全部103724原行精确相同，schema9、92表、integrity ok；原五输入和四个13文件附件namespace字节保持。`runtime.json`记录原exec join0、公开shutdown200、native/launcher0、完整物理/输出/请求结算、出生身份链退休和目录清退。四scope共0模型请求，累计767，未复制auth，用户18571页与进程未触碰。

`toolchain.json`保留两个初始ENOENT失败及修复后的官方Bun patch流程；没有把首次失败抹掉。`checks.json`为最终验收检查，不能替代上面截图。现Kobalte版本、根package/lock与既有25083补丁字节保留；移除Usage局部Escape特例与全部诊断代码。未穷举95处Tooltip、原生桌面全部窗口、输入法组合键或自定义Menu取消hook矩阵；相关取消合同已代码复核。未宣称整个产品或持续Goal完成。
