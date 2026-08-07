//! macOS native WebView keyboard ownership.
//!
//! Tauri's `unstable` child-WebView path exposes a Wry regression tracked by
//! tauri-apps/tauri#10194. When WebKit does not consume an arrow at a text
//! boundary, AppKit can pass virtual key codes 123 through 126 into
//! `interpretKeyEvents:` and then `insertText:`, inserting function-key text
//! without a Document Object Model (DOM) input event.
//!
//! Wry pull request #769 previously fixed that native boundary in the parent
//! view's `keyDown:` responder: WebKit first owns normal caret movement, while
//! arrows that reach the parent at a text boundary stop before AppKit's text
//! interpreter. That guard was later removed and has not returned in Wry
//! 0.55.1. This module restores the same single native owner until the
//! repository intentionally upgrades to an upstream release containing the
//! repair.

#![cfg(target_os = "macos")]

use objc2::{
    ffi::{class_getInstanceMethod, class_replaceMethod, method_getImplementation},
    msg_send,
    runtime::{AnyClass, AnyObject, Imp, Sel},
    sel,
};
use std::{ffi::c_void, sync::OnceLock};

const LEFT_ARROW_VIRTUAL_KEY_CODE: u16 = 123;
const RIGHT_ARROW_VIRTUAL_KEY_CODE: u16 = 124;
const DOWN_ARROW_VIRTUAL_KEY_CODE: u16 = 125;
const UP_ARROW_VIRTUAL_KEY_CODE: u16 = 126;
static ARROW_KEY_REPAIR_INSTALLATION: OnceLock<Result<(), String>> = OnceLock::new();
static ORIGINAL_PARENT_KEY_DOWN: OnceLock<Imp> = OnceLock::new();

fn is_arrow_virtual_key_code(key_code: u16) -> bool {
    matches!(
        key_code,
        LEFT_ARROW_VIRTUAL_KEY_CODE
            | RIGHT_ARROW_VIRTUAL_KEY_CODE
            | DOWN_ARROW_VIRTUAL_KEY_CODE
            | UP_ARROW_VIRTUAL_KEY_CODE
    )
}

pub fn install_arrow_key_repair(webview: *mut c_void) -> Result<(), String> {
    ARROW_KEY_REPAIR_INSTALLATION
        .get_or_init(|| install_arrow_key_repair_once(webview))
        .clone()
}

fn install_arrow_key_repair_once(webview: *mut c_void) -> Result<(), String> {
    let webview = webview.cast::<AnyObject>();
    let parent: *mut AnyObject = unsafe { msg_send![&*webview, superview] };
    if parent.is_null() {
        return Err("Wry WebView parent is unavailable".to_string());
    }
    let parent_class: *const AnyClass = unsafe { msg_send![&*parent, class] };
    let selector = sel!(keyDown:);
    let implementation_function: extern "C" fn(*mut AnyObject, Sel, *mut AnyObject) =
        repaired_parent_key_down;
    let implementation: Imp = unsafe { std::mem::transmute(implementation_function) };
    let method_types = c"v@:@";

    let original_method = unsafe { class_getInstanceMethod(parent_class, selector) };
    if original_method.is_null() {
        return Err("Wry WebView parent does not implement keyDown:".to_string());
    }
    let original = unsafe { method_getImplementation(original_method) }
        .ok_or_else(|| "Wry WebView parent keyDown: implementation is unavailable".to_string())?;
    ORIGINAL_PARENT_KEY_DOWN
        .set(original)
        .map_err(|_| "Wry WebView parent keyDown: owner was already recorded".to_string())?;
    unsafe {
        class_replaceMethod(
            parent_class as *mut AnyClass,
            selector,
            implementation,
            method_types.as_ptr(),
        );
    }
    Ok(())
}

extern "C" fn repaired_parent_key_down(
    parent: *mut AnyObject,
    selector: Sel,
    event: *mut AnyObject,
) {
    unsafe {
        let key_code: u16 = msg_send![&*event, keyCode];
        if is_arrow_virtual_key_code(key_code) {
            return;
        }

        type OriginalParentKeyDown = extern "C" fn(*mut AnyObject, Sel, *mut AnyObject);
        let original: OriginalParentKeyDown = std::mem::transmute(
            *ORIGINAL_PARENT_KEY_DOWN
                .get()
                .expect("Wry WebView parent keyDown: owner is unavailable"),
        );
        original(parent, selector, event);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        is_arrow_virtual_key_code, DOWN_ARROW_VIRTUAL_KEY_CODE, LEFT_ARROW_VIRTUAL_KEY_CODE,
        RIGHT_ARROW_VIRTUAL_KEY_CODE, UP_ARROW_VIRTUAL_KEY_CODE,
    };

    #[test]
    fn appkit_arrow_virtual_key_codes_share_the_native_repair() {
        for key_code in [
            LEFT_ARROW_VIRTUAL_KEY_CODE,
            RIGHT_ARROW_VIRTUAL_KEY_CODE,
            DOWN_ARROW_VIRTUAL_KEY_CODE,
            UP_ARROW_VIRTUAL_KEY_CODE,
        ] {
            assert!(is_arrow_virtual_key_code(key_code));
        }
    }
}
