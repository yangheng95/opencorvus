# 设置组合词发现证据

对应[方案与调查](../../records/2026-11/2026-11-08-settings-multi-term-search.md)。本批仅使用本人临时 profile/project 与真实 /ui 设置页，不使用凭据、模型或产品消息。

前态 38944/main-CwbrNz6g.js，1280×720；每张截图均已人工查看：

- 01-before-single-language.jpg：单词发现 Appearance，General 仍活动。
- 02-before-combined-english.jpg / before-english.json：真实 language appearance 空状态，保留当前 General。
- 03-before-combined-chinese.jpg / before-chinese.json：原地切中文，单词“语言”能发现外观，反序“语言 主题”为空状态。

最终构建 38945/main-C3zpoJNv.js，1280×720；04–11 均人工查看：

- 04-after-combined-english.jpg：同一英文组合发现外观，通用仍活动。
- 05-after-keyboard-appearance.jpg：大小写/真实 Unicode 空白组合；Tab/Down 仅移焦，Return 才进入 Appearance。
- 06-after-network-draft-matching.jpg：匹配外观时当前 Network 及本人代理草稿仍保持。
- 07-after-different-page-terms.jpg：language proxy 跨页词组合为空状态，当前页与草稿保持。
- 08-after-escape-draft-preserved.jpg：Clear 与非空 Escape 后恢复 18 个导航及搜索焦点，草稿保持。
- 09-after-chinese-combined-draft.jpg：原地切中文，“语言 主题”发现外观，网络/草稿保持。
- 10-after-chinese-appearance.jpg：恢复代理原值后明确进入外观，中文正文正确。
- 11-after-chinese-network.jpg：中文“Git 通知”/“代理 网络”明确导航后的网络目标，代理为空、开关关闭。
- after-observations.json：相应真实查询、显示导航/选中、焦点、草稿和最终构建身份观察。

只读观察中的 tabs 是实际显示导航，包括当前页 pin，并非全是匹配结果。没有 UI 自动化测试、DOM 断言或截图比较门槛。原始完整服务日志仅留私有临时根；本人两个 /ui 页及服务均已正常关闭，原启动句柄 exit 0。
