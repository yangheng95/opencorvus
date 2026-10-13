# Bun 1.4.0 数字 matcher 观察

Windows Bun 1.4.0下独立运行以下最小代码：

```ts
import { expect } from "bun:test"
const value = { wakeAt: 1791899614779 }
expect(value).toMatchObject({ wakeAt: expect.any(Number) })
console.log(typeof value.wakeAt, value.wakeAt)
expect(value.wakeAt).toBeGreaterThanOrEqual(1791899614776)
```

实际输出`object Any<Number>`，随后数值比较抛出`Expected and actual values must be numbers or bigints`。主agent和独立agent分别复现了同一行为。此前terminal-owner测试记录的原wakeAt、now和heartbeat均为正确有限数字；错误发生在读取已被matcher改变的测试对象时。

修复仅在匹配前保存原始wakeAt，再验证原数值落在现有30秒heartbeat区间；保留完整正向waiting与最终settlement/delivery合同。不更改产品定时器、不放宽边界、不更换宿主版本。初始失败与修后结果分别保存在对应聚焦日志。
