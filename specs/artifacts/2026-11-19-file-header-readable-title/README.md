# 文件栏标题优先显示验收

## 基线

- [默认宽度下截断了短文件名](baseline-en-default-width.png)
- [最小宽度的根目录文件英语标题](baseline-en-minimum-root-title.png) · [同一文件的中文界面](baseline-zh-minimum-root-title.png)
- [最小宽度的独立只读来源](baseline-zh-minimum-readonly-title.png)

本人操作 `40272/ui/` 的真实页面并逐图核对，构建入口是 `main-HtEAPlma.js`。两份项目文件与一份独立来源的真实接口读取均为 200，精确等于磁盘 167、125、66 字节。英文和中文的最小宽度通过工作台实际分隔条取得。
