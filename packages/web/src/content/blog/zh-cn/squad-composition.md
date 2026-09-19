---
title: "复杂任务如何由多支专家团协作"
description: "从模型与数据，到训练、产品、论文和交付的完整安排。"
locale: "zh-cn"
key: "squad-composition"
category: "cases"
order: 1
visual: "composition"
---

## 专家团组合起来

最长的工作不是一支队伍干更久，而是几支队伍各自负责一段，每一段交给下一段的都是能读的东西。

Mission 在启动时记录哪些专家团 ID 可用，之后再安装的能力不会静默扩大这个集合。子任务创建时，
从这个集合里解析出一个精确的包版本及其已选工作流，在该任务的生命周期内固定不变。组合发生在
Mission 层，归属仍留在任务层。

### 案例：从调研资料到一篇可投的论文

下面是一种研究任务职责划分示例；角色和工作流以当前专家团目录为准。

|     | 阶段 | 专家团                                                                                  | 交出什么                                                                 |
| --- | ---- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 01  | 立题 | [科学研究设计](https://opencorvus.com/zh-cn/market/builtin/scientific-research-design/) | 证据地貌、竞争假设、严谨性与伦理判断，合成一份研究决策登记册。           |
| 02  | 取证 | [深度研究](https://opencorvus.com/zh-cn/market/builtin/deep-research/)                  | 多视角检索与证据策展，初稿与最终报告之间隔着一道独立引文复核。           |
| 03  | 分析 | [数据分析与商业洞察](https://opencorvus.com/zh-cn/market/builtin/data-analysis/)        | 口径对账与表现、分群并行分析，再交给没跑过分析的角色核查。               |
| 04  | 成稿 | [研究工作室](https://opencorvus.com/zh-cn/market/builtin/research-studio/)              | 可留存的证据收集、可复现的分析、计算之后的事实核查，以及模板化交付。     |
| 05  | 审稿 | [学术论文审查](https://opencorvus.com/zh-cn/market/builtin/academic-paper-review/)      | 文献、新颖性、逻辑、方法与图表，外加一个独立于它们的引文与幻觉审计角色。 |
| 06  | 物料 | [Office 交付](https://opencorvus.com/zh-cn/market/builtin/office-delivery/)             | 投稿物料由同一批来源生成，带真实图表和校验回执。                         |

先验技术证据、实时页面观察、第二语言，都能接在同一条链上：加上
[专利格局与现有技术](https://opencorvus.com/zh-cn/market/builtin/patent-landscape-prior-art/)、
[浏览器研究与验收](https://opencorvus.com/zh-cn/market/builtin/browser-research-acceptance/)、
[本地化与适配](https://opencorvus.com/zh-cn/market/builtin/localization-adaptation/)，
可按任务需要增加相应职责。

要看的是它的形状，而不是单个阶段。这条链的六支里有四支各带一个角色，专职去怀疑不是自己做的那部分
工作 —— 深度研究的引文复核、数据分析的事实核查、研究工作室自己的事实核查，以及学术论文审查的引文与
幻觉审计。这让交付和复核的职责可以分开安排。

### 其它已经能用的组合

| 组合         | 链条                                                                           |
| ------------ | ------------------------------------------------------------------------------ |
| 交易尽调     | 并购尽职调查 → 法务会计调查 → 商事法务 → 税务合规 → 内部审计与控制保障         |
| 从事故到知识 | 服务可靠性与事件运营 → 数字取证事件调查 → 审查与调试 → 知识库运营              |
| 把东西发出去 | 产品管理 → 营销与增长战略 → SEO 与生成式引擎优化 → 产品视频制作 → 本地化与适配 |

在「一项交付可以被独立归属、独立验收、或被独立依赖」的地方拆；为拆而拆只会制造没有责任人的
协调成本。详见[专家团组合](https://opencorvus.com/zh-cn/concepts/squad-composition/)。
