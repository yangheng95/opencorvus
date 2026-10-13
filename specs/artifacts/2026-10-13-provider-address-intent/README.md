# Provider 地址编辑证据

主 agent 真实中文桌面基线：无凭据隔离项目、生产 listener/recovery、上一批私有前端；not-a-url 红色错误仍可点击保存，实际配置和列表均显示该值。截图在实施前人工查看。

- [修前同屏错误与启用保存](before-error-and-save.png)、[实际无效保存](before-invalid-saved.png)，[原配置](before-config.jsonc)。before-invalid-enabled仅显示展开高级区，不能独立证明可见地址错误。
- [中文完整后态](after-invalid-zh-complete.png)与[英文完整后态](after-invalid-en.png)：错误与禁用发现/保存均实际可见；API field具有 aria-invalid=true 和同一错误描述关联，非屏幕阅读器验收。
- [合法地址实际中文保存](after-valid-saved-zh.png)、[英文保存后的列表](after-valid-saved-en.png)。实际 Enter 保存、重开编辑并更新为有效IPv6；[最终配置](after-config.jsonc)精确记录四个声明和完整模型。
- [models-only 编辑](after-inherited-edit-zh.png)：空API的required=false、更新启用；[模板编辑](after-template-edit-zh.png)：更新名称保留原模板。输入为明确[无凭据测试声明](after-seed.jsonc)，随后全部通过真实UI编辑保存，不冒充在线模型事实。Discover对可解析输入启用不证明模板展开或连接可用。
- 畸形端口和不完整IPv6另外截图在after-invalid-port-zh/after-edit-invalid-zh；此两图底部按钮被视口切掉，不以它们证明同屏按钮。after-invalid-zh同样底部切掉，只以complete版本认定完整视觉结果。
- checks中的gzip是原始构建/类型/测试/i18n/docs和自有stdout/stderr压缩；首轮类型错误保留，最终11测试46断言、类型/i18n/构建/docs实际exit0。无UI自动化测试。
- [物理收尾](process-settlement.json)与before/after owner/ready/terminal：两个原exec实际exit0、两个PID已退出、18573无listener。只停自有服务和关闭自有tab。

边界：本批不调用实际模型、发现或连接测试，无密钥；不证明网络连通、真实供应商、所有模板/浏览器或屏幕阅读器。新/显式编辑地址校验不迁移历史配置；未编辑api由latest current保真。英文列表已观察到独立单复数候选“1 models”，下一批调查，不捎带更改当前显示合同。

详见 [Recall 与方案](../../records/2026-10/2026-10-13-provider-address-intent.md)。本目录只保存本批非敏感人工输入、运行输出和真实截图，不是 Provider 在线账单或模型验收。
