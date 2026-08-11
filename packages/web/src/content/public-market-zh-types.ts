export type PublicSquadZhTranslation = {
  label: string
  description: string
  selectorSummary: string
  agents: Record<
    string,
    {
      label: string
      description?: string
    }
  >
  workflows: Record<
    string,
    {
      label: string
      description: string
      nodes: Record<string, string>
    }
  >
}

export type PublicSquadZhTranslationMap = Record<string, PublicSquadZhTranslation>
