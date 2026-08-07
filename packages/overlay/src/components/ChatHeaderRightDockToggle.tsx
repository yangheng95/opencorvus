import { rightDockOpen, toggleRightDockVisible } from "../store/right-dock"
import { t } from "../utils/i18n"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"

export function ChatHeaderRightDockToggle() {
  const label = () => t(rightDockOpen() ? "chat.right_dock_close" : "chat.right_dock_open")

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      tone="neutral"
      data-ui="chat-header-right-dock-toggle"
      data-chrome="chat-header-toolbar-toggle"
      aria-pressed={rightDockOpen()}
      title={label()}
      aria-label={label()}
      onClick={toggleRightDockVisible}
    >
      <Icon name="panel-right" size="medium" />
    </Button>
  )
}
