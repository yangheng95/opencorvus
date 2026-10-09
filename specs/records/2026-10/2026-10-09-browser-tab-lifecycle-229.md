# 229 浏览器标签生命周期

[修改前Recall与影响分析](../../artifacts/2026-10-05-connection-workspace-authority/browser-tab-lifecycle-plan-229.md)。单agent修复228实际工具切换草稿丢失：两个Browser TabPanel原来被Kobalte presence卸载，现复用forceMount保留仍open的单一实例；primary按exact browser记录寿命，operator由原For record寿命。显式close/reset仍dispose原owner，不新增URL/draft缓存或第二writer。

## 实际体验

[真实页面证据](../../artifacts/2026-10-05-connection-workspace-authority/browser-tab-lifecycle-229/README.md)。正常项目开发serve `/ui`，实际新bundle与HTTP200。英文Sources展开/打开原README实际正文并回Browser保留地址；第二浏览器不同地址、溢出菜单互切、hide/reopen、关闭other保留first、第三tab新空状态均实际操作通过。外部按钮真正创建UI56原首页且地址立即保留，Enter原不可用反馈继续显示。实际中文深色File→Browser与菜单Escape通过；切到原匿名项目会话清除旧工具、新Browser为空。所有截图均人工查看，own55/56关闭，用户23/18107不动。

## 收敛与检查

fresh原Source/config/两个Project/execution/请求/发布/recovery/lease/容量/birth/pair核查，90表逐行相等复制，原Session/Project/directory保留；没有auth/models或新模型调用/旧Task重启。实际Native与原foreground退出0，physical/output/request/pair完成；最终13表全行相等。两个Project只观察到各自.git目录mtime变化，明确保存原before/after属性而非全目录相等。types/build实际0；文档检查与正常提交/上游合并/完整待推送集合审查/push作为交付动作。无UI自动化测试，静态工具链不替代真实视觉。

## 剩余问题与覆盖限制

真实未selected tab aria-controls曾为null，旧定位失败后通过当前实际trigger ID完成操作；链接元数据根因需独立调查。Task固定primary Browser及真正Tauri Native多tab生命周期尚未真实UI/运行验收；长URL Sources矩阵、原227Clipboard异常根因亦未解决。本切片不能宣称全面体验完成，持续单agent自主迭代。
