import { For, Show, createMemo, createSignal } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { t } from "../../utils/i18n"
import { Disclosure } from "../ui/Disclosure"
import { SearchField } from "../ui/SearchField"
import { ArtifactFrame } from "./ArtifactFrame"

type TreePayload = Extract<InteractiveArtifactPayload, { renderer: "tree@1" }>
type TreeNode = TreePayload["nodes"][number]

function TreeBranch(props: {
  node: TreeNode
  childrenByParent: Map<string | undefined, TreeNode[]>
  visible: Set<string>
  depth: number
  defaultExpandedDepth: number
  forceOpen: boolean
}) {
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
        <Disclosure.Root open={props.forceOpen ? true : undefined} defaultOpen={props.depth < props.defaultExpandedDepth}>
          <Disclosure.Trigger class="msg-artifact-tree__branch">{props.node.label}</Disclosure.Trigger>
          <Disclosure.Content>
            <Show when={props.node.description}>{(description) => <small>{description()}</small>}</Show>
            <ul role="group">
              <For each={children()}>
                {(child) => (
                  <TreeBranch
                    node={child}
                    childrenByParent={props.childrenByParent}
                    visible={props.visible}
                    depth={props.depth + 1}
                    defaultExpandedDepth={props.defaultExpandedDepth}
                    forceOpen={props.forceOpen}
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

export function TreeArtifact(props: { payload: TreePayload }) {
  const [filter, setFilter] = createSignal("")
  const byID = createMemo(() => new Map(props.payload.nodes.map((node) => [node.id, node])))
  const childrenByParent = createMemo(() => {
    const result = new Map<string | undefined, TreeNode[]>()
    for (const node of props.payload.nodes) {
      const siblings = result.get(node.parentID) ?? []
      siblings.push(node)
      result.set(node.parentID, siblings)
    }
    return result
  })
  const visible = createMemo(() => {
    const query = filter().trim().toLowerCase()
    if (!query) return new Set(props.payload.nodes.map((node) => node.id))
    const result = new Set<string>()
    for (const node of props.payload.nodes) {
      if (!`${node.label} ${node.description ?? ""}`.toLowerCase().includes(query)) continue
      let current: TreeNode | undefined = node
      while (current) {
        result.add(current.id)
        current = current.parentID ? byID().get(current.parentID) : undefined
      }
    }
    return result
  })
  const roots = createMemo(() => (childrenByParent().get(undefined) ?? []).filter((node) => visible().has(node.id)))

  return (
    <ArtifactFrame title={props.payload.title} kind="Tree">
      <div class="msg-artifact-tree__toolbar">
        <SearchField
          value={filter()}
          placeholder={t("artifact.tree.search")}
          size="sm"
          onValueChange={setFilter}
          onClear={() => setFilter("")}
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
                forceOpen={Boolean(filter().trim())}
              />
            )}
          </For>
        </ul>
      </div>
    </ArtifactFrame>
  )
}
