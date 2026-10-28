# 历史消息阅读、PDF焦点与归档实际证据

对应[根因与方案](../../records/2026-10/2026-10-29-message-reader-journey.md)。单代理，真实开发/ui、真实持久消息/原件，1280×720桌面。32张JPEG均为未经编辑的页面原图，逐张人工查看；无UI自动化、假消息或截图断言。

- [01](01-home.jpg)：本轮真实首页。
- [02](02-history-at-end.jpg)、[03](03-history-inline-pdf.jpg)、[04](04-baseline-second-page.jpg)：原PDF默认整页展开、缺可见原名、正文/回复被挤开；读取/翻页本身成功。
- [05](05-after-compact-history.jpg)、[06](06-after-expanded-pdf.jpg)、[07](07-keyboard-space-collapsed.jpg)：首改原名折叠、按需阅读与原生Space收起。
- [08](08-second-page-focus-loss.jpg)：中间实际发现的末页Next失焦，尚未修复边界控件。
- [09](09-final-compact-history.jpg)：最终PDF实现的默认紧凑呈现。
- [10](10-final-last-page-focus-retained.jpg)、[11](11-final-first-page-focus-retained.jpg)：真实键盘达到首末页，当前按钮焦点保持，Tab继续。
- [12](12-final-minimum-zoom-focus.jpg)、[13](13-final-maximum-zoom-focus.jpg)：50%/250%边界和再次Enter后的真实合法值与焦点。
- [14](14-final-original-download.jpg)：首次AX下载点击仅获得焦点，未达成下载；成功文件事件见27和data.json。
- [15](15-final-chinese-compact.jpg)、[16](16-final-chinese-keyboard-last-page.jpg)、[17](17-final-contained-pdf-reading.jpg)、[18](18-final-chinese-collapsed-focus.jpg)：中文键盘展开/收起/末页、真实内部滚动和返回原summary。
- [19](19-final-jpeg-preview.jpg)：同条消息JPEG全图/Esc返回原项。
- [20](20-final-composer-full-reader.jpg)、[21](21-final-composer-last-page-focus.jpg)：真实filechooser新上传PDF，输入区仍直接显示完整Dialog，末页焦点及Esc回原项通过；临时项已用正常移除操作清退。
- [22](22-final-conversation-menu.jpg)、[23](23-final-find-original-messages.jpg)、[24](24-final-find-return-original.jpg)：查找2条原始消息，返回原文和紧凑附件。
- [25](25-final-archived-isolated-conversation.jpg)、[26](26-final-archive-restoration-entry.jpg)、[27](27-final-restored-download.jpg)：实际归档/恢复隔离Work，原附件仍可读，浏览器download事件取得111015字节PDF原件。26仍为旧归档说明，后续已修。
- [28](28-publication-english-archive.jpg)、[29](29-publication-chinese-archive.jpg)：最后新构建的中英文归档说明和空态，统一对话概念。
- [30](30-publication-compact-history.jpg)、[31](31-publication-last-page-focus.jpg)、[32](32-publication-return-to-conversation.jpg)：包含最新文案/未发布日志的最后构建，重验同一原始PDF、末页焦点和Space回原文。

[数据与真实归档请求](data.json)、[原生/模型结算](runtime.json)、[聚焦辅助检查](checks.json)。所有实例Provider上限及实际调用0，累计767保持，未复制认证；schema9保持。原26条新增记录是本次实际归档/恢复的总线事件、成功交付/阶段回执和已释放租约；唯一旧行变更是该session更新时间。源库和所有原消息/附件内容保持。没有操作用户18571、永久删除、发布或创建tag。

边界：本批未覆盖外部跨域PDF、所有Artifact/工作台消费者、长文件名真实新样本及所有非桌面尺寸。前三组实页证明各自阶段，最后28–32证明当前交付构建；检查器分数不代替这些视觉结果。
