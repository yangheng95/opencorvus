# 窄桌面用量活动图实页证据

当前开发服务使用独立 Git（版本控制）项目及空用量账本。截图由桌面浏览器实页取得，并已逐张人工查看。用量周期来自真实服务，不设置浏览器时区，不拦截请求。基线入口 40520，资源 `main-Cv3SctBD.js`。

| 原图 | 实际观察 |
| --- | --- |
| [01 正常侧栏下的 1024×768 年度图](01-baseline-en-year-1024.jpg) | 216 像素设置栏能显示全年和刷新 |
| [02 最大侧栏后的裁切](02-baseline-en-year-wide-sidebar.jpg) | End 将侧栏扩至 444。当前周期和刷新在活动标题行右缘被裁 |
| [03 年度末尾仍裁切](03-baseline-en-year-tail-clipped.jpg) | 向下滚动实页后确认月份轴只显示到九月开头，年末图形不可见 |
| [04 本月末日落入第二行](04-baseline-en-month-wrapped-misaligned.jpg) | 十一月的第 30 格落到左下，Nov 30 刻度仍在右侧 |
| [05 第二行左格的真实日期](05-baseline-en-last-bucket-folded.jpg) | 点选左下真实格显示 Nov 30 到 Dec 1 及零令牌 |

首轮候选资源 `main-C2U1iGqm.js`。同样的 1024×768 视窗和 444 像素设置栏用于确定剩余范围。

| 原图 | 实际观察 |
| --- | --- |
| [06 完整周期与刷新入口](06-first-build-controls-visible.jpg) | 标题与四个周期、刷新均可见 |
| [07 首轮候选的键盘焦点在裁切区](07-first-build-keyboard-focus-offscreen.jpg) | End 得到年末浮层，但日期格及月份还停在年初 |
| [08 首轮候选的鼠标横滚](08-first-build-mouse-scroll-end.jpg) | 实际滚动到最右，末格的焦点环及十二月都进入同一内容区 |

最终候选入口 40522，资源 `main-jM2QDImN.js` 与 `UsagePanel-92vuZAsZ.js`。

| 原图 | 实际观察 |
| --- | --- |
| [09 英文年度 End](09-final-en-year-end.jpg) | 12 月 31 日格、浮层、十二月和右侧滚动位置同时可见 |
| [10 英文年度 Home](10-final-en-year-home.jpg) | 回到 1 月 1 日，左侧月份和焦点可见。途中 Left 聚焦 12 月 24 日 |
| [11 拖动原生滚动条](11-final-en-scrollbar-december.jpg) | 日期格和月份一起到右端，周期与图例在原位 |
| [12 直接点击十二月首日](12-final-en-december-axis-bucket.jpg) | 十二月起点的星期二格显示 Dec 1 至 Dec 2 |
| [13 英文本月末格](13-final-en-month-one-row.jpg) | 一行保留真实时间序，Nov 30 仍对应最右日期格 |
| [14 简中年度 End](14-final-zh-year-end.jpg) | 12 月 31 日焦点环、翌年日期及十二月刻度可见 |
| [15 简中本月末格](15-final-zh-month-one-row.jpg) | 11 月 30 日到 12 月 1 日的实际末格位于一行最右 |
| [16 简中今日末小时](16-final-zh-day-last-hour.jpg) | 23:00 至翌日 00:00，所选末格与 23:00 刻度对应 |
| [17 简中本周刷新](17-final-zh-week-refresh.jpg) | 七格周图、自然周日期及刷新焦点 |
| [18 默认桌面宽度](18-final-zh-default-desktop-year.jpg) | 1280×720 下显示完整年度和 12 个刻度，图例可读 |

实际 `/global/usage` 回执对应 Asia/Shanghai。在本地基线和最终候选中，接口均返回连续时间桶、0 调用／0 令牌、同样的独立官方来源状态。请求标识来自各自正式响应头。

| 周期 | 桶数 | 基线请求 | 最终候选请求 |
| --- | --- | --- | --- |
| 今日 | 24 | `b6b85c0d-a174-4e48-ae7b-351d7600e9e1` | `15fe7140-fdb1-4bf7-8446-72d4a1e0025f` |
| 本周 | 7 | `328c8446-399c-455b-aebe-af36b23ec402` | `394d85fe-6bfe-44ab-88a3-4fec1b5343c5` |
| 本月 | 30 | `9874c92d-cc64-4f96-80d8-713440b096a0` | `c5e3fbad-4169-470d-a56f-26ac64c6d843` |
| 今年 | 365 | `9a284546-c230-4e43-b522-9bba403e7f7d` | `41117ea2-f2c5-4403-9fe0-072c1bcdfb45` |
