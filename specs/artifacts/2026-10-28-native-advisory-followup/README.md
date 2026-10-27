# 原生依赖升级与实际验收证据

对应[调查与方案](../../records/2026-10/2026-10-28-native-advisory-followup.md)。本批不改UI；没有原生窗口视觉验收。

- [汇总](runtime-review.json)：同一正式应用编译的19项行为、独立event库2项、真实打包后端首次运行与进程结清。
- [正式结果](native-02-result.json)、[生产行为原输出](native-02-native-contracts.stdout.log.json)、[event原输出](native-02-event-library-contracts.stdout.log.json)：绑定精确package、profile与features。
- [首次失败](native-01-result.json)：保留Host/runtime特性混淆的原始错误，不冒认首次通过。对应process回执记录180秒无输出后的真实结清。
- [有限进程探针](finite-exit-seven-review.json)、[原checker错误探针](native-metadata-error-review.json)：实际退出7/1、物理和输出结清；非模拟。
- [升级前完整JSON](overlay-json-registry-recheck.stdout.log.json)、[构建后完整JSON](overlay-json-final.stdout.log.json)及各自terminal原输出：615依赖9漏洞→622依赖0漏洞，仍有9警告；Supervisor22依赖0漏洞/0警告。没有过滤。初始registry失败的完整原件保留在忽略工作目录；这里选择随后成功更新registry的完整报告。
- [最终节点变化](final-resolve-nodes.json)：正常Cargo解析与精确补丁升级，不提交旧漏洞锁副本。原锁由Git父提交保留。

所有.log.json以UTF-8（Unicode Transformation Format，Unicode转换格式）content字段原样封装日志，包括ANSI颜色和末尾空行，避免将真实工具空白当作源码空白缺陷。两个build-readable.stdout.log是原构建stdout逐行保留、仅省去带reason字段的Cargo JSON编译消息；完整原件及compiler-artifacts保留于本批忽略工作目录。stderr、结果、行为输出和审计报告均为原件。公开测试PKI（Public Key Infrastructure，公钥基础设施）的私钥文件、可执行文件、PDB及个人凭据未复制到该目录。

没有执行真实更新安装、Linux/macOS应用或Unix AsyncFd实验。9项余留警告及STATIC_VCRUNTIME弃用提示详见方案，不以Windows编译或这些数据合同冒称全部平台/安全告警已完成。
