# 销售核对复验与原件按需下载证据

对应[规格与Recall](../../records/2026-11/2026-11-27-sales-source-fact-review.md)。先证实通用原件在点击前已生成完整Blob链接，再删除挂载读取并复验真实404恢复下载。截图由本人实际操作并逐张查看，未使用UI自动化测试。

- 来源任务：[中文报告原文件](销售核对说明-来源复验.md)、[正文上段](report-top.png)、[正文下段](report-bottom.png)；模型仅按实际sales.csv读取/精确计算交付4221字节。旧任务调查见[原完成交付](completed-task-deliveries.png)，[未保存输入保护](unsaved-input-protection.png)未发现当前缺陷。
- 基线：[点击前原件链接事实](before-click-original-link.json)、[真实附件页面](before-click-attachment.png)。链接生成依赖完整原件读取，之后真实下载1048712字节一致；没有性能时间/内存计量。
- 初候选：[下载入口](candidate-download-ready.png)、[键盘再次下载](candidate-download-repeat.png)、[真实离线诊断](candidate-offline-details.png)。最后一图暴露同行诊断挤压文件名，随后改为失败动作独立整行。
- 失败恢复候选：[真实404布局](final-failure-layout.png)、[同一动作恢复下载](final-retry-success.png)、[已记录PPTX原件](final-recorded-original.png)；main-BJRMtkM5.js。相同按钮保留焦点，原件恢复后Enter直接下载，ZIP131202字节/历史PPTX16266字节均与原件一致。清除旧链接无调用回焦分支后，[最终源码页面](final-source-download.png)main-lXdKOw-X.js再次实际下载1048712字节一致，共12张人工查看截图。
- [真实接口/业务文件/下载/旧数据checker结果](delivery-facts.json)、[实际checker](check-delivery-facts.py)、[布局候选构建](candidate-build.log)、[最终源码构建日志](final-build.log)、[流式与退役汇总](verification-summary.json)。8项下载授权测试/14断言通过，类型/语言/CSS/文档/架构检查通过。
- 精确Sol流式审计：[run30](run30-model-audit.json)、[run31](run31-model-audit.json)、[run32](run32-model-audit.json)、[run33](run33-model-audit.json)、[run34](run34-model-audit.json)。28次HTTP200且源reader全部结算；27次eof，run31一次后台memory因本人停服而aborted，同来源run32恢复到eof，最终持久文档idle/revision19且已覆盖来源。五原句柄退出0、成对副本退役、64757端口关闭；run34停止前reader结算检查通过。

UI上传使用现有扩展时受本地文件权限限制，故通过正式附件/消息API准备输入，未宣称UI上传通过。目录清单下载、进行中切换取消仅代码审查；没有原生PowerPoint编辑或发布声明。凭据、模型目录本体、加密推理和原始私密历史副本不进入产物。
