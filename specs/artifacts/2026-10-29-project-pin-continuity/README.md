# 项目置顶连续性实页证据

对应[规格](../../records/2026-10/2026-10-29-project-pin-continuity.md)。基线38327、中间普通构建main-CEbR_tGb.js/38328、补正空项目分支的最终普通main-BCs5veQK.js/38329，均使用真实`/ui`。28张原始JPEG均实际呈现并人工查看；没有UI自动化测试、数据fixture或请求拦截。

- 01：普通项目Pin成功却focus=BODY。
- 02–03：匿名项目已有Unpin菜单事实，却仍在Projects而非Pinned。
- 04–05：普通Pin/Unpin回新位置主按钮，实际Tab/Enter菜单可继续操作。
- 06–08：匿名项目进入Pinned，匿名头/转换入口保留，Unpin后回主按钮。
- 09–11：单列表组织菜单与当前投影；关闭组织菜单后Unpin交给同项目可见对话记录。09/10不是后台失败，09在组合工具中止后从原文件再次查看。
- 12–15：手动排序初始首十项、Pinned与普通渐进集合独立；Unpin目的项目被折叠时回Show more，实际Enter展开。
- 16–17：真实项目选择后折叠，Pin/Unpin仍保持折叠与入口焦点。
- 18–19：中文匿名置顶区与名称；原英文/按项目/最近更新设置已恢复。
- 20–22：正常公开停服后的原错误详情及关闭归还，不吞失败Promise。
- 23–24：最终构建的既有754空Project实际Pin；单列表Unpin后回组织入口，旁边Show more仍存在。
- 25–26：组织入口可点击关闭菜单；checkbox焦点下Escape仍未关闭且Tooltip可见，是下一批需定位的真实问题。
- 27–28：最终构建再次复核普通Project Pin/Unpin，回新位置主按钮。

`data.json`核对所有旧行、三源库、原五文件及附件namespace；全部103724行往返后精确相同。`runtime.json`包含三个原exec、固定截止、公开shutdown、native/launcher结算和catalog清退。`checks.json`为实际聚焦检查结果，不能替代上述视觉证据。三scope模型0/累计767，未复制凭据，用户18571未触碰。

组织checkbox的Escape关闭尚未解决，不能将Tooltip或库登记直接当作已证根因；下一批继续调查。未全面实测慢请求移焦、多项目并发Pin、跨连接迟到结果及被另一请求取代的读取；priority排序未单独循环。未永久删除或搬迁匿名目录，未宣称整个产品或持续Goal完成。
