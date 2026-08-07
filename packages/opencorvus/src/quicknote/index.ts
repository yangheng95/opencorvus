/**
 * AI-QuickNote 模块入口
 *
 * 提供快速笔记功能，包括：
 * - 文本处理和标题提取
 * - 笔记 CRUD 操作
 * - RESTful API 接口
 */

// 导出数据库 schema
export { QuickNoteTable } from "./quicknote.sql"

// 导出文本处理工具
export {
  extractTitle,
  generateSummary,
  validateContent,
  processText,
  TITLE_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_CONTENT_LENGTH,
} from "./text-processor"

// 导出服务层
export { createNote, listNotes, getNote, deleteNote, type Note, type CreateNoteResult } from "./service"

// 导出路由
export { QuickNoteRoutes } from "./routes"
