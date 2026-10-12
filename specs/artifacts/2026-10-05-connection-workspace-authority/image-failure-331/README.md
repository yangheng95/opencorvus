# 331 图片失败说明和恢复

对应[Recall 与根因分析](../image-failure-plan-331.md)。root 独立开发和验收，普通 Work/Chat 只读正常 PNG 后结束，不派发其他成员；随后只在本轮自己的项目输入上模拟图片失效。

## 真实问题

正常 read 已产生 Source `prt_g0VXnQ6o6000xeuxGHQn`。保管自己的原 PNG 后，在原路径写入明确的普通文本；file/content 返回200与 image/png/base64，但实际字节不是图片，[后端响应](failed-image-response.json)保留原文。

[原缩略图](screenshots/01-broken-thumbnail-before.png)和[原全屏](screenshots/02-broken-full-before.png)只显示破图符号。浏览器实际 complete=true、固有尺寸0×0，布局尺寸131×20，见[只读观察](broken-image-observation.json)。宿主用 naturalWidth || width，可能把布局宽度当作图片尺寸，继续提供100%和缩放；[原复制提示](screenshots/03-broken-copy-before.png)显示“clipboard blocked”，没有说明图片已经解码失败。不能凭这个提示断定剪贴板本身的根因。

浏览器 complete 在损坏图片时也可能为真，原生 error 和固有尺寸需要单独处理，参考[MDN complete](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/complete)及[HTMLImageElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement)。本轮根因以实际画面、原生状态和代码共同确认。

## 修改

共享 PreviewableImage 接收当前图片的真实 error/load，用当前 src 关联紧凑失败说明，保持打开全屏的动作；当前调用方的 imageAttributes 只提供元数据，没有既有自定义加载处理被替换。共享全屏宿主只用正的固有尺寸判定图片可用，显示通用 Feedback 与原资源错误详情。失败时缩放/适应尺寸/平移不再操作假尺寸，复制先报告“图片不可用”；保留关闭及已有字节下载。源变化和成功加载恢复原有预览功能。

生产改动为 ImagePreview.tsx、现有 messages.css 的局部样式、中英文三组新文案；07-panel架构同步。没有新接口、备用图片、自动重试、缓存、第二图片加载器或第二预览器。消息附件、Composer、浏览器证据、截图和文件面板继续调用同一个组件，全屏 Markdown 入口继续使用同一宿主。

## 人工视觉验收

正常开发 `/ui`18302，当前构建 `main-Dj0Uk9_u.js`，只刷新自己创建的109页面，原Native进程和固定边界保持。

- [04 缩略图失败](screenshots/04-broken-thumbnail-after.png)：清楚显示无法显示图片，仍能打开预览。
- [05 全屏失败](screenshots/05-broken-full-after.png)：居中错误说明与重新加载指引；操作菜单中适应宽度/图片/原始尺寸实际禁用。
- [06 复制](screenshots/06-copy-error-after.png)：同一失败图的真实复制动作显示“Copy failed: image unavailable”。
- [07 中文缩略图](screenshots/07-failure-chinese.png)、[08 中文全屏](screenshots/08-full-failure-chinese.png)：通过隔离页面的设置切换中文后亲自查看提示。
- [09 恢复](screenshots/09-image-restored.png)：恢复原PNG字节后在原文件面板点击从磁盘重新加载，原错误清除、蓝色鸟图标恢复。
- [10 恢复后缩放](screenshots/10-restored-full-zoom.png)：重新打开全屏并实际100%→125%，正常控件恢复。
- [11 原偏好恢复](screenshots/11-language-restored.png)：页面语言恢复English，主题仍System，随后关闭自己的页面。

11张截图全部人工查看。没有浏览器夹具、UI（User Interface，用户界面）自动化、组件/DOM（Document Object Model，文档对象模型）断言或像素比较。本轮实际覆盖文件来源的无效数据地址、正常PNG恢复和共享全屏操作；没有逐一进入全部消费者，也没有把此场景当作网络资源错误、极大图片、所有格式或所有切换竞争的完整验收。原生尺寸观察只辅助解释图片，不替代截图。

## 数据与收敛

正常会话 `ses_-zUSCZvNbzzIfW1Srzyr` 的原Source和模型结果保留；5次实际 gpt-6.1-sol 流式请求都以EOF（End Of File，流结束）结束。模型只读取最初正常图片，失效输入在模型结束后才用于真实界面读取，未让模型处理损坏图片。[后端正向核对](actual-backend-verification.json)验证原Source、真实失败响应、22168字节原图恢复和失败输入保管。

输入单文件操作先核对精确绝对边界，原PNG通过Move保管，普通文本再移入quarantine/failed-input.txt，原PNG移回原路径；没有删除用户文件或重新生成图像。[保管](input-preserved.json)/[恢复](input-restored.json)可核对。

类型句柄8062、构建48261实际退出0，构建52.78秒；目录结构检查通过2语言/2127键。它只检查目录键、值类型和占位参数，不测试源码文案或界面行为。原启动句柄65956实际退出0，Native75928/Host73172/18302/输出/请求与复制auth/models成对清理，见[物理终态](live-01/image-failure-331-live-01-physical-terminal-and-pair-cleanup.json)。Native于02:00:25Z正常结束，早于出生起600000ms固定上限，未续租。

周期收据、HTTP（Hypertext Transfer Protocol，超文本传输协议）摘要、运行日志与Provider审计完整压缩，私有原件保留。文档与正常提交/推送钩子检查各自范围，goal保持active。
