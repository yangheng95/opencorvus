# 代理保存的焦点与草稿证据

基线与改后均通过真实开发服务的桌面页面操作，网络未被人为延迟。每张截图均经本人查看。

| 图 | 真实页面观察 |
| --- | --- |
| [01](01-before-focus-on-proxy-save.jpg) | 基线焦点在下方代理 Save |
| [02](02-before-keyboard-save-leaves-focus-on-web-area.jpg) | 基线保存成功，但焦点掉到网页 |
| [03](03-before-receipt-after-rapid-new-draft.jpg) | 实际忙态输入的 31303 被回执覆盖 |
| [04](04-after-keyboard-focus-before-save.jpg) | 改后同一键盘起点 |
| [05](05-after-save-focus-survives-repeated-enter.jpg) | 忙态重复按键后，仅一次提交且焦点留在 Saved |
| [06](06-after-older-write-preserves-newer-focused-draft.jpg) | 31303 保留，页面说明较新值未保存 |
| [07](07-after-same-newer-draft-notice-in-chinese.jpg) | 中文保留同一回执与 31303 |
| [08](08-after-explicit-newer-draft-saves-with-focus.jpg) | 再次显式保存后 31303 确认，焦点保留 |
| [09](09-after-reopening-panel-adopts-confirmed-configuration.jpg) | 重开读取最后确认值 |

[基线](before-observed.json)与[改后](after-observed.json)保留真实焦点、忙态和输入观察。[真实请求检查器](check-proxy-draft-tcp.mjs)按在线契约核对[基线](before-settled-tcp.json)、[首次保存](after-first-tcp.json)、[较旧保存结算](after-older-tcp.json)和[明确保存较新值](after-newer-tcp.json)。[持久核对脚本](audit-owned-proxy-draft.py)读取实际服务器请求及隔离数据，[结果](owned-final-check.json)与[原项目](seed.json)已归档。[39125](before-startup.json)和[39126](after-startup.json)正常退出。
