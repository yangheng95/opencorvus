# 目录读取错误证据

对应[方案与调查](../../records/2026-11/2026-11-09-directory-read-errors.md)。本人独立进行正式backend checker、真实TCP与隔离页面截图复核；明确区分局部注入合同与真实系统/页面结果，零模型/凭据/UI自动化。

- 01/02：真实目录移走后通用加载失败，Details原500/UnknownError。
- 03：原目录恢复，真实Retry显示marker.txt。
- 04/05：新构建实际404/FileNotFoundError、英文摘要和完整原诊断。
- 06：同一实际失败在中文的准确摘要，原路径/诊断保持。
- 07/08：实际恢复/中文重试成功、打开原marker.txt正文。
- before-tcp.json/before-restored-bytes.json：原500及正常200、原33/19字节保持。
- after-tcp-and-protocol.json：三项实际404、正常列表/root空key200；原33/19字节；352操作仅file.list新增404，共享schema和正式SDK协议一致。
- tcp-schema-check.json：Node.js Ajv2020直接进入真实TCP/doc与六个实际响应的schema校验。

8张截图均已实际呈现并本人查看；66pass/673正向断言通过，类型/SDK/必要包/正常UI构建/文档检查辅助。EACCES/EIO为局部系统函数注入，仅证明原500合同。整个自有root移动被Windows拒绝，root缺失视觉未验；没有杀进程绕过。子目录与原文均恢复，页面59/60/61关闭、服务13770/94061正常shutdown及原session退出0。模型授权未收到。
