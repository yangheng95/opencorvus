# 第27批：通道公共URL的保存校验

对应[Recall、实施前根因分析与最终限制](../../records/2026-10/2026-10-14-channel-url-validation.md)。Root独立实施/查看13原PNG，没有子agent、聊天消息或UI自动化。

- [screenshots](screenshots/README.md)：01/02修前非法socks5实际保存与重开；03/04首after及独立名称诊断；05–11最终新occurrence合法保存、非法协议/缺host、原错误切中文、大小写HTTP(S)与重开；12/13清空后旧值残留，明确未通过当前页同步。
- [runs](runs/README.md)：before PID10824、首after PID86832、最终after02 PID8136。13真实GET200安全选择只保留server.publicUrl/状态/原body长度；最终非法输入后仍为原合法值、纠正后精确URI、清空后持久化null。不替代UI或完整配置正文。
- [checks](checks/README.md)：两次实际Node build和类型0、i18n2/2301，docs345/26/架构20；三个父exit/双端口/假auth-models配对清理/完整日志隐私0。原warning保留，不冒视觉。
- [inputs](inputs/README.md)：原源/两语言与真实工具、精确范围提交方案。下层string/API/env不变，唯一字段原生validity用于blur和Save，稳定同一语言label与独立error关联。
- [previous-delivery](previous-delivery/README.md)：B26 9ad499424正常提交/推送及全部原hook/远端确认。

三个自建tab35/36/37均关闭，正常结算与真实物理退出后才移除自有假auth/models。完整backend90722/99834/129206字节，stdout/stderr0、privacy0、inference/realSol0。HTTPS仅声明本机地址，不是可达性或TLS资格。共享快照删除残留待下一批根因修复，本批不宣称全部Channel验收完成。见[原清单](manifest.json)。
