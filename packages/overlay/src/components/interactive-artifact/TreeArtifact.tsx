import { For, Show, batch, createMemo } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import type { ArtifactExport } from "../../services/artifact-export"
import { createArtifactTreeSearch, normalizeArtifactTreeQuery } from "../../services/artifact-tree"
import {
  conversationArtifactDisplayState,
  conversationDisclosureExpanded,
  setConversationArtifactDisplayState,
  setConversationDisclosureExpanded,
} from "../../store/conversation-ui"
import { t } from "../../utils/i18n"
import { Disclosure } from "../ui/Disclosure"
import { SearchField } from "../ui/SearchField"
import { ArtifactFrame } from "./ArtifactFrame"

type TreePayload = Extract<InteractiveArtifactPayload, { renderer: "tree@1" }>
type TreeNode = TreePayload["nodes"][number]
const branchStateKey = (artifactKey: string, nodeID: string) => JSON.stringify(["artifact-tree-branch", artifactKey, nodeID])

function TreeBranch(props: {
  node: TreeNode
  childrenByParent: Map<string | undefined, TreeNode[]>
  visible: Set<string>
  depth: number
  defaultExpandedDepth: number
  query: string
  stateKey: string
}) {
  const expanded = () => conversationDisclosureExpanded(
    branchStateKey(props.stateKey, props.node.id), Boolean(props.query) || props.depth < props.defaultExpandedDepth,
  )
  const setExpanded = (open: boolean) => setConversationDisclosureExpanded(branchStateKey(props.stateKey, props.node.id), open)
  const children = () => (props.childrenByParent.get(props.node.id) ?? []).filter((node) => props.visible.has(node.id))
  return (
    <li role="treeitem" data-tree-node={props.node.id}>
      <Show
        when={children().length}
        fallback={
          <div class="msg-artifact-tree__leaf">
            <span>{props.node.label}</span>
            <Show when={props.node.description}>{(description) => <small>{description()}</small>}</Show>
          </div>
        }
      >
        <Disclosure.Root open={expanded()} onOpenChange={setExpanded}>
          <Disclosure.Trigger class="msg-artifact-tree__branch">
            <span>{props.node.label}</span>
            <Show when={props.node.description}>{(description) => <small>{description()}</small>}</Show>
          </Disclosure.Trigger>
          <Disclosure.Content>
            <ul role="group">
              <For each={children()}>
                {(child) => (
                  <TreeBranch
                    node={child}
                    childrenByParent={props.childrenByParent}
                    visible={props.visible}
                    depth={props.depth + 1}
                    defaultExpandedDepth={props.defaultExpandedDepth}
                    query={props.query}
                    stateKey={props.stateKey}
                  />
                )}
              </For>
            </ul>
          </Disclosure.Content>
        </Disclosure.Root>
      </Show>
    </li>
  )
}

export function TreeArtifact(props: { payload: TreePayload; stateKey: string; exportFiles?: () => ArtifactExport[] }) {
  const filter = () => conversationArtifactDisplayState(props.stateKey)?.query ?? ""
  const query = createMemo(() => normalizeArtifactTreeQuery(filter()))
  const search = createMemo(() => createArtifactTreeSearch(props.payload.nodes))
  const childrenByParent = createMemo(() => {
    const result = new Map<string | undefined, TreeNode[]>()
    for (const node of props.payload.nodes) {
      const siblings = result.get(node.parentID) ?? []
      siblings.push(node)
      result.set(node.parentID, siblings)
    }
    return result
  })
  const visible = createMemo(() => search()(query()))
  const roots = createMemo(() => (childrenByParent().get(undefined) ?? []).filter((node) => visible().has(node.id)))
  const setFilter = (value: string) => {
    const next = normalizeArtifactTreeQuery(value)
    const changed = next !== query()
    batch(() => {
      setConversationArtifactDisplayState(props.stateKey, { query: value })
      // A new query reveals its paths once. Mounting the same query respects
      // the reader's retained branch choices, including a deliberate collapse.
      if (next && changed) {
        for (const id of search()(next)) {
          if (childrenByParent().has(id)) setConversationDisclosureExpanded(branchStateKey(props.stateKey, id), true)
        }
      }
    })
  }

  return (
    <ArtifactFrame payload={props.payload} exportFiles={props.exportFiles} title={props.payload.title} kind="Tree">
      <div class="msg-artifact-tree__toolbar">
        <SearchField
          clearable
          value={filter()}
          placeholder={t("artifact.tree.search")}
          size="sm"
          onValueChange={setFilter}
        />
        <span>{t("artifact.tree.nodes", { count: visible().size })}</span>
      </div>
      <div class="msg-artifact-tree" role="tree" aria-label={props.payload.title}>
        <ul>
          <For each={roots()} fallback={<li>{t("artifact.tree.empty")}</li>}>
            {(root) => (
              <TreeBranch
                node={root}
                childrenByParent={childrenByParent()}
                visible={visible()}
                depth={0}
                defaultExpandedDepth={props.payload.defaultExpandedDepth ?? 1}
                query={query()}
                stateKey={props.stateKey}
              />
            )}
          </For>
        </ul>
      </div>
    </ArtifactFrame>
  )
}
