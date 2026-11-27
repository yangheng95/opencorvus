# 真实脚本流程图交付证据

[根因、Recall与验收记录](../../records/2026-11/2026-11-28-diagram-delivery.md)。本人单人真实Work读取现有销售脚本/测试/CSV，产生原生diagram@1；本批落实正常字号阅读、键盘滚动与便携SVG下载。

- `before-*.jpg`三张实际旧页；`candidate-*.jpg`两张首候选；`after-*.jpg`五张run116；`final-*.jpg`八张最终run117。18张均为本人查看的未改动原生JPEG，候选与中间观察不冒充最终页。
- `candidate-portability-light-*.png`与完整render为实际失败SVG的独立静态解码，框有而节点文字空白、背景透明；`light-*.png`/`dark-*.png`为最终两真实下载的独立解码。两色6块原始尺度本人查看，文字/连线/背景正确。12个PNG是文档呈现及其裁切，不是网页截图/自动视觉测试。
- `source-and-download-originals.zip`保留16个原始成员的实际字节，包括原CSV/脚本/测试、原发表、8份真实MMD下载/复制/粘贴、失败候选和最终两SVG。暂存ZIP再按原文件逐成员字节核对，不使用可变源码摘要。其他JSON正常接受仓库换行规范化。
- `tool-evidence.json`只收录真实5个公开工具Part的输入、输出、状态与退出码；`diagram-facts-run*.json`核对完整实际读取、只读业务输出和原发表；`export-facts.json`核对原4912字节、35原生文字节点、40连线、尺寸与实际背景；不是UI测试或模型自述验收。
- `facts-run*.json`与`reference-facts-run*.json`记录23原文件/2415旧行、两completed Task/23相关行及59字节真实资源保全。脚本供审查验证逻辑；涉及隔离运行的checker需要对应本机原服务/数据，文件checker需在临时目录解压ZIP并加入本目录原发表JSON后运行。
- `runtime-facts.json`记录4服务原句柄明确退出0、15次精确Sol真实流自然结束和成对副本退役。最后构建日志通过但原句柄观察丢失，未声称join0。已恢复中文/跟随系统，自有页关闭。无子代理、UI自动化、独立Vite、版本发布或原项目写入。

浏览器策略禁止file:访问，未绕过；独立文件视觉使用已有Sharp/librsvg静态解码，不执行浏览器/脚本或网络。独立浏览器打开、Office导入、嵌入字体与所有Mermaid语法没有验收通过声明。
