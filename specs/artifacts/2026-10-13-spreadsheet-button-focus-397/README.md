# 397 表格语义按钮键盘焦点证据

对应[397规格](../../records/2026-10/2026-10-13-spreadsheet-button-focus-397.md)。Root在自己的无凭据397-after页面tab38实际交互并人工查看本目录全部17张截图；audit_ui只按授权清单归档、核对文件字节及链接。没有UI自动化、模型执行或内部命令注入。既有真实Desk budget仍为原发布产物，不能把本批视图编辑解释为持久化修改。

[最终人工记录](observations/final-review.json)是Root对真实动作的明确摘要，[全部文件清单](archive-manifest.json)保留源路径、原字节数和归档方式。归档没有重跑[历史检查脚本](implementation/final-review.mjs)，因此原review时间和记录未被重写。

## 普通视图键盘与动作结果

| 路径 | 实际证据与限定结论 |
| --- | --- |
| Tab到Add后Enter | [真正按钮焦点](screenshots/add-real-tab-focused.jpg)、[焦点记录](observations/add-real-tab-focused.json)、[进入Detail](screenshots/add-enter-detail.jpg)、[后几何](observations/add-enter-detail.json)。原生BUTTON保有焦点，Enter真正打开Detail；Chat scrollTop前后均724.6666870117188。 |
| 中文Add的Space激活 | [聚焦AX](observations/add-space-tab-focused-ax.txt)、[中文Detail](screenshots/add-space-detail.jpg)、[结果AX](observations/add-space-detail-ax.txt)。真实Tab后Space打开详情。 |
| 范围Dialog | [Add range焦点](observations/range-add-tab-focused-ax.txt)、[Confirm焦点](screenshots/range-confirm-tab-focused.jpg)、[Space确认](screenshots/range-space-confirm-overlap.jpg)、[checker AX](observations/range-space-confirm-overlap-ax.txt)。原生Tab/Enter增加第二范围，Tab/Space把A1:A2及A2:A3交给原checker，显示Range cannot overlap。 |
| 同实例语言与未保存取消 | [中文重叠错误](screenshots/zh-overlap-preserved.jpg)、[中文AX](observations/zh-overlap-preserved-ax.txt)、[主Cancel焦点](observations/main-cancel-tab-focused-ax.txt)、[Space取消](observations/main-cancel-space-closed-ax.txt)。标题/错误切换，范围及临时详情保持，再取消未保存详情。 |
| 合法规则确认与清理 | [Confirm焦点](observations/permission-confirm-focused-ax.txt)、[Enter创建](screenshots/permission-enter-created.jpg)、[规则可见](screenshots/permission-created-visible.jpg)、[真实结果AX](observations/permission-enter-created-ax.txt)。A1、FOCUS-397 temporary真实创建本地规则并返回List；随后只删除该规则，[正向空态](observations/temporary-rule-cleaned-ax.txt)确认清理。 |
| 百分比菜单 | [Tab焦点](screenshots/zoom-tab-focused.jpg)、[焦点记录](observations/zoom-tab-focused.json)、[Enter展开](screenshots/zoom-enter-menu.jpg)、[展开AX](observations/zoom-enter-menu-ax.txt)。先鼠标减号100→90，再经真实Tab到90%按钮并Enter展开。两次Down后Return实际选择75，随后点击真实100菜单项恢复原缩放，不能把中间75写成100。 |
| 工作表菜单 | [实际Tab焦点](screenshots/sheet-menu-real-tab-focused.jpg)、[焦点JSON](observations/sheet-menu-real-tab-focused.json)、[Enter菜单](screenshots/sheet-menu-enter-open.jpg)、[菜单AX](observations/sheet-menu-enter-open-ax.txt)。先以定位器press聚焦append，真实Tab移到SheetBarMenu，再Enter展开清单。此入口与下列初次失败严格分开。 |
| 新增临时工作表 | [Shift+Tab焦点](observations/sheet-add-shift-tab-focused-ax.txt)、[Space新增](screenshots/sheet-add-space-created.jpg)、[新增AX](observations/sheet-add-space-created-ax.txt)。实际创建工作表1；仅该新空表通过可见context/Delete确认及Tab/Enter移除，[清理AX](observations/temporary-sheet-cleaned-ax.txt)记录原清单仍选中。未覆盖多表溢出左右翻页。 |
| 业务命令显式回焦 | 实际A2 context Copy后，[焦点](observations/context-copy-return-focus.json)/[AX](observations/context-copy-return-focus-ax.txt)为DOCS_NORMAL，[Down后A3](observations/context-copy-navigation-A3-ax.txt)证明原编辑导航仍有效。随后双击B2、Ctrl+A、paste9、Return得到[9/5/14](screenshots/context-return-edit-9-5-14.jpg)及[编辑AX](observations/context-return-edit-9-5-14-ax.txt)。这验证了当前可见命令路径，不代表所有toolbar命令。 |

## 全屏、颜色Dialog和保留失败

