# 343 错误诊断复制的键盘与单击交互

## Recall

持续自主体验和修复，最新明确仅单agent。342是实际progress，已正常推送a887ef7d550e7842d5518a7ef9214a0f48dd5058，开始git status干净。上一轮完成真实错误摘要/详情与导入修复，复制只看到Copied反馈，内容核验未完成。本轮补查复制交互，并寻找侧栏真实错误；105份现有canonical-current-conversations.json摘要未找到有parent_id且有Message.error的合格记录，这只能说明该证据集合，不能证明产品没有子会话错误。不会重新委托或伪造子会话。

## 已读与根因/影响

重读342 Recall/最终验收，搜索CardErrorReasonIndicator全部调用、writeClipboard/writeDebugClipboard、clipboard.readText/writeText定义与调用、host-transport-runtime、tauri-transport、共享Button/Tooltip以及中英文文案。当前错误图标用原生button，但onClick仅stopPropagation，复制绑定onDblClick。因此鼠标单击和键盘Enter/Space均不能完成复制，aria-label只有“错误详情”，也没有表达操作。旧实现只有双击提示，没有原生按钮激活契约。

W3C ARIA Authoring Practices Guide（无障碍富互联网应用编写指南）的Button Pattern明确原生按钮交互的Enter/Space激活与可辨识名称：https://www.w3.org/WAI/ARIA/apg/patterns/button/ 。使用现有原生Button onClick即可支持这些操作，不另加键盘模拟或双协议路径。

同时修正342结论依据：getHostTransport是公共facade；实际browser分支调用navigator.clipboard.writeText，desktop分支才是Tauri native clipboard。仅凭.native方法名判断“Host native与浏览器虚拟读回不对应”证据不足。复制反馈证明write Promise fulfilled，旧读回原因仍未知；不能把这条观测包装成复制内容通过，也不能判定产品复制失败。

影响为所有使用共享CardErrorReasonIndicator的Main/child/header诊断操作。消息数据、Provider流、重试、Task/Mission/Session调度与终态不改；不存在本轮新调度异常。每次复制仍使用同一reason/details来源，不改剪贴板传输协议。共享clipboard.ts已有copyText，移除本组件一次性boolean包装和debug专用入口调用，复用通用写入函数。没有UI自动测试。

## 实施与验收

先用真实341失败会话正式导入独立before服务18320/ui，当前main-DrobkXyT.js；人工定位错误按钮，验证Enter与普通点击的实际反馈并截图。随后把复制绑定唯一onClick，删除onDblClick，文案与aria-label改为“复制错误详情/Copy error details”。沿用当前反馈状态与计时，不新增自定义键盘事件。

本轮是UI改动，进行overlay类型、i18n检查、build、当前docs检查，不添加/运行UI自动测试。用全新after服务与最终bundle人工检查单击、Enter、Space、焦点及完整错误详情，保存真实截图。可在本轮未发送的输入框通过真实粘贴检查复制正文；如果浏览器读回/粘贴仍不能证明系统剪贴板事实，则保留未验证范围，不通过注入API或伪造内容制造成功。

每个实例固定600000ms，正式9消息/21 Parts导入，保持源库/错误身份，0 Provider请求，不复制auth/models；每次启动原句柄必须join，关闭本轮页面与owned进程，按出生归档本轮native pile。before/after日志及任何失败保留。最后规格索引同步、精确commit、fresh fetch/merge、pending集合检查与正常push；goal保持active。

## 首次after真实观察与补充

真实页面129在main-NPcVG69U.js中，预先写入本轮owned clipboard marker后，对“Copy error details”按钮按Enter，实际clipboard读回261字符，恰为摘要、空行与原始过载JSON。这是本轮真实动作产生的复制结果，未向模型发送消息；342旧读回差异的具体原因仍未知。

截图03发现键盘激活后Tooltip关闭，尽管写入成功，按钮没有可见成功反馈。补充在同一现有copyFeedback状态下切换原生按钮图标为check、可访问名称为“Copied/已复制”，使用现有good色；失败名称使用当前copy_failed。1400ms后还原，不另建反馈状态/计时器或自定义键盘处理。当前after实例维持原600000ms预算，构建后只刷新本轮自建页面，最终截图重新验证。

## 最终验收

before92775/页面128实际Enter和单击只保持错误，after68863/页面129最终main-DE9lj1nS.js实际200；Enter、Space、单击均返回真实261字符剪贴板全文，绿色check和可访问名称反馈人工确认，Ctrl+V未发送输入框实际粘贴后清空。原9消息/21 Parts、0Provider；两实例实际join0与完整Native/Host结算91487/304909ms，页面关闭，pile按出生归档。types/i18n/final build通过；没有运行UI自动测试。独立child Dock和Tauri仍未验，不重新制造过载。详细证据见error-copy-343/README.md。
