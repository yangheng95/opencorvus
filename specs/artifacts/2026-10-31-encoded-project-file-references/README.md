# 编码项目文件引用实际验收

对应[实施前方案与Recall](../../records/2026-10/2026-10-31-encoded-project-file-references.md)。只收录自有输入、实际UI截图与脱敏结果，不收录完整配置、数据库、模型目录或凭据。

修复两个本地文件URI入口：模型/文档的项目文件链接与文档相对图片，均只做一次组件解码。真实文件名中的中文、空格、`# & +`正常还原；字面`%23`保持原名，行范围在解码前解析，后端继续按精确文件名读取。

四份自有输入：[复核文本](input/%E5%A4%8D%E6%A0%B8%20%231%20%26%20plan%2B.txt)、[字面百分号对照](input/%E7%99%BE%E5%88%86%E5%8F%B7%2523.txt)、[文档](input/overview.md)、[原图](input/%E5%9B%BE%20%231%20%26%20plan%2B.png)。模型实际read两文本，未读图或改文件；原图只供实际页面预览，图内旧指令未执行。

| 实图 | 实际查看的对象 |
| --- | --- |
| [01](01-before-real-preflight.jpg) | 精确模型及真实预检 |
| [02](02-before-real-read-and-links.jpg) | 自然读取结果与模型原文链接 |
| [03](03-before-encoded-link-error.jpg) | 真实正文点击的404/错误文件名/请求ID |
| [04](04-before-source-original-works.jpg) | 同一原件经Sources正常打开 |
| [05](05-before-encoded-image-error.jpg) | 实际相对图片请求的404及详情 |
| [06](06-before-literal-percent-control.jpg) | 基线字面百分号原件对照 |
| [07](07-after-original-model-link.jpg) | 相同原始模型链接正确打开原件 |
| [08](08-after-document-image-preview.jpg) | 原文档及原图片成功预览 |
| [09](09-after-line-range.jpg) | 实际选中原文件第2–3行 |
| [10](10-after-literal-percent-control.jpg) | 字面百分号保持原名/原内容 |
| [11](11-after-chinese-model-link.jpg) | 中文界面同一模型链接 |
| [12](12-after-chinese-document-preview.jpg) | 中文文档预览与原图 |

十二张真实native开发`/ui`截图均亲自查看，未新增或运行UI自动化。候选复用原六自然消息、0新模型请求；整批六次gpt-6.1-sol请求均流式200/EOF，累计1158。普通Overlay构建、类型和语言检查通过。

[脱敏验证回执](verification.json)区分真实UI失败请求与辅助公开API检查，包含前后原文件路径/字节、行范围、消息、数据及物理结清。schema9/92表、原业务字段、123附件、四输入及原文件/Git保持；自有页面/进程与配对副本已结清。Project内Sources沿现合同进入项目编辑器，未改为附件的只读语义；全部输入始终未被修改。
