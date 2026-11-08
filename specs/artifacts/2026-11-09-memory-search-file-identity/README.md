# 记忆搜索文件身份的证据

对应[Recall、根因、实现与资格](../../records/2026-11/2026-11-09-memory-search-file-identity.md)。本人独立，无子agent、UI自动化、凭据或模型。

- 01–04：原两文件产生三个真实分块命中，UI生成三行；点一次同文件的两个结果均展开，03–04可见重复整文件全文。原后端chunk身份各不同，显示映射却重复使用file身份。
- 05–06：修复后原两个file各一条，保留各file第一个正式排名摘要/score；展开原多小节file仍完整呈现第一、第二节。
- 07–10：独立文件可单独展开，中文切换保留query/展开/原文；清除与重新搜索仍正确文件级身份和当前列表/搜索样式。

十图本人实际呈现查看，06为完整原文主要证据。手动只读DOM解释原重复file/detail ID及新唯一行，不是UI自动化或视觉替代。

before/after-memory.json是原领域writeFile/chunks/FTS事实；before/after-tcp-schema-check.json各四项实际HTTP200/current/doc schema，后端始终原3chunk/2file、正式顺序/原文/score不变，两个get都完整原文。UI只在原20chunk窗口按file ID取首排名投影，不宣称20个完整文件或改变Tool/后端分块合同。

seed/owned-final-check保存两Git原文件/HEAD、四原Memory身份/归属/创建时间/完整内容，DB Session0/Message0、两profile空配置和正常未跟踪元数据；可变host文档时间不作常量门槛。helper只访问明确隔离领域/HTTP/只读DB，不控制UI。

自有39006/39007均正常shutdown200/原exec exit0，页92/93关闭。类型/i18n2932/Node build51.40s/renderer/docs/架构通过，main-C-dko5CU.js。Sol/Provider/权限与引擎执行恢复、未知用户历史错归属数据仍未验；不把后端数据检查当UI或模型端到端。
