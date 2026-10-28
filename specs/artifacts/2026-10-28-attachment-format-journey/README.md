# PDF 与 SVG 附件实页

[Recall、根因与未完成项](../../records/2026-10/2026-10-28-attachment-format-journey.md)。本批766保持整体Goal active；当前实证范围为输入区与有MIME的FilePart，截图图库的SVG MIME投影缺口仍待下一批修复，不能称所有SVG路径完成。

PDF原件有效但旧iframe稳定空白，且固定520px把关闭页脚挤出初始可视区；现复用按需加载的PdfPreview和当前局部frame/body。SVG原缩略正常但全图失败；现明确选安全WebP派生，并保留原始SVG下载限制、身份与字节。JPEG全图回归正常。核心正向合同及辅助检查见[checks.json](checks.json)，完整运行/数据见[runtime-and-data.json](runtime-and-data.json)，原件/下载/派生见[input-review.json](input-review.json)。

14张真实UI（User Interface，用户界面）JPEG原图均人工查看，未编辑/重采样；没有新增、修改或运行UI自动化测试。两PNG为只读输入PDF参考页，经PDFium渲染并完整人工查看，不是UI截图基线。原PDF未修改，未操作AcroForm。

| 原图 | 真实观察 |
| --- | --- |
| [01](01-current-pdf-svg-attachments.jpg) | 两原件上传，SVG缩略正常、PDF入口可见，草稿保持。 |
| [02](02-current-pdf-review.jpg)、[03](03-current-pdf-still-blank.jpg) | 原iframe稳定空白；原件已加载，页面无console错误不代表正常。Close在初始frame可视区外，可滚动找回。 |
| [04](04-current-svg-full-preview.jpg) | 原SVG全图明确显示无法呈现，下载仍原件。 |
| [05](05-after-three-formats.jpg) | 改后JPEG/PDF/SVG三原件及缩略/草稿。 |
| [06](06-after-pdf-page-one.jpg)、[07](07-after-pdf-page-two.jpg) | 实际PDF两页canvas正确，关闭/下载可见。 |
| [08](08-after-pdf-zoom.jpg) | 实际缩放50%，页码与页脚稳定。 |
| [09](09-after-svg-full-preview.jpg)、[10](10-after-svg-whole-image.jpg) | SVG派生1000x1000，100%及50%完整图；下载仍6426字节原SVG。 |
| [11](11-after-jpeg-full-regression.jpg) | 原JPEG全图/缩放入口正常。 |
| [12](12-after-chinese-pdf-controls.jpg)、[13](13-after-chinese-page-two.jpg) | 真实设置切中文后PDF控件本地化，原两页内容不改写。 |
| [14](14-after-return-keeps-draft.jpg) | 关闭回原PDF按钮，三附件和完整草稿保留。 |

[PDF参考首页](reference-page-1.png)、[PDF参考第二页](reference-page-2.png) 只用于人工核对原输入有效性。两个实际下载PDF111015字节及SVG6426字节均与启动前输入精确相等；派生WebP独立19068字节，1000x1000，不冒充原件。

真实后端HTTP新合同先404红灯，再3项18断言通过；纯URL身份映射1项2断言通过，非UI。前后端类型、普通构建main-AH2FS94m及renderer通过，PDF按需加载避免main从2265.23kB升到2838.04kB的首版回归，最终2266.48kB；常规大chunk提示保留。

两个原exec均0、公有shutdown200、native/launcher0、三项及精确出生身份退休，余1925306/502490ms，共用原12:09:06.952Z截止。自有页173/174关闭、viewport已reset，用户18571未操作。无凭据副本、Provider0/累计759；源catalog原字节/元数据、auth元数据和完整旧行/输入保持，schema9、integrity ok。私有Sharp路径检查失败已改为实际文件字节检查并通过，不作为产品数据丢失证据。

未达成：图库SVG MIME缺口、外部跨域PDF/其他所有者全矩阵、在途下载退休、改后文本frame及全1280像素。下一批继续图库根因与实页，不将本批有限成功扩大为全产品或所有SVG路径完成。
