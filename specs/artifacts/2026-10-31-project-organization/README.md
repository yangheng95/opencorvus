# 匿名项目整理与来源连续性验收

对应[方案与根因](../../records/2026-10/2026-10-31-project-organization.md)。仅操作自建38433—38436开发服务与隐藏内置浏览器页93—96，未操作用户18571服务。21张截图均实际呈现并人工查看，不是UI自动化断言。

01—03：浏览器原生目录命令不支持；04—06：父目录可输入/必填/取消，发现连续对话框焦点问题；07—08：输入焦点修复；09—12：真实模型预检、两个自然read来源及搬迁前打开；13：中文父目录与名称语义；14：合法待机owner的409保护，未声称解决；15：显式释放仅本次QA会话待机后实际搬迁成功；16：原来源旧绝对路径读取失败；17—18：按已提交搬迁事实修复后两个原来源均可读取；19：正文链接读取当前项目文件；20—21：共享选择器实际打开现有项目。

已确认同一Project/generation/Session、六条原消息与两来源的完整身份/内容不变，新目录八文件与Git状态保持，两个原来源分别读取94/90字节。source-continuity-qualified.json记录原source/tool关联；输入文件是本轮明确放入新QA项目的真实输入。

四份qualified记录92表逐列比较：212537→212539→212541→214196→214198，schema始终9。实际模型六请求均gpt-6.1-sol、streaming、HTTP200和EOF，累计1112；前后观察及最终来源复核零新增模型请求。旧十项目/28 tracked、75附件、十三原文件与另十七文件保持。模型scope只有两个容量槽位由其真实runtime复用并释放，其他旧业务列全部保持。

四scope public shutdown200，原exec/native/launcher0及物理/输出/请求/OS出生身份结清后才退休配对auth+catalog副本；各留至少五分钟原deadline余量。原认证元数据及模型目录字节/元数据保持。

非UI聚焦正向验证：真实promotion及rollback两项、原绝对source读取一项、附件七项、文本与真实HTTP合同二十六项均通过。一次新增测试括号语法错误已修正并按原runner重跑通过。overlay两次普通build及类型/双语检查、backend类型通过；最终docs与push hook结果见方案交付记录。没有运行UI自动化测试。

范围边界：原生Tauri选择器、无输入Cancel和select初始焦点本轮未实操。合法待机owner仍须显式停止后才允许转换，普通用户提示与入口仍有体验缺口；14展示原保护，不将它当作已修复调度故障。中文旧菜单“实名项目”仍是后续文案问题。不存在schema/持久格式变更或真实用户数据库迁移。

## 截图

- [01-before-conversion-name.png](01-before-conversion-name.png)
- [02-before-browser-picker-failure.png](02-before-browser-picker-failure.png)
- [03-before-picker-error-details.png](03-before-picker-error-details.png)
- [04-after-parent-directory-dialog.png](04-after-parent-directory-dialog.png)
- [05-after-required-directory-feedback.png](05-after-required-directory-feedback.png)
- [06-after-cancel-focus-return.png](06-after-cancel-focus-return.png)
- [07-final-parent-initial-focus.png](07-final-parent-initial-focus.png)
- [08-final-type-without-refocusing.png](08-final-type-without-refocusing.png)
- [09-final-model-preflight-ready.png](09-final-model-preflight-ready.png)
- [10-final-real-preflight-complete.png](10-final-real-preflight-complete.png)
- [11-final-real-file-sources.png](11-final-real-file-sources.png)
- [12-final-source-before-move.png](12-final-source-before-move.png)
- [13-final-chinese-parent-directory.png](13-final-chinese-parent-directory.png)
- [14-final-promotion-result-error.png](14-final-promotion-result-error.png)
- [15-final-named-project.png](15-final-named-project.png)
- [16-final-source-after-move-failure.png](16-final-source-after-move-failure.png)
- [17-verified-historical-chinese-source.png](17-verified-historical-chinese-source.png)
- [18-verified-historical-readme-source.png](18-verified-historical-readme-source.png)
- [19-verified-body-current-file.png](19-verified-body-current-file.png)
- [20-verified-existing-folder-picker.png](20-verified-existing-folder-picker.png)
- [21-verified-existing-project-opened.png](21-verified-existing-project-opened.png)
