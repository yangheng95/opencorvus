# 二进制预览返回核对的证据

## 输入和参考

- [三页 A 原 PDF](source-revision-a.pdf)，[两页 B 原 PDF](source-revision-b.pdf)，[实际页数与正文标记](source-facts.json)。
- [A 第 3 页参考渲染](reference-a-page3.png)，[B 第 1 页参考渲染](reference-b-page1.png)，均经本人查看。

## 修改前真实页面

- [A 第 1 页](desktop-original-a-page1.png)，[A 第 3 页](desktop-original-a-page3.png)，[磁盘为 B 后返回仍为 A](baseline-return-still-a-page3.png)，[显式重载才显示 B](baseline-explicit-reload-b-page1.png)。
- [A 真实字节回读](file-read-a.json)，[原子替换的实际文件事实](file-publication-replace-b.json)，[B 真实字节回读](file-read-b.json)。

## 候选真实页面

- [A 第 3 页](candidate-a-page3.png)，[切回即显示 B 第 1 页](candidate-return-b-page1.png)，[B 第 2 页](candidate-b-page2.png)，[字节未变再次返回保留第 2 页](candidate-unchanged-b-keeps-page2.png)。
- [实际损坏 PDF 原因](candidate-invalid-pdf-details.png)，[恢复 B 后返回正常](candidate-recovered-b-page1.png)，[中文 PDF 正文与控件](candidate-pdf-b-zh.png)。
- [原棕色图像](candidate-poster-a.png)，[返回后的蓝色新图像](candidate-poster-b.png)。
- [原 4 字节](candidate-binary-a.png)，[返回后的 9 bytes](candidate-binary-b-en.png)，[中文 9字节](candidate-binary-b-zh.png)。

## 正式读取与文件发布事实

- PDF：[候选 A](candidate-file-read-a.json)，[实际发布 B](candidate-file-publication-replace-b.json)，[候选 B](candidate-file-read-b.json)，[发布损坏文件](candidate-file-publication-corrupt.json)，[损坏文件读取](candidate-file-read-invalid.json)，[恢复 B](candidate-file-publication-restore-b.json)，[恢复后读取](candidate-file-read-recovered.json)。
- 图像：[A 读取](candidate-poster-a.json)，[发布 B](candidate-replace-poster.json)，[B 读取](candidate-poster-b.json)。
- 二进制：[4 字节读取](candidate-binary-a.json)，[发布 9 字节](candidate-replace-binary.json)，[9 字节读取](candidate-binary-b.json)。

回读检查将正式响应、磁盘实际字节和已知原件逐字节比较。图片和文档均经本人查看。以上为真实项目预览的确定性验收，未调用模型或凭据。
