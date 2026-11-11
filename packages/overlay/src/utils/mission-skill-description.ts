import { t } from "./i18n"

export function missionSkillDescription(skill: { name: string; description?: string }): string | undefined {
  // The catalog reserves this exact name for the shipped Mission Skill.
  return skill.name === "general" ? t("mission_skill.general_description") : skill.description
}
