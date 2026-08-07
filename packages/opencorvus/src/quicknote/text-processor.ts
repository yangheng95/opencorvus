/**
 * 文本处理工具模块
 * 提供标题提取和摘要生成等功能
 */

/** 标题最大长度（字符数） */
export const TITLE_LENGTH = 15

/** 摘要最大长度（字符数） */
export const MAX_SUMMARY_LENGTH = 100

/** 输入内容最大长度（字符数） */
export const MAX_CONTENT_LENGTH = 2000

/**
 * 从内容中提取标题
 * 自动提取前 15 个字符作为标题
 * @param content - 原始文本内容
 * @returns 提取的标题
 */
export function extractTitle(content: string): string {
  if (!content || content.length === 0) {
    return ""
  }

  // 去除首尾空白后截取前 15 个字符
  const trimmed = content.trim()
  return trimmed.slice(0, TITLE_LENGTH)
}

/**
 * 生成内容摘要
 * 截取内容的前 100 个字符作为摘要
 * @param content - 原始文本内容
 * @returns 生成的摘要
 */
export function generateSummary(content: string): string {
  if (!content || content.length === 0) {
    return ""
  }

  const trimmed = content.trim()
  // 如果内容超过最大长度，截取并添加省略号
  if (trimmed.length > MAX_SUMMARY_LENGTH) {
    return trimmed.slice(0, MAX_SUMMARY_LENGTH - 3) + "..."
  }

  return trimmed
}

/**
 * 验证内容长度
 * @param content - 待验证的内容
 * @returns 验证是否通过
 */
export function validateContent(content: string): boolean {
  return content.length <= MAX_CONTENT_LENGTH
}

/**
 * 处理文本内容
 * 一次性完成标题提取、摘要生成和验证
 * @param content - 原始文本内容
 * @returns 处理结果
 */
export function processText(content: string): {
  title: string
  summary: string
  valid: boolean
  error?: string
} {
  if (!content || content.length === 0) {
    return {
      title: "",
      summary: "",
      valid: false,
      error: "内容不能为空",
    }
  }

  const valid = validateContent(content)

  if (!valid) {
    return {
      title: "",
      summary: "",
      valid: false,
      error: `内容长度不能超过 ${MAX_CONTENT_LENGTH} 字符`,
    }
  }

  return {
    title: extractTitle(content),
    summary: generateSummary(content),
    valid: true,
  }
}
