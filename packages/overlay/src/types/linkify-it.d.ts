declare module "linkify-it" {
  export interface LinkifyItMatch {
    schema: string
    index: number
    lastIndex: number
    raw: string
    text: string
    url: string
  }

  export interface LinkifyItOptions {
    fuzzyLink?: boolean
    fuzzyEmail?: boolean
    fuzzyIP?: boolean
  }

  export default class LinkifyIt {
    constructor(options?: LinkifyItOptions)
    match(text: string): LinkifyItMatch[] | null
  }
}
