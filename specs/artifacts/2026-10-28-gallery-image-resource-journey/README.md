# 图库图片资源实际体验证据

对应[调查与方案](../../records/2026-10/2026-10-28-gallery-image-resource-journey.md)。单代理、真实开发/ui、实际流式gpt-6.1-sol和用户附件，无UI自动化、假消息、浏览器fixture或截图基线。全部JPEG未经编辑并人工查看。

- [01](01-before-real-svg-send.jpg)：真实品牌附件和待发送请求。
- [02](02-before-persisted-svg-message.jpg)：已持久用户附件与实际“已收到”回复。
- [03](03-before-gallery-svg.jpg)：图库缩略成功。
- [04](04-before-gallery-full-image-error.jpg)：图库原全图失败。
- [05](05-after-persisted-gallery.jpg)：新构建恢复同一持久消息与图库。
- [06](06-after-gallery-full-image.jpg)：1000x1000安全全图实际显示。
- [07](07-after-gallery-fit.jpg)：50%完整图，下载仍为6426字节原SVG。
- [08](08-after-gallery-return-focus.jpg)：关闭回图库原项。
- [09](09-after-message-image.jpg)：消息内图片入口回归。
- [10](10-after-chinese-gallery.jpg)：中文图库、日期与原文件名。
- [11](11-after-chinese-full-image.jpg)：中文全图、缩放和关闭。
- [12](12-after-composer-two-images.jpg)：真实选择SVG/JPEG及草稿。
- [13](13-after-composer-svg.jpg)：输入区SVG全图回归。
- [14](14-after-jpeg-regression.jpg)：JPEG原件显示回归。
- [15](15-after-draft-and-focus.jpg)：Esc返回原项、两附件与完整草稿。

改后实例不复制认证、不再调用模型，因此照片05及后续正文明确显示“模型配置暂不可用”；不能把这个只读验收实例当作认证发送的证据。真实发送及目标模型/reader结果来自基线和runtime.json。schema始终9；memory修订与容量槽更新有正向当前契约取证。data.json明确区分真实持久附件保留和两个未发送历史拷贝的消失，后者具体删除调用尚未直接取证，进入下一批。

[运行结算](runtime.json)、[数据与原件](data.json)、[聚焦检查](checks.json)。这些数据证明各自实际对象，不能代替照片的视觉验收。整体目标继续迭代，不表示所有图片所有者/格式都已验收。
