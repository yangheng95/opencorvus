# 376 固定服务实例的完整前端资源

旧freeze仅记录部分资源标识，HTTP仍从可变目录读文件。重建删除旧worker后，运行页面获取404而正文失败，原测试仅构建另一个目录而漏验。

目录和embedded资源现共同进入不可变Blob快照；每次请求获取独立流，HTML/脚本/延迟模块/语言/字体等来自同一次捕获。身份从实际捕获字节派生。删除运行时磁盘读路径和旧validatePath，保留捕获边界及请求403/404合同；修复HTML中相对资产链接的路径重写。约30.5MB的正式UI快照驻留于服务进程生命周期，新服务捕获新版本。

旧HTML源码/哈希形状断言已删除。后台真实HTTP合同由改前1pass/7fail变为最终11pass；类型通过。私有ui目录用真实Vite重建后，旧服务继续提供原worker及首次加载的编辑器，实际文件保存65字节且保留CRLF；新capture读取新构建。5张截图人工查看，5次Sol流式EOF，原84566 exit0、Native578003ms，全边界及凭据副本闭合。

额外嵌套URL探查发现客户端相对i18n路径及初始化错误呈现问题，仍待修复；未宣称该路径通过。编译embedded实际运行与其它平台未验，目录CLI路径已验。没有操作用户进程或共享dist，没有开发agent委托。

[方案](../../artifacts/2026-10-05-connection-workspace-authority/ui-resource-snapshot-plan-376.md)，[实页与协议证据](../../artifacts/2026-10-05-connection-workspace-authority/ui-resource-snapshot-376/README.md)。继续goal active。
