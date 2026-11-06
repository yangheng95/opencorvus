import { Lexer, type Token, type Tokens } from "marked"

function tokenText(tokens: readonly Token[], separator = ""): string {
  return tokens
    .map((token): string => {
      if (token.type === "space" || token.type === "br" || token.type === "hr") return " "
      if (token.type === "list") {
        const list = token as Tokens.List
        return list.items
          .map((item, index) => {
            const marker = item.task ? (item.checked ? "☑ " : "☐ ") : list.ordered ? `${Number(list.start) + index}. ` : ""
            return marker + tokenText(item.tokens, " ")
          })
          .join("; ")
      }
      if (token.type === "table") {
        const table = token as Tokens.Table
        return [table.header, ...table.rows]
          .map((row) => row.map((cell) => tokenText(cell.tokens)).join(" · "))
          .join("; ")
      }
      if ("tokens" in token && token.tokens) return tokenText(token.tokens, token.type === "blockquote" ? " " : "")
      return "text" in token ? String(token.text) : ""
    })
    .join(separator)
}

/** Plain text for a compact activity row; the original transcript owns full rendering. */
export function markdownPreviewText(text: string): string {
  return tokenText(new Lexer({ gfm: true }).lex(text), " ")
}
