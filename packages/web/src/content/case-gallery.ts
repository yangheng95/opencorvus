import { squadCompositions, FEATURED_COMPOSITION_ID } from "./squad-compositions"
import type { PublicLocale } from "./public-market"

export type GalleryCaseID = "deberta" | "tank"

/** Case facts, not promises about unseen queries. Model provenance stays visible. */
export function galleryCases(locale: PublicLocale) {
  const zh = locale === "zh-cn"
  const research = squadCompositions.find((entry) => entry.id === FEATURED_COMPOSITION_ID)!
  return [
    {
      id: "deberta" as const,
      title: zh ? "CUDA 训练、实时网页与论文" : "CUDA training, a live site and a paper",
      model: "GPT-5.6 Sol",
      inputLabel: zh ? "任务要求记录" : "Recorded task requirements",
      query: research.requirements!.map((entry, index) => `${index + 1}. ${entry[locale]}`).join("\n\n"),
      outputs: zh ? ["CUDA 实验与结果记录", "模型设计、图表和论文", "可检查的 Git 仓库"] : ["CUDA experiments and result records", "Model design, figures and paper", "Inspectable Git repository"],
      evidence: "https://github.com/yangheng95/deberta-v3-absa-public-evidence/tree/ee54b400efac03ed665d86c45653dc4239b4c285",
      evidenceLabel: zh ? "查看公开产物" : "Inspect the public artifacts",
      image: null,
    },
    {
      id: "tank" as const,
      title: zh ? "坦克大战网页游戏" : "A browser tank-battle game",
      model: "DeepSeek V4 Flash",
      inputLabel: zh ? "原始 Query" : "Original query",
      query: "帮我创建一个坦克大战的网页游戏，要求还原全部的原版游戏体验",
      outputs: zh ? ["19 项验收要求", "35 关来源数据", "计分修正与数据替换，两轮回流"] : ["19 acceptance requirements", "Source data for 35 stages", "Two rounds: scoring repair and data replacement"],
      evidence: locale === "zh-cn" ? "/zh-cn/cases/tank-battle/" : "/cases/tank-battle/",
      evidenceLabel: zh ? "查看交付与证据" : "Inspect delivery and evidence",
      image: "/media/tank-battle-case.png",
    },
  ]
}
