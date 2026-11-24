# 无关键词浏览多步任务技能的桌面证据

基线 `41630/ui/`，资产 `main-Bu_7pUpj.js`。实际 Windows 桌面 1280 × 720，英文 100%、简体中文 160%。

| 基线截图 | 观察 |
| --- | --- |
| [英文全部技能下翻](baseline-en-unfiltered-skill-page-leaves-old-focus.jpg) | 30 项完整目录滚到了其他技能，真实焦点仍在离屏的 `handoff-global-01`。 |
| [英文下翻后回车](baseline-en-unfiltered-enter-opens-old-skill.jpg) | 实际打开离屏的旧技能。 |
| [中文项目末项](baseline-zh-project-last-skill-before-page-up.jpg) | 22 项项目来源末项的确切焦点和肉眼可辨轮廓。 |
| [中文项目上翻](baseline-zh-project-page-up-leaves-last-skill.jpg) | 来源仍是项目，屏幕显示其它技能，末项焦点离屏。 |
| [中文上翻后回车](baseline-zh-project-enter-opens-wheel-storage.jpg) | 实际打开以前的项目末项 `wheel-storage`。 |
| [中文输入关键词后的对照](baseline-zh-project-filtered-works.jpg) | 相同来源有 21 项匹配，上翻后 `handoff-project-17` 实际完整聚焦。 |

[实际动作和焦点位置](baseline-desktop-focus.json)、[正式主项目及独立项目目录](baseline-catalog-identities.json)。

最终真实服务 `41632/ui/`，前端资产 `main-DpFpBy5E.js`。下列截图均已本人复核。

| 最终候选 | 观察 |
| --- | --- |
| [英文完整技能目录](candidate-en-full-catalog-input-and-guidance.jpg) | 空白搜索显示全部 30 项和键盘提示。 |
| [英文实际分页](candidate-en-all-page-keeps-actual-skill-in-view.jpg) | `handoff-project-02` 实际聚焦、整行完整显示。 |
| [英文实际详情](candidate-en-all-opens-that-skill-overview.jpg) | 准确打开相同的项目技能，显示其真实调用与路径。 |
| [中文无关键词的项目来源](candidate-zh-project-blank-search-keeps-source-and-guidance.jpg) | 22 项项目技能及本地化提示。 |
| [中文项目上翻](candidate-zh-project-page-up-shows-entire-target.jpg) | 实际焦点移动到 `handoff-project-17`，整行和描边可读。 |
| [中文正确详情](candidate-zh-project-opens-exact-detail.jpg) | 打开真实 17，概要、返回、调用与项目路径均可见。 |
| [中文用户全局翻页](candidate-zh-global-no-query-pages-within-source.jpg) | 无词目录保持用户全局来源，实际焦点进入 05。 |
| [中文内置空结果](candidate-zh-builtin-zero-results-remain-in-search.jpg) | 空状态可读，输入保持焦点和查询。 |
| [中文唯一内置](candidate-zh-single-builtin-keeps-real-row.jpg) | 两个页键都保持真实唯一的 `general`。 |
| [中文全部来源刷新](candidate-zh-refresh-reads-complete-catalog.jpg) | 实际刷新读回保持 30 项和刷新焦点。 |

[操作与实际焦点](candidate-desktop-focus.json)、[桌面刷新前后顺序](candidate-desktop-skill-order.json)、[正式前后目录](candidate-catalog-identities.json)和[比对与读回回执](candidate-catalog-comparison.json)。