[全屏Add焦点](observations/fullscreen-add-tab-focused-ax.txt)、[Space打开中文Detail](screenshots/fullscreen-add-space-detail.jpg)和[结果AX](observations/fullscreen-add-space-detail-ax.txt)证实同类按钮在全屏正常激活。范围Dialog实际Tab到Cancel、Enter关闭，见[焦点](observations/fullscreen-range-cancel-focused-ax.txt)及[关闭结果](observations/fullscreen-range-cancel-enter-ax.txt)，B3保持。主详情通过Tab/Space取消，没有保存全屏规则；该scope观察到已编辑9/5/14，不宣称卸载后编辑持久化。

[颜色Dialog Cancel焦点](screenshots/color-cancel-tab-focused.jpg)及[对应AX](observations/color-cancel-tab-focused-ax.txt)来自真正More colors点击后四次原生Tab。Space确实取消Dialog，但[结果AX](observations/color-space-cancel-ax.txt)显示焦点回BODY；[下一次Escape](observations/color-first-escape-ax.txt)同时关闭可见context和颜色菜单。因此这里只确认原生Cancel可激活，**没有认证逐层Escape或返回More Colors焦点**。

[sheet-menu-tab-focused.jpg](screenshots/sheet-menu-tab-focused.jpg)保留初次失败：从BODY执行Escape后Shift+Tab/Tab没有到达目标；它不是成功焦点证据。真正成功来自后续单独命名的sheet-menu-real-tab-focused和真实Tab记录，不能因原文件名含focused就追认为成功。

仍未完成的独立边界：More Colors无href及BODY返回、中文范围/删除Dialog的英文Close无障碍名称、规则卡片hover对比度。多表溢出翻页、独立Docs、移动端、完整输入法和全部工具条命令没有本批实页覆盖；不把397的两个类别修改扩大为这些能力全部通过。

## 实际下载和原字节

[实际CSV](downloads/edited-normal.csv.gz)解压仍为61字节，[原下载记录](observations/csv-download.json)与[Root已完成字节检查](observations/csv-byte-review.json)对应Notebook=9、Pen=5、Total=14。原文件为UTF-8字节序标记、三处CRLF、末行无换行。gzip用于保留已下载文件的准确字节；归档核对还原值与源字节，不使用hash作为功能验收。

## 实施与构建记录

[实施脚本](implementation/apply-vendor.mjs)、[四数组清单](implementation/vendor-files.json)、[独立复核](implementation/independent-review.json)和[最终13段patch](implementation/ui-final.patch.gz)保留精确两种按钮类别移除。剩余三类容器/canvas代理、显式业务回焦及389/392原实现保持；未保存whole vendor或构建资产。

[patch prepare](logs/patch-prepare.log.gz)、[patch commit](logs/patch-commit.log.gz)、[首次install](logs/install.log.gz)均正常结束，但独立review发现生成patch多了空Bun缓存文件段。[含空段的中间patch](implementation/ui-rejected-empty-cache.patch.gz)仅作为被拒绝的范围证据保存，不能作为最终修复；Root精确清理3行后[最终frozen install](logs/install-final.log.gz)成功，最终13段已经独立确认。这里是产物范围纠正，未虚构Bun命令失败。

[typecheck](logs/typecheck.log.gz)的Root进程68786和[private build](logs/build.log.gz)的Root进程11707均exit0，build55.18s；[方案文档检查](logs/docs-plan.log.gz)保存原输出。类型/构建不代替上述真实交互和截图；最终共享文档检查由Root提交前执行。

## 物理收尾

[owner](logs/final/owner.json.gz)、[ready](logs/final/ready.json.gz)、[terminal](logs/final/terminal.json.gz)、[stdout](logs/final/stdout.log.gz)、[stderr](logs/final/stderr.log.gz)只来自自有397-after scope。owner PID19968，occurrence `bb4a7ac4-8027-4169-9fd5-4eaaed037d12`，launcher92591实际join exit0；elapsed1000903ms，在原1200000ms期限内正常关闭，没有延长或模型调用。

[页面关闭记录](observations/page-closed.json)记tab38 closeToolFulfilled=true，2026-10-13T15:18:16.300Z记录关闭确认；英语恢复、临时规则/空表清理、全屏未保存详情取消均已完成。[最终英文AX](observations/final-en-ax.txt)保留最终页面状态。不得据此推断其它用户窗口或服务状态。

## 允许清单与归档检查

[manifest](archive-manifest.json)列出76个源文件：17张JPEG、40个观察文件、4个实施/复核记录、7个构建安装日志、2份patch、1份CSV、5个自有scope记录。另有本README、manifest本身和[归档检查](archive-check.json)，共79文件。15个gzip逐一解压恢复原字节，17张JPEG也原字节复制，无图像编辑。

安全检查只覆盖这些文本、解压后日志/patch/CSV及本规格的有限凭据模式与局部链接；不是普遍保密证明或产品测试。没有读取/复制auth、models、数据库、环境目录、完整vendor或ui-build。完整截图由Root真实页面人工复核，归档检查不以截图差异替代视觉判断。
