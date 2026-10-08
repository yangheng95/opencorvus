# 211 Ctrl+Home/End 转录阅读修复

## Recall

用户持续自主Sources/Rendering体验修复，最新只使用单agent。210已补真实Sol流式，但结束后键盘返回未响应；本轮按[调查方案](../../artifacts/2026-10-05-connection-workspace-authority/transcript-control-home-plan-211.md)先在真实Main同焦点对照。当前0af8028a/upstream相同、工作区初始干净。

## 根因及实现

共享控制器任意ctrlKey返回，Ctrl+Home缺少阅读暂停意图，浏览器上移后被跟随测量拉尾；Ctrl+End缺少向下到尾意图。真实DIV#chatScroll owner同一，旧CtrlHome稳定1302/true、普通Home0/false；旧CtrlEnd1302/false，child Source URL A焦点旧CtrlEnd尾部也false。只调整modifier识别，Ctrl Home/End进入既有方向逻辑，保留其他快捷键、默认处理、编辑控件与最近owner约束；不拦截浏览器默认导航或迁移焦点。三调用者沿用原合同，更新07。

## 真实验收及范围

类型81935=0，构建19855=0/52.78s/renderer public surface1/1，最终main-ChaFi5sr实际200。自己的真实211正常serve页面reload：Main CtrlHome稳定0/false、CtrlEnd1302/true；child CtrlEnd2349.333251/true、CtrlHome0/false，Main保持true。Textarea自己未发送39字符草稿CtrlHome/End caret0/39，同main top1313.333374/height1949/true；草稿清空。最终原ses_hMlVNrRdOLxQf4XhSds7首Source展开/title+host/Tooltip、child0/false保持。全部截图亲自看过，见[证据](../../artifacts/2026-10-05-connection-workspace-authority/transcript-control-home-211/README.md)，无UI自动化测试。

原父工具20951=0，22:23:30.658Z原生产native exited0、physical/output/request完整，固定deadline1791498621663内自然退出，独立Host72896/Target42916出生身份死亡、18131/pair闭合。自己26关闭、非本轮23未操作；全原153 runtime90表逐行一致副本、原Task未重启、未复制凭据或请求模型。

原失败、初次child焦点错误样本和弱textarea selection观察保留。Side Chat/其他平台/组合/长CtrlEnd及本次补丁下的流式尚未独立验，不能以210旧流式替代。文档/索引、范围提交、上游合并/完整待推送集合审查/正常push后持续单agent目标。
