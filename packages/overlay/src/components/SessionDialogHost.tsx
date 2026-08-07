import { dialogStore } from "../store/dialog"
import { closeBuildSessionDialog } from "../services/dialog"
import { t } from "../utils/i18n"
import { Dialog } from "./ui/Dialog"
import { Button } from "./ui/Button"

export function SessionDialogHost() {
  return (
    <Dialog
      id="sessionDialog"
      open={dialogStore.session.open}
      wide={true}
      title={dialogStore.session.title || t("log.title")}
      onClose={closeBuildSessionDialog}
      headerActions={
        <Button
          type="button"
          id="btnCloseSession"
          variant="ghost"
          size="sm"
          tone="neutral"
          onClick={closeBuildSessionDialog}
        >
          {t("common.close")}
        </Button>
      }
    >
      <div class="session-dialog-body" id="sessionDialogBody" innerHTML={dialogStore.session.bodyHtml} />
    </Dialog>
  )
}
