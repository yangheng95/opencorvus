# 主输入区关闭模型选择器时重置搜索

## Recall

- 用户要求本人独立持续迭代。先记录真实复现、根因、影响和验收范围，再实现、桌面操作与截图复核、聚焦验证、范围提交、合并与正常推送。上一批 [同名模型标识](2026-11-25-composer-identifies-same-name-models.md) 已推送到 `620ad94c1`，远端一致，原 177 项无关工作区状态保留。
- 已读[现行界面架构](../../current/architecture/07-panel.md)、[选择器目录读取状态](2026-11-10-composer-model-catalog-read-state.md)、[现行多词搜索](2026-11-01-multi-term-metadata-search.md)、`ComposerModelSelector`、`ChatComposer` 的唯一挂载、`useDisclosure`、Kobalte `Popover` 受控开关、`SearchField`、`selectComposerModel` 及其配置持久测试。全仓核对搜索输入标识、查询 setter、关闭和选取调用点、共享 `SearchField`、引用选择器及计划设置的独立查询入口。所查触及路径未找到界面自动化测试。

## 实施前证据与影响

- 自有开发页 `41810/ui/` 加载 `main-OX9uttUk.js`。只装载上批自有项目的 `model-identity-fixture` 回环目录及同一真实空会话。三条模型正常出现。输入 `review-fast`，两次 Tab 从搜索框经清空按钮到选项，Enter 选择后重开，旧查询仍处于焦点，屏幕只显示选中的一条。鼠标从 `review-long` 搜索结果选择后同样复现。带着该查询进入 `Configure Provider…`，用 `Back to app` 返回再重开，仍只显示一条。反复点击模型按钮关闭和重开作为对照，搜索为空，原三条模型齐全。[基线实拍](../../artifacts/2026-11-25-composer-clears-search-on-close/README.md)
- 公开会话配置读取从 `model-identity-fixture/draft-quick` 变为 `model-identity-fixture/review-long`，回执分别为 `f224b8c0-a3dd-481f-a132-df0d80a2ae06` 和 `d37d1aa4-1b8a-43ed-8ab1-d01c34f6e0ed`。真实会话消息为 0。故障影响下一次寻找并比较模型，用户可能把过滤结果误作完整目录。实际选择写入和项目范围正确。
- 搜索值由选择器组件持有，弹窗退出不卸载该组件。受控 `Popover` 的 `onOpenChange` 代表组件原件发起的开关请求。上次查询只在此回调和会话范围变化的 effect 中显式清空。`pickModel` 和 `configureProvider` 直接调用局部 `close()`，改变受控属性，Kobalte 不会对属性回读再发出回调，因此只清理了既有目录重试状态。直接清空输入会修复当前可见结果，下一次程序关闭仍会残留。
- 共用机制是此选择器的局部关闭函数。`SearchField` 保持受控输入，文本匹配、配置保存、重试读取状态、焦点策略、其他选择器自己的查询持有者、后端路由、数据格式和执行时序均无需改动。当前表现与调度、队列、执行轮次或终态收敛无关。

## 实施与验收

- 在 `close()` 统一清空搜索。现有用户关闭、键盘或鼠标选取、跳设置和范围变化均走同一个局部关闭函数，删除旧的分散清空调用。保持原提供方目录刷新及模型变更流程。
- 候选用同一实际开发页依次覆盖 Tab 与 Enter 选择、鼠标选择、带筛选进服务商设置并返回、按钮关闭和重开。每次重开核对空查询、获得焦点、三条列表和当前所选项，人工复核关键截图，正式回读精确模型配置及消息列表。运行原聚焦模型配置、搜索和作用域检查、类型、构建及文档检查。本批无需真实模型推理或凭据。

## 验收结果

- 同一隔离服务的 `/ui/` 实际加载 `main-DWDPd9CT.js`。在 1280 × 720 英文桌面分别操作键盘选取 `review-fast`、鼠标选取 `review-long`、带查询跳服务商设置并返回、点击模型按钮关闭。四次重开均置焦于空的搜索框，显示所有三条模型，并保留正确的选中项。人工复核四张对应截图。[候选截图](../../artifacts/2026-11-25-composer-clears-search-on-close/README.md)
- 公开会话配置依次确认 `model-identity-fixture/review-fast` 与 `model-identity-fixture/review-long`，回执 `35e2458e-f094-49a3-9e26-9ce11cb163c7` 和 `0f034e5e-b259-4152-8a90-0bcaba1e447e`。会话消息和回环模型请求均为 0；没有发送推理请求或使用提供方凭据。[实际回执](../../artifacts/2026-11-25-composer-clears-search-on-close/README.md)
- 模型投影、文本搜索、服务商作用域及会话初始配置共 24 项测试、60 条断言通过。类型、实际页面构建、渲染器公共接口及文档检查通过。构建保留既有的分包大小提示。范围变化的路径按原调用点审查，此批桌面复核为上述四条关闭路径。
