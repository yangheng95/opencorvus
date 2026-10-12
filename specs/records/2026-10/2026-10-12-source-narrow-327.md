# 327 窄侧聊来源与分隔条修复

[Recall与逐项准入](../../artifacts/2026-10-05-connection-workspace-authority/source-narrow-plan-327.md)。单agent；真实280px Side来源阅读、后续生成3161字符及关闭重开时，同一Source读位保持543.3333129882812。实际采样未见反复Rendering，但未以普通Side代替子成员专属路径或全部帧验收。

实测另发现右分隔条辅助访问值默认为50，以及既有±5px拖动区域被overflow:hidden裁成1px。已统一原width bounds与ARIA范围投影，按真实Dock/workspace几何更新，并删除该裁剪。新页面人工验证键盘280/304/441、指针330、导航变化max441/722、关闭重开及两侧线外拖动337/380；原Source仍可读。[完整截图和证据](../../artifacts/2026-10-05-connection-workspace-authority/source-narrow-327/README.md)。

类型/两次构建及文档通过，无UI自动化。两轮真实Sol流式请求10/6均正常结束；原2323/39970与检查44906/56557/68311均actual exit0。自己的102/103/104页面、两个Native/Host、18297/18298和两组复制凭据/模型目录均清理。持续goal active。
