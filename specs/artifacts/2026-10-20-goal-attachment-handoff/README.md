# 真实附件与 Goal 移交证据

[调查与根因方案](../../records/2026-10/2026-10-20-goal-attachment-handoff.md)。使用自有 native 开发服务18743/18745及IAB tab5/tab6；用户18571与真实用户数据库未操作。所有截图1280×720，真实交互后逐张人工查看，没有UI自动化。

- [全局真实上传](global-uploaded.png)、[Goal预填及待发送说明](goal-pending-attachment.png)：真实文件选择器、自制无敏感txt、同Project的新Session、取消后保留。
- [目录入口原错误](before-folder-error.png)：浏览器把不支持的原生命令暴露为上传错误。[新英文菜单](after-folder-menu-en.png)与[中文菜单](after-folder-menu-zh.png)已按现有宿主能力禁用并说明桌面可用；原生桌面picker没有实际运行。
- [真实一次read许可](attachment-read-result.png)、[读取结果](attachment-read-complete.png)、[Sources只读内容](attachment-source-reader.png)：gpt-6.1-sol实际read后返回文件第二行ATTACHMENT462READY，文件名、3行与精确内容可见。
- [创建Goal后保留文件和草稿](after-goal-retains-file.png)、[人工完成判断后仍保留](after-pending-goal-complete.png)：新构建重新上传文件、有限1轮Goal返回PENDING462READY；34515令牌。完成由operator通过真实UI记录，公开协议author=user，不能称模型自动完成。

[持久化事实](manual-ui-facts.json)包含实际Message/Part、read request/outcome、canonical引用与原始字节/metadata匹配、Goal事件；仅证据投影省略Provider不透明replay元数据。[结果](results.json)、[完整历史](history-verification.json)、[正式构建日志](build.log)。两套native settlement文件包含实际Provider模型/流终态、物理/输出/请求/launcher结算；[秘密扫描与凭据对退休](private-pair-retirement.json)。

116 Project/158 Session、schema2保留113/155及115/157两个基线的每个原身份/归属/目录。Task/Mission独立入口、桌面原生目录picker、原完整历史配置保存10s/恢复5s仍未达；本轮没有新的侧agent Rendering验收。
