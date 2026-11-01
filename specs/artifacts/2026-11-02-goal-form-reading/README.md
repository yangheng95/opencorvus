# 持续目标长文本表单体验证据

对应[修改前调查与方案](../../records/2026-11/2026-11-02-goal-form-reading.md)。本目录只记录本人实际页面交互、截图人工复核和非敏感运行资格；未验证项目不预填通过。

| 原图 | 实际观察 |
| --- | --- |
| [01](01-before-objective-fixed-en.jpg)、[02](02-before-evidence-fixed-en.jpg) | 旧版9行目标只露出约3行，8行依据只露出约4行。 |
| [03](03-after-objective-expanded-en.jpg)–[12](12-after-evidence-guide-return-zh.jpg) | 首次接入公共组件后的目标/预算/指南/长短文/必填/中文Home预填和依据。下述公共缺陷仍未解决，因此不是最终通过版本。 |
| [13](13-after-long-evidence-start-zh.jpg)、[14](14-after-evidence-caret-outside-view-zh.jpg)、[15](15-after-evidence-unchanged-caret-zh.jpg)、[19](19-after-native-paste-evidence-zh.jpg) | 保留真实问题：光标已在24行末尾，实际输入/粘贴后的视口仍在开头；再次End未产生实际光标移动。 |
| [16](16-after-evidence-navigation-tail-zh.jpg)–[18](18-after-evidence-required-zh.jpg) | 首次后测需先Home再End才能到尾段，以及短文/必填事实；不冒充直接粘贴成功。 |
| [20](20-final-composer-nine-lines-en.jpg)、[21](21-final-composer-paste-tail-en.jpg) | 最终主Composer九行完整，24行实际粘贴直接呈现末尾。 |
| [22](22-final-prefilled-objective-en.jpg)、[23](23-final-objective-native-paste-tail-en.jpg) | 最终Home目标预填与直接粘贴，9行高度正确、24行尾段立即可见。 |
| [24](24-final-objective-shrunk-en.jpg)–[26](26-final-guide-draft-budget-en.jpg) | 最终目标缩短、英文必填、指南往返保留草稿与12轮草稿预算/焦点。 |
| [27](27-final-reader-pan-width-change-en.jpg) | 主输入框主动回看开头，打开Explorer后宽726→500，保留scrollTop0与selection695。 |
| [28](28-final-manual-mission-nine-en.jpg)、[29](29-final-manual-mission-paste-tail-en.jpg) | 手动Mission未提交草稿，保留原16行上限，九行完整/粘贴尾段及固定取消动作。 |
| [30](30-final-evidence-expanded-zh.jpg)、[31](31-final-evidence-native-paste-tail-zh.jpg)、[32](32-final-middle-edit-preserves-view-zh.jpg) | 中文依据八行完整，24行直接粘贴尾段、非末尾实际单字编辑保持开头附近的视口。 |
| [33](33-final-evidence-shrunk-zh.jpg)–[36](36-final-original-paused-goal-retained-zh.jpg) | 最终短依据、中文必填、指南返回和正常取消；原Goal暂停状态/用量保留。 |

[手动操作](actions.csv)与[非敏感资格](verification.json)不是UI自动化测试或夹具。36张实际JPEG由本人逐张查看；只读DOM（Document Object Model，文档对象模型）尺寸/光标观察用于解释截图，不作自动化UI断言，也不替代视觉证据。没有新增/运行UI自动化。

三阶段都是实际CLI开发服务`/ui/`，first before/after/final各0个Provider请求，final另行首次声明同一原绝对截止，未提高live额度或延长截止。原native均exit0、shutdown200、物理/输出/请求结清，6配对副本退休；全部旧数据、100项目文件/Git、229附件、源DB、原认证/完整模型目录保护资格通过。两个原Goal最终公共投影与before完全相同；仅编辑明确不提交的目标/依据/Mission材料。

边界：当前实页均border-box；content-box没有构造额外样式验收。另一些共享写入面仅做调用链审计，完整IME组合输入未验收。此次没有模型执行、Goal完成判断、Mission创建、schema升级或版本发布。首次后测失败截图与最终直接粘贴通过截图同时保留。
