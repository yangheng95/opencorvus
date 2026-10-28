# 导航操作结果与焦点

29张原始JPEG实际呈现并人工查看；全部使用隔离开发 `/ui`、普通构建与真实请求，没有UI自动化、网络拦截、组件/DOM测试、源码文案断言或截图差异比较。模型请求0、累计767，没有复制auth；用户18571与原窗口未操作。

| 原图 | 实际观察 |
| --- | --- |
| [01](01-header-action-before.jpg)、[02](02-header-archive-silent-failure.jpg)、[03](03-sidebar-pin-silent-failure.jpg) | 基线归档/置顶在真实断网后只消失菜单，无操作反馈。 |
| [04](04-header-pin-success.jpg)、[05](05-pin-confirmed-menu.jpg)、[06](06-chat-archived.jpg) | 置顶后菜单显示Unpin，再取消置顶、归档Chat。 |
| [07](07-work-conversation-actions.jpg)、[08](08-task-archived.jpg)、[09](09-four-archived-records.jpg)、[10](10-four-restores-complete.jpg) | Work/Task/Mission分别归档；四类记录在设置页实际逐条Restore到空归档。07菜单右缘未完整捕获，不以它证明完整文字布局。 |
| [11](11-rename-form-retained.jpg)、[12](12-header-archive-visible-failure.jpg)、[13](13-header-error-original-details.jpg) | 现有改名表单保持，归档失败出现记录名称和原始Failed to fetch详情；此时键盘焦点仍有问题。 |
| [14](14-menu-escape-focus.jpg)、[15](15-rename-input-focus-final.jpg)、[16](16-dialog-close-loses-opener.jpg)、[17](17-error-modal-still-loses-focus.jpg)、[18](18-rename-cancel-still-body.jpg) | 保留未通过的中间结果：普通菜单Esc与输入焦点可用，取消/错误modal仍丢焦点。不能当作最终通过。 |
| [19](19-default-focus-error-dialog.jpg)、[20](20-final-cancel-returns-opener.jpg)、[21](21-project-menu-opener-retired.jpg)、[22](22-final-header-error-focus.jpg)、[23](23-error-close-without-explicit-owner.jpg) | 原生默认挂载聚焦修复错误modal，控制生命周期修复普通改名取消；异步错误仍需要明确返回目标，Project入口退休仍未完成。 |
| [24](24-owned-header-error.jpg)、[25](25-owned-error-return-focus.jpg) | 最终普通构建：错误modal初始OK聚焦，Enter关闭后回同一header more trigger。 |
| [26](26-chinese-sidebar-failure.jpg)、[27](27-chinese-original-diagnostic.jpg)、[28](28-sidebar-main-focus-restored.jpg)、[29](29-sidebar-menu-usable-again.jpg) | 中文真实置顶失败、原技术详情、Tab到确定/Enter返回原记录主按钮，再Right/Return可重新操作菜单。 |

[diagnostic-focus.json](diagnostic-focus.json)是实际console原回执，只有节点标识/生命周期：打开正确捕获trigger，但controlled open仍true的FocusScope cleanup过早清掉它。最终源码已移除临时日志。共享Dialog现在只在真正关闭时退休opener，并沿真实菜单ARIA控制关系识别原入口；异步操作透传当前UI owner的现有returnFocusTarget合同。

[data.json](data.json)逐表核对8份库和源库，原行保留、归档/置顶已恢复。只有三个Session更新时间改变；新增136行属于10项规范metadata发布、投递及22项lease/grant（21项按时间释放、1项永久process receipt已由精确物理出生链证明退出）和同一Mission archive的closing/closed事实，未新增消息或模型执行。五个原QA文件和每个13文件的附件namespace逐字节与元数据复核，schema9/integrity ok，真实用户库未升级。

[runtime.json](runtime.json)保留原22:23:28.892Z截止。7个正常实例公开shutdown200、原exec/native/launcher0并完整结算；另1个实例因15分钟窗口超过剩余时间和5分钟余量，启动保护退出，原exec工具1/native7/launcher7，同样完整收拢与catalog清退。最后改用5分钟窗口，原截止未续开。所有自有页均关闭。

[checks.json](checks.json)记录实际类型、普通构建/renderer、2619键i18n与文档检查。[toolchain.json](toolchain.json)记录Bun正式补丁流程、失败及修正；原core补丁完整保留，只增加三处同一条件，根package.json/bun.lock不变。[Kobalte关闭聚焦合同](https://kobalte.dev/docs/core/components/dropdown-menu/)、[Bun补丁流程](https://bun.sh/docs/pm/cli/patch)支持对应实现。

**未完成：** Project菜单的触发节点在离开hover/焦点后退休，关闭返回仍为BODY；图21保留该缺口，下一批继续处理。慢请求/跨连接迟到完成和全站其它菜单仍只有代码归属审查，未宣称完整实页矩阵通过。未进行真实Provider调用、非桌面验收或新版本发布。
