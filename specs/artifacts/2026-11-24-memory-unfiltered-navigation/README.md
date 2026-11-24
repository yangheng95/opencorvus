# 完整项目笔记列表的桌面证据

Windows 桌面 1280 × 720。基线 `41670/ui/` 加载 `main-B2Tql0pN.js`。英文 100%，简体中文 160%。

| 基线截图 | 观察 |
| --- | --- |
| [英文完整列表下翻](baseline-en-full-note-page-leaves-focus.jpg) | 正文显示其他笔记，原 `Staging cart wheels` 的焦点位于视口外。 |
| [英文回车后的视口](baseline-en-enter-opens-offscreen-original.jpg) | 画面仍在其他笔记处，实际展开的是离屏条目。 |
| [英文原文身份](baseline-en-original-identity-after-tab.jpg) | Tab 到原文，实际显示旧 `Staging cart wheels` 的原内容。 |
| [中文完整列表上翻](baseline-zh-full-note-page-leaves-focus-160.jpg) | 焦点仍在视口下方的 NT-01。 |
| [中文提交查询对照](baseline-zh-query-page-control-160.jpg) | 已提交结果从 NT-01 上翻后实际聚焦 NT-04，标题、元数据和摘要完整。 |
| [中文切换第二项目](baseline-zh-second-project-source-160.jpg) | 显示实际 `receiving-yard` 路径；空词箭头仍留在普通搜索输入。 |

[焦点和正文位置](baseline-desktop-focus.json)、[正式主项目笔记与查询](baseline-file-search-identities.json)、[正式第二项目的唯一原文](baseline-secondary-note.json)。

初版 `41672/ui/` 加载 `main-B6NWVfBS.js`。英文下翻已移动到正确笔记，[下边缘实图](candidate-first-en-focus-ring-at-bottom-edge.jpg)仍可见焦点轮廓被裁切。[初版的实页位置](candidate-first-desktop-focus.json)

最终 `41674/ui/` 加载 `main-DPV2Gw9j.js`。人工复核相同桌面和两种语言的实页原图。

| 最终截图 | 观察 |
| --- | --- |
| [英文完整入口](final-en-full-note-entry.jpg) | 空搜索显示笔记浏览提示。 |
| [英文下翻视口底边](final-en-bottom-edge-complete-focus.jpg) | NT-08 的控制行、状态和完整焦点环与底边之间留有空间。 |
| [英文翻页后的实际原文](final-en-exact-original-after-paging.jpg) | 实际展开 NT-12，原生 Tab 聚焦正确原文。 |
| [英文已提交结果下翻](final-en-accepted-query-page-focus.jpg) | NT-10 的标题、分数、文件匹配摘要及焦点环完整。 |
| [英文已提交词与草稿](final-en-distinct-submission-and-draft.jpg) | 输入中是 `note18` 草稿，列表仍对应已提交的 `inventorycheck`。 |
| [中文完整列表上翻](final-zh-full-note-focus-160.jpg) | NT-07 的标题、项目及焦点环可读。 |
| [中文第二项目唯一笔记](final-zh-secondary-current-project-160.jpg) | 显示 `receiving-yard` 真实路径和唯一笔记的完整控制行。 |
| [中文第二项目原文](final-zh-secondary-exact-original-160.jpg) | Tab 聚焦 `Rail yard visitor log` 的准确原文，原文与来源元数据均可读。 |
| [中文无匹配](final-zh-no-match-160.jpg) | 主项目显示本地化的无匹配提示并保留搜索焦点。 |

[最终实页焦点](final-desktop-focus.json)、[实际内容和两项目显示顺序](final-desktop-identities.json)、[正式主项目笔记与搜索](final-file-search-identities.json)、[正式第二项目原文](final-secondary-note.json)。
