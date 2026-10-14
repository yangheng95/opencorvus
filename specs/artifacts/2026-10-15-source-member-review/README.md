# Sources与成员侧栏体验证据

[方案与Recall](../../records/2026-10/2026-10-15-source-member-review.md)。本批为真实交互和原图人工复核，无UI自动化测试、假消息、凭据或完整数据库文件。

| 原图 | 实际资格 |
| --- | --- |
| 01 | 原412成员长正文末尾，完成态 |
| 02 | 普通成员Source实际打开README第2—3行 |
| 03 | 从文件tab返回成员，原Source与正文可读 |
| 04 | 全部成员列表往返后的阅读区域 |
| 05 | 关闭重开dock后的同一阅读区域 |
| 06 | 实际切换简体中文再返回成员 |
| 07 | 原416第二位成员0sM0的长正文 |
| 08 | 第二位成员真实Source为第3行；不是复制粘贴成功证据 |
| 09 | 实际打开该Source后只高亮README第3行 |

`facts/historical-sources.json.gz`保留4个原始Session、当前消息身份和6条真实来源；只读checker精确核对两成员第2/3行分别归属。`provider-summary.json.gz`证明3条实际Sol流均200/eof；`native-host-settled.json.gz`与`physical-terminal-and-pair-cleanup.json.gz`证明公开shutdown后原进程与复制配对退休。原始脚本及launch日志归档供核查。

这是当前实现的完成态历史复验，01文件名中的before不是旧缺陷版。未观察到已有正文反复Rendering，不外推到新流或全部瞬时闪烁。CUA虚拟剪贴板拒绝真实粘贴，错误事实保留在方案中；无粘贴成功图或模拟内容。
