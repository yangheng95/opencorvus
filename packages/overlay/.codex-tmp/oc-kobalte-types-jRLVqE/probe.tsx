import { Root as DialogRoot, Content as DialogContent, Title as DialogTitle } from "@kobalte/core/dialog"
import { Root as MenubarRoot, Menu as MenubarMenu, Trigger as MenubarTrigger } from "@kobalte/core/menubar"
export const probe = (
  <DialogRoot open={true}>
    <DialogContent><DialogTitle>Dialog</DialogTitle></DialogContent>
    <MenubarRoot><MenubarMenu><MenubarTrigger>Menu</MenubarTrigger></MenubarMenu></MenubarRoot>
  </DialogRoot>
)