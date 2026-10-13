# 375 附件原名与图片链接

[Recall及实现方案](../attachment-display-plan-375.md)。改前标题问题见[374相对附件标题](../source-file-identity-374/after/06-attachment-relative.png)和[绝对附件标题](../source-file-identity-374/after/07-attachment-absolute.png)。

真实开发服务18382、页面200；最终main-CAo85tzZ.js。以下12张截图均人工查看，没有UI自动化或截图断言：

| 图 | 人工观察 |
| --- | --- |
| [00](after/00-image-link-before.png) | PNG链接离开/ui，显示无样式Preparing Environment。 |
| [00b](after/00b-rebuild-in-progress.png) | 重建目录后旧页面worker资源404，正文明确显示失败。该生命周期问题留作下一轮。 |
| [01](after/01-first-absolute.png) | 第一份附件绝对引用显示原名与FIRST375。 |
| [02](after/02-second-relative.png) | 同名第二份附件显示SECOND375，资源独立。 |
| [03](after/03-source-original-name.png) | Source按钮仍显示原始名称与正确第一份内容。 |
| [04](after/04-image-name.png) | PNG正文链接在工作台显示原名、实际图片和只读。 |
| [05](after/05-image-enlarged.png) | 图片放大预览正常，实际无障碍标签保留原名。 |
| [06](after/06-pdf-name.png) | PDF原名及16页文件第一页实际绘制。 |
| [07](after/07-ordinary-file.png) | 普通文件显示自己的名称/正文，保留Save。 |
| [08](after/08-metadata-error.png) | 缺失元数据返回明确404诊断，旧内容已清除。 |
| [09](after/09-metadata-recovered.png) | 恢复实际元数据后Retry显示其原名及METADATA375。 |
| [10](after/10-name-after-recovery.png) | 切回第二份附件，名称和内容对应正确。 |

after/live-content-api.json记录6项实际HTTP内容/错误结果；每份完整decoded字节与私有上传原件比较。checks/runtime-qualification.json核对2个实际Source、完整ToolOutcome、5份附件字节/元数据、6次Sol EOF和原Native全闭合。模型只读取文本附件，PNG/PDF为真实文件接口及页面预览验收。

原15128 exit0，Native568620ms，原固定600000ms/12请求预算未延长；实际仅6请求。页面、Host/Native、输出、请求、端口和auth/models副本均关闭。合同14项通过，SDK、类型、最终build通过。当前推送检查另由仓库钩子执行。

00b的旧worker404有实际HTTP与旧main脚本证据，新main及新worker为200；记录其未修复状态，不能把刷新通过当作根治。RAW等其它图片格式本轮仅补齐入口识别，没有宣称实际解码验收。证据日志/AX完整压缩，原件私有保留并扫描凭据。
