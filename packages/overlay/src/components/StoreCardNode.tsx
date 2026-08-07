import type { JSX } from "solid-js"

import { cardTreeStore, type CardNode } from "../store/card-tree"

export function storeCardNode(id: string, ownerID?: string): CardNode {
  const node = cardTreeStore.cards[id]
  if (!node) {
    const owner = ownerID ? ` referenced by ${ownerID}` : ""
    throw new Error(`card-tree: missing rendered card ${id}${owner}`)
  }
  return node
}

export function StoreCardNode(props: { id: string; ownerID?: string; children: (node: CardNode) => JSX.Element }) {
  return <>{props.children(storeCardNode(props.id, props.ownerID))}</>
}
