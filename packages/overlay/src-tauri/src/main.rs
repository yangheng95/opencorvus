// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::{HashMap, VecDeque},
    fs,
    io::{BufReader, Cursor, Read, Seek, SeekFrom, Write},
    net::{SocketAddr, TcpListener, TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex, Once, OnceLock,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use flate2::read::GzDecoder;
use fs4::{FileExt, TryLockError};
use serde::{Deserialize, Serialize};
use tar::Archive;
#[cfg(target_os = "macos")]
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    utils::config::Color,
    AppHandle, Emitter, Manager, Runtime, UserAttentionType,
};
use tauri_plugin_clipboard_manager::ClipboardExt;
#[cfg(any(target_os = "macos", windows, target_os = "linux"))]
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::{Update, UpdaterExt};
#[cfg(windows)]
use winrt_toast_reborn::{register, Toast, ToastManager};

#[cfg(target_os = "macos")]
mod macos_webview_keyboard;

include!(concat!(env!("OUT_DIR"), "/server_defaults.rs"));

const LOCAL_SERVER_HOST: &str = DEFAULT_SERVER_HOST;
const TRAY_ID: &str = "main-tray";
const TRAY_TOOLTIP_DEFAULT: &str = "OpenCorvus";
const OVERLAY_STARTUP_SURFACE_LIGHT: Color = Color(255, 255, 255, 255);
const OVERLAY_STARTUP_SURFACE_DARK: Color = Color(38, 40, 44, 255);
const OVERLAY_STARTUP_SURFACE_VSCODE_DARK: Color = Color(37, 37, 38, 255);
const STARTUP_PROGRESS_EVENT: &str = "overlay:startup-progress";
const EXPERT_SQUAD_INSTALL_HANDOFF_EVENT: &str = "opencorvus:expert-squad-install";
const SERVER_HEALTH_READINESS_TIMEOUT: Duration = Duration::from_secs(30);
const SERVER_HEALTH_ATTEMPT_TIMEOUT: Duration = Duration::from_millis(750);
const SERVER_HEALTH_RETRY_INTERVAL: Duration = Duration::from_millis(100);
const SIDECAR_STARTUP_FAILURE_TAIL_BYTES: u64 = 16 * 1024;
#[cfg(target_os = "macos")]
const NATIVE_MENU_EVENT: &str = "oc:native-menu";
const BROWSER_PREVIEW_WEBVIEW_LABEL_PREFIX: &str = "browser-preview-live-webview-";

fn browser_preview_webview_label(surface_id: &str) -> Result<String, String> {
    let surface_id = surface_id.trim();
    if surface_id.is_empty() {
        return Err("browser preview surface ID is required".to_string());
    }
    if surface_id.len() > 160
        || !surface_id
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_' | ':'))
    {
        return Err("browser preview surface ID contains unsupported characters".to_string());
    }
    Ok(format!(
        "{BROWSER_PREVIEW_WEBVIEW_LABEL_PREFIX}{surface_id}"
    ))
}
// Injected into the browser-preview child webview (all frames, document start).
// Mirrors the reference open-mirror-app model: the element picker runs INSIDE
// the guest page (real DOM hit-testing) and reports the selected node rect +
// label in its own comment panel. The overlay pulls the submitted comment or
// cancellation via `overlay_browser_preview_selection_take`. This replaces the
// old "hide native, capture on a host iframe overlay" approach which never
// received clicks because the native child webview stayed on top (WebView2).
const BROWSER_PREVIEW_SELECTION_RUNTIME: &str = r###"
(function () {
  if (window.__OPENCORVUS_PREVIEW_SELECTION__) return;
  var state = { enabled: false, hover: null, selection: null, presentation: null, contextSelection: null, contextRequested: false, pointerTimer: null };
  var ROOT_ID = "__opencorvus_preview_selection_root__";
  var root = null;
  var shadowRoot = null;
  var outline = null;
  var hud = null;
  var panel = null;
  var contextMenu = null;
  var pointerHint = null;

  function px(value) { return Math.max(0, Math.round(value)) + "px"; }
  function text(value) { return value == null ? "" : String(value); }
  function esc(value) {
    return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function label(key) {
    return esc(state.presentation.labels[key]);
  }
  function applyPresentation(presentation) {
    state.presentation = presentation;
    if (!root || !presentation) return;
    var palette = presentation.palette;
    var variables = {
      "--oc-annotation-surface": palette.surface,
      "--oc-annotation-surface-inset": palette.surfaceInset,
      "--oc-annotation-surface-hover": palette.surfaceHover,
      "--oc-annotation-text": palette.text,
      "--oc-annotation-text-muted": palette.textMuted,
      "--oc-annotation-border": palette.border,
      "--oc-annotation-accent": palette.accent,
      "--oc-annotation-accent-dim": palette.accentDim,
      "--oc-annotation-accent-ring": palette.accentRing,
      "--oc-annotation-shadow": palette.shadow
    };
    Object.keys(variables).forEach(function (name) { root.style.setProperty(name, variables[name]); });
  }
  function trimText(value, max) {
    var normalized = text(value).replace(/\s+/g, " ").trim();
    return normalized.length > max ? normalized.slice(0, max - 1) + "…" : normalized;
  }
  // The guest publishes only completed comment/cancel results. The host drains
  // this value through `eval_with_callback` while selection mode is active.
  function publishResult(result) {
    window.__OPENCORVUS_PREVIEW_SELECTION_RESULT__ = JSON.stringify(result);
  }
  function hasPublishedResult() {
    var result = window.__OPENCORVUS_PREVIEW_SELECTION_RESULT__;
    return typeof result === "string" && result.trim().length > 0;
  }
  function ensureRoot() {
    if (root && root.isConnected) return root;
    root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
      document.documentElement.appendChild(root);
    }
    shadowRoot = root.shadowRoot || root.attachShadow({ mode: "open" });
    applyPresentation(state.presentation);
    var componentStyles = document.createElement("style");
    componentStyles.textContent = ".oc-annotation-menu-item{all:unset;box-sizing:border-box;width:100%;min-height:32px;display:flex;align-items:center;padding:0 9px;border-radius:6px;background:transparent;color:var(--oc-annotation-text);font:400 13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:left;white-space:nowrap;cursor:default}.oc-annotation-menu-item:is(:hover,:focus-visible){outline:none;background:var(--oc-annotation-surface-hover)}";
    outline = document.createElement("div");
    outline.style.cssText = "position:fixed;box-sizing:border-box;border:2px solid var(--oc-annotation-accent);background:var(--oc-annotation-accent-dim);box-shadow:0 0 0 4px var(--oc-annotation-accent-ring),0 18px 48px var(--oc-annotation-accent-ring);border-radius:12px;display:none;";
    hud = document.createElement("div");
    hud.style.cssText = "position:fixed;display:none;min-width:280px;max-width:min(560px,calc(100vw - 24px));box-sizing:border-box;border:1px solid var(--oc-annotation-border);border-radius:24px;background:var(--oc-annotation-surface);color:var(--oc-annotation-text);padding:18px 28px;box-shadow:var(--oc-annotation-shadow);font-size:14px;line-height:1.7;";
    panel = document.createElement("div");
    panel.style.cssText = "position:fixed;display:none;pointer-events:auto;width:min(360px,calc(100vw - 24px));box-sizing:border-box;border:1px solid var(--oc-annotation-border);border-radius:20px;background:var(--oc-annotation-surface);color:var(--oc-annotation-text);padding:18px 20px;box-shadow:var(--oc-annotation-shadow);font-size:13px;line-height:1.6;";
    contextMenu = document.createElement("div");
    contextMenu.setAttribute("role", "menu");
    contextMenu.style.cssText = "position:fixed;display:none;pointer-events:auto;min-width:160px;max-width:calc(100vw - 16px);box-sizing:border-box;border:1px solid var(--oc-annotation-border);border-radius:8px;background:var(--oc-annotation-surface);color:var(--oc-annotation-text);padding:4px;box-shadow:var(--oc-annotation-shadow);font-size:13px;line-height:1.35;";
    pointerHint = document.createElement("div");
    pointerHint.setAttribute("role", "status");
    pointerHint.style.cssText = "position:fixed;display:none;pointer-events:none;max-width:220px;box-sizing:border-box;border:1px solid var(--oc-annotation-border);border-radius:8px;background:var(--oc-annotation-surface);color:var(--oc-annotation-text);padding:7px 10px;box-shadow:var(--oc-annotation-shadow);font-size:12px;font-weight:600;line-height:1.4;white-space:nowrap;";
    shadowRoot.replaceChildren(componentStyles, outline, hud, panel, contextMenu, pointerHint);
    return root;
  }
  function clearPointerHint() {
    if (state.pointerTimer) window.clearTimeout(state.pointerTimer);
    state.pointerTimer = null;
    if (pointerHint) pointerHint.style.display = "none";
  }
  function contextMenuOpen() { return !!(contextMenu && contextMenu.style.display !== "none"); }
  function eventInside(element, evt) {
    if (!element) return false;
    if (element.contains(evt.target)) return true;
    return typeof evt.composedPath === "function" && evt.composedPath().indexOf(element) >= 0;
  }
  function hideContextMenu() {
    if (contextMenu) contextMenu.style.display = "none";
  }
  function clearVisuals() {
    if (outline) outline.style.display = "none";
    if (hud) hud.style.display = "none";
    if (panel) panel.style.display = "none";
    hideContextMenu();
    clearPointerHint();
  }
  function cleanup() {
    clearVisuals();
    state.hover = null;
    state.selection = null;
    state.contextSelection = null;
    document.documentElement.style.cursor = "";
    document.documentElement.style.userSelect = "";
  }
  function cssEscapeIdent(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
  function elementIndex(el) {
    var index = 1;
    var previous = el.previousElementSibling;
    while (previous) {
      if (previous.tagName === el.tagName) index += 1;
      previous = previous.previousElementSibling;
    }
    return index;
  }
  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) return el.tagName.toLowerCase() + "#" + cssEscapeIdent(el.id);
    var part = el.tagName.toLowerCase();
    var cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean)[0] : "";
    if (cls) part += "." + cssEscapeIdent(cls);
    if (el.parentElement && Array.prototype.filter.call(el.parentElement.children, function (child) { return child.tagName === el.tagName; }).length > 1) {
      part += ":nth-of-type(" + elementIndex(el) + ")";
    }
    return part;
  }
  function buildDomPath(el) {
    var parts = [];
    var current = el;
    while (current && current.nodeType === 1 && current !== document.documentElement) {
      parts.unshift(selectorFor(current));
      current = current.parentElement;
      if (parts.length >= 6) break;
    }
    return parts.filter(Boolean).join(" > ");
  }
  function buildJsPath(el) {
    var parts = [];
    var current = el;
    while (current && current.nodeType === 1 && current !== document.documentElement) {
      var parent = current.parentElement;
      if (!parent) break;
      var index = Array.prototype.indexOf.call(parent.children, current);
      parts.unshift("children[" + index + "]");
      current = parent;
      if (parts.length >= 8) break;
    }
    return "document.documentElement." + parts.join(".");
  }
  function accessibleName(el) {
    return el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("title") || trimText(el.textContent, 80) || null;
  }
  function describe(el) {
    var tag = el.tagName ? el.tagName.toLowerCase() : "element";
    if (el.id) return tag + "#" + el.id;
    var cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
    return cls ? tag + "." + cls : tag;
  }
  function buildSelection(el, anchorPoint) {
    var rect = el.getBoundingClientRect();
    var computed = window.getComputedStyle ? window.getComputedStyle(el) : null;
    var font = computed ? [computed.fontSize, computed.fontFamily].filter(Boolean).join(" ") : null;
    var selection = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      label: describe(el),
      capturedAt: Date.now()
    };
    function addOptional(key, value) {
      if (value !== null && value !== undefined && value !== "") selection[key] = value;
    }
    addOptional("tagName", el.tagName ? el.tagName.toLowerCase() : null);
    addOptional("selector", selectorFor(el));
    addOptional("jsPath", buildJsPath(el));
    addOptional("domPath", buildDomPath(el));
    addOptional("textPreview", trimText(el.textContent, 140));
    addOptional("role", el.getAttribute("role"));
    addOptional("accessibleName", accessibleName(el));
    addOptional("pageUrl", location.href);
    addOptional("pageTitle", document.title || null);
    addOptional("sourceHint", el.getAttribute("data-source-location") || el.getAttribute("data-source") || el.getAttribute("data-oc-source") || null);
    addOptional("computedColor", computed ? computed.color : null);
    addOptional("computedFont", font);
    addOptional("anchorX", anchorPoint ? Math.round(anchorPoint.x) : null);
    addOptional("anchorY", anchorPoint ? Math.round(anchorPoint.y) : null);
    return selection;
  }
  function selectableFromPoint(x, y) {
    var list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
    var pageRoot = null;
    for (var i = 0; i < list.length; i += 1) {
      var el = list[i];
      if (!el || el === root || (root && root.contains(el))) continue;
      if (el === document.documentElement || el === document.body) {
        if (!pageRoot) pageRoot = el;
        continue;
      }
      if (el.getBoundingClientRect) return el;
    }
    return pageRoot;
  }
  function showPointerHint(x, y) {
    if (!state.presentation || state.enabled || commentOpen() || contextMenuOpen()) return;
    ensureRoot();
    if (!pointerHint) return;
    var left = Math.min(Math.max(8, x + 12), Math.max(8, window.innerWidth - 228));
    var top = y + 38 < window.innerHeight ? y + 14 : Math.max(8, y - 34);
    pointerHint.textContent = state.presentation.labels.contextHint;
    pointerHint.style.left = px(left);
    pointerHint.style.top = px(top);
    pointerHint.style.display = "block";
  }
  function schedulePointerHint(evt) {
    clearPointerHint();
    if (!state.presentation || state.enabled || commentOpen() || contextMenuOpen()) return;
    var x = evt.clientX;
    var y = evt.clientY;
    state.pointerTimer = window.setTimeout(function () {
      state.pointerTimer = null;
      if (selectableFromPoint(x, y)) showPointerHint(x, y);
    }, 1500);
  }
  function renderHover(selection) {
    ensureRoot();
    if (!outline || !hud || !selection) return;
    outline.style.display = "block";
    outline.style.left = px(selection.x);
    outline.style.top = px(selection.y);
    outline.style.width = px(selection.width);
    outline.style.height = px(selection.height);
    var left = Math.min(Math.max(12, selection.x + 28), Math.max(12, window.innerWidth - 572));
    var below = selection.y + selection.height + 14;
    var top = below + 160 < window.innerHeight ? below : Math.max(12, selection.y - 180);
    hud.style.display = "block";
    hud.style.left = px(left);
    hud.style.top = px(top);
    hud.innerHTML = "<div style='display:flex;justify-content:space-between;gap:24px;font-weight:700;font-size:18px;margin-bottom:12px'><span>" + selection.label + "</span><span>" + selection.width + "×" + selection.height + "</span></div>" +
      "<div style='display:grid;grid-template-columns:72px minmax(0,1fr);gap:6px 20px;color:var(--oc-annotation-text-muted)'><span>" + label("color") + "</span><code style='color:var(--oc-annotation-text);font:600 13px ui-monospace,Menlo,monospace'>" + (selection.computedColor || "…") + "</code><span>" + label("font") + "</span><code style='color:var(--oc-annotation-text);font:600 13px ui-monospace,Menlo,monospace'>" + (selection.computedFont || "…") + "</code><span>" + label("source") + "</span><code style='color:var(--oc-annotation-text);font:600 12px ui-monospace,Menlo,monospace;white-space:normal'>" + (selection.sourceHint || selection.domPath || "DOM") + "</code></div>";
  }
  function onPointerMove(evt) {
    if (!state.enabled) {
      schedulePointerHint(evt);
      return;
    }
    clearPointerHint();
    var el = selectableFromPoint(evt.clientX, evt.clientY);
    if (!el) { clearVisuals(); state.hover = null; return; }
    var selection = buildSelection(el, { x: evt.clientX, y: evt.clientY });
    state.hover = selection;
    renderHover(selection);
  }
  function onPointerDown(evt) {
    clearPointerHint();
    if (contextMenuOpen()) {
      if (eventInside(contextMenu, evt)) return;
      hideContextMenu();
    }
    if (!state.enabled) return;
    evt.preventDefault();
    evt.stopPropagation();
  }
  // After a click, keep the outline and swap the hover HUD for an in-guest
  // comment panel. Because the native child webview is an OS-level window that
  // z-orders above the host page, the comment UI must live INSIDE the webview
  // (matching open-mirror-app's DOM overlay) so the live preview stays visible.
  function showCommentPanel(selection) {
    ensureRoot();
    if (!outline || !panel || !selection) return;
    outline.style.display = "block";
    outline.style.left = px(selection.x);
    outline.style.top = px(selection.y);
    outline.style.width = px(selection.width);
    outline.style.height = px(selection.height);
    if (hud) hud.style.display = "none";
    var left = Math.min(Math.max(12, selection.x), Math.max(12, window.innerWidth - 372));
    var below = selection.y + selection.height + 14;
    var top = below + 260 < window.innerHeight ? below : Math.max(12, selection.y - 274);
    panel.style.display = "block";
    panel.style.left = px(left);
    panel.style.top = px(top);
    var pageValue = selection.pageTitle || selection.pageUrl || "…";
    var targetValue = selection.textPreview || selection.label;
    var sourceValue = selection.sourceHint || selection.domPath || selection.selector || "DOM";
    panel.innerHTML =
      "<div style='font-weight:700;font-size:15px;margin-bottom:12px'>#1 " + esc(selection.label) + "</div>" +
      "<div style='display:grid;grid-template-columns:52px minmax(0,1fr);gap:6px 16px;color:var(--oc-annotation-text-muted);margin-bottom:12px'>" +
      "<span>" + label("page") + "</span><span style='color:var(--oc-annotation-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>" + esc(pageValue) + "</span>" +
      "<span>" + label("target") + "</span><span style='color:var(--oc-annotation-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>" + esc(targetValue) + "</span>" +
      "<span>" + label("source") + "</span><code style='color:var(--oc-annotation-text);font:600 12px ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>" + esc(sourceValue) + "</code>" +
      "</div>" +
      "<textarea id='__oc_preview_comment__' rows='3' aria-label='" + label("label") + "' placeholder='" + label("placeholder") + "' style='width:100%;box-sizing:border-box;resize:vertical;min-height:76px;border-radius:12px;border:1px solid var(--oc-annotation-border);background:var(--oc-annotation-surface-inset);color:var(--oc-annotation-text);padding:10px 12px;font-size:13px;line-height:1.5;outline:none'></textarea>" +
      "<div style='display:flex;justify-content:flex-end;gap:10px;margin-top:12px'>" +
      "<button id='__oc_preview_cancel__' type='button' style='cursor:pointer;border:none;background:transparent;color:var(--oc-annotation-text-muted);font-size:13px;font-weight:600;padding:8px 10px'>" + label("cancel") + "</button>" +
      "<button id='__oc_preview_send__' type='button' style='cursor:pointer;border:none;border-radius:10px;background:var(--oc-annotation-surface-hover);color:var(--oc-annotation-text);font-size:13px;font-weight:700;padding:8px 14px'>" + label("send") + "</button>" +
      "</div>";
    var textarea = panel.querySelector("#__oc_preview_comment__");
    var cancelBtn = panel.querySelector("#__oc_preview_cancel__");
    var sendBtn = panel.querySelector("#__oc_preview_send__");
    if (textarea) { try { textarea.focus(); } catch (err) {} }
    function submit() {
      var comment = textarea && typeof textarea.value === "string" ? textarea.value.trim() : "";
      if (!comment) { if (textarea) { try { textarea.focus(); } catch (err) {} } return; }
      var payloadSelection = state.selection || selection;
      cleanup();
      publishResult({ kind: "comment", selection: payloadSelection, comment: comment });
    }
    function cancel() {
      cleanup();
      publishResult({ kind: "canceled" });
    }
    if (cancelBtn) cancelBtn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); cancel(); }, true);
    if (sendBtn) sendBtn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); submit(); }, true);
    if (textarea) {
      textarea.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
        else if (e.key === "Escape") { e.preventDefault(); cancel(); }
      }, true);
    }
  }
  function commentOpen() { return !!(panel && panel.style.display !== "none"); }
  function showContextMenu(selection, x, y) {
    ensureRoot();
    if (!contextMenu || !state.presentation) return;
    contextMenu.innerHTML = "<button type='button' role='menuitem' class='oc-annotation-menu-item'>" + label("annotate") + "</button>";
    contextMenu.style.visibility = "hidden";
    contextMenu.style.display = "block";
    var bounds = contextMenu.getBoundingClientRect();
    var left = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - bounds.width - 8));
    var top = Math.min(Math.max(8, y), Math.max(8, window.innerHeight - bounds.height - 8));
    contextMenu.style.left = px(left);
    contextMenu.style.top = px(top);
    contextMenu.style.visibility = "visible";
    var annotate = contextMenu.querySelector("button");
    if (annotate) {
      annotate.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        hideContextMenu();
        state.selection = selection;
        state.contextSelection = selection;
        state.contextRequested = true;
        showCommentPanel(selection);
      }, true);
      try { annotate.focus(); } catch (err) {}
    }
  }
  function onContextMenu(evt) {
    if (commentOpen()) {
      evt.preventDefault();
      evt.stopPropagation();
      return;
    }
    if (!state.presentation) return;
    var el = selectableFromPoint(evt.clientX, evt.clientY);
    if (!el) return;
    evt.preventDefault();
    evt.stopPropagation();
    clearPointerHint();
    state.contextSelection = buildSelection(el, { x: evt.clientX, y: evt.clientY });
    showContextMenu(state.contextSelection, evt.clientX, evt.clientY);
  }
  function onClick(evt) {
    if (commentOpen()) {
      // Clicks inside the comment panel are handled by its own listeners; block
      // page clicks so a picked node cannot be re-triggered underneath.
      if (eventInside(panel, evt)) return;
      evt.preventDefault();
      evt.stopPropagation();
      return;
    }
    if (!state.enabled) return;
    evt.preventDefault();
    evt.stopPropagation();
    var el = selectableFromPoint(evt.clientX, evt.clientY);
    if (!el) return;
    var selection = buildSelection(el, { x: evt.clientX, y: evt.clientY });
    state.enabled = false;
    state.hover = null;
    state.selection = selection;
    document.documentElement.style.cursor = "";
    document.documentElement.style.userSelect = "";
    showCommentPanel(selection);
  }
  function onKeyDown(evt) {
    if (evt.key !== "Escape") return;
    if (contextMenuOpen()) {
      evt.preventDefault();
      evt.stopPropagation();
      hideContextMenu();
      return;
    }
    if (commentOpen()) {
      evt.preventDefault();
      evt.stopPropagation();
      cleanup();
      publishResult({ kind: "canceled" });
      return;
    }
    if (!state.enabled) return;
    evt.preventDefault();
    evt.stopPropagation();
    state.enabled = false;
    cleanup();
    publishResult({ kind: "canceled" });
  }
  function setEnabled(value, presentation) {
    state.enabled = !!value;
    if (presentation) applyPresentation(presentation);
    if (state.enabled) {
      if (commentOpen()) {
        state.enabled = false;
        return;
      }
      // A fast passive right-click submission can complete before the host has
      // armed its pull owner. Preserve that completed payload so the ensuing
      // host poll drains the exact same result as toolbar-driven selection.
      if (hasPublishedResult()) {
        state.enabled = false;
        return;
      }
      try { window.__OPENCORVUS_PREVIEW_SELECTION_RESULT__ = ""; } catch (err) {}
      cleanup();
      ensureRoot();
      document.documentElement.style.cursor = "crosshair";
      document.documentElement.style.userSelect = "none";
    } else if (!commentOpen()) {
      cleanup();
    }
  }
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("blur", clearPointerHint, true);
  document.addEventListener("mouseleave", clearPointerHint, true);
  window.__OPENCORVUS_PREVIEW_SELECTION__ = {
    setEnabled: setEnabled,
    takeContextRequest: function () {
      var requested = state.contextRequested;
      state.contextRequested = false;
      return requested;
    },
    interactionReady: function () { return !!state.presentation; }
  };
})();
"###;
#[derive(Clone, Debug, PartialEq, Eq)]
struct BrowserPreviewScopeOwner {
    scope_key: String,
    generation: u64,
}

#[derive(Default)]
struct BrowserPreviewScopeState {
    active: Option<BrowserPreviewScopeOwner>,
    next_generation: u64,
}

static BROWSER_PREVIEW_SCOPES: OnceLock<
    Mutex<HashMap<String, Arc<Mutex<BrowserPreviewScopeState>>>>,
> = OnceLock::new();

fn browser_preview_scope_state(
    surface_id: &str,
) -> Result<Arc<Mutex<BrowserPreviewScopeState>>, String> {
    let mut scopes = BROWSER_PREVIEW_SCOPES
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|err| err.to_string())?;
    Ok(scopes
        .entry(surface_id.to_string())
        .or_insert_with(|| Arc::new(Mutex::new(BrowserPreviewScopeState::default())))
        .clone())
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct BrowserPreviewCallbackOwner {
    scope: BrowserPreviewScopeOwner,
    request_id: u64,
}

struct BrowserPreviewCallbackStore<T> {
    next_request_id: u64,
    pending: Option<BrowserPreviewCallbackOwner>,
    completion: Option<(BrowserPreviewCallbackOwner, Result<T, String>)>,
}

impl<T> Default for BrowserPreviewCallbackStore<T> {
    fn default() -> Self {
        Self {
            next_request_id: 0,
            pending: None,
            completion: None,
        }
    }
}

impl<T> BrowserPreviewCallbackStore<T> {
    fn begin(
        &mut self,
        scope: &BrowserPreviewScopeOwner,
    ) -> Result<Option<BrowserPreviewCallbackOwner>, String> {
        if self
            .pending
            .as_ref()
            .is_some_and(|owner| owner.scope == *scope)
        {
            return Ok(None);
        }
        self.pending = None;
        self.completion = None;
        self.next_request_id = self
            .next_request_id
            .checked_add(1)
            .ok_or_else(|| "browser preview callback request ID overflowed".to_string())?;
        let owner = BrowserPreviewCallbackOwner {
            scope: scope.clone(),
            request_id: self.next_request_id,
        };
        self.pending = Some(owner.clone());
        Ok(Some(owner))
    }

    fn complete(&mut self, owner: &BrowserPreviewCallbackOwner, completion: Result<T, String>) {
        if self.pending.as_ref() != Some(owner) {
            return;
        }
        self.pending = None;
        self.completion = Some((owner.clone(), completion));
    }

    fn take(&mut self, scope: &BrowserPreviewScopeOwner) -> Option<Result<T, String>> {
        let belongs_to_scope = self
            .completion
            .as_ref()
            .is_some_and(|(owner, _)| owner.scope == *scope);
        if belongs_to_scope {
            return self.completion.take().map(|(_, completion)| completion);
        }
        self.completion = None;
        None
    }

    fn cancel(&mut self, owner: &BrowserPreviewCallbackOwner) {
        if self.pending.as_ref() == Some(owner) {
            self.pending = None;
        }
    }

    fn clear(&mut self) {
        self.pending = None;
        self.completion = None;
    }
}

fn browser_preview_callback_start_failed<T>(
    store: &Mutex<BrowserPreviewCallbackStore<T>>,
    owner: &BrowserPreviewCallbackOwner,
    error: String,
) -> Result<Option<T>, String> {
    store.lock().map_err(|err| err.to_string())?.cancel(owner);
    Err(error)
}
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

include!(concat!(env!("OUT_DIR"), "/embedded_sidecar.rs"));

#[derive(Clone, Copy, Debug, PartialEq)]
struct OverlayWindowSize {
    width: f64,
    height: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct OverlayWindowPosition {
    x: f64,
    y: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct OverlayWindowPlacement {
    size: OverlayWindowSize,
    position: OverlayWindowPosition,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OverlayWindowPlacementConfig {
    initial_work_area_ratio: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct OverlayWindowConstraints {
    min_size: OverlayWindowSize,
    min_aspect_ratio: f64,
}

fn overlay_window_constraints(min_size: OverlayWindowSize) -> OverlayWindowConstraints {
    OverlayWindowConstraints {
        min_size,
        min_aspect_ratio: min_size.width / min_size.height,
    }
}

fn overlay_main_size_constraints(
    config: &tauri::utils::config::Config,
) -> OverlayWindowConstraints {
    let main_window = config
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .expect("main window config must exist");
    let min_size = OverlayWindowSize {
        width: main_window
            .min_width
            .expect("main window config must set minWidth"),
        height: main_window
            .min_height
            .expect("main window config must set minHeight"),
    };
    let configured_size = OverlayWindowSize {
        width: main_window.width,
        height: main_window.height,
    };
    if configured_size.width < min_size.width {
        panic!("main window config width must be greater than or equal to minWidth");
    }
    if configured_size.height < min_size.height {
        panic!("main window config height must be greater than or equal to minHeight");
    }
    overlay_window_constraints(min_size)
}

fn overlay_window_placement_config(
    config: &tauri::utils::config::Config,
) -> Result<OverlayWindowPlacementConfig, String> {
    let value = config
        .plugins
        .0
        .get("opencorvus")
        .ok_or_else(|| "Tauri config must define plugins.opencorvus".to_string())?;
    let placement: OverlayWindowPlacementConfig = serde_json::from_value(value.clone())
        .map_err(|error| format!("invalid Tauri plugins.opencorvus config: {error}"))?;
    if !placement.initial_work_area_ratio.is_finite()
        || !(0.0..=1.0).contains(&placement.initial_work_area_ratio)
        || placement.initial_work_area_ratio == 0.0
    {
        return Err(
            "plugins.opencorvus.initialWorkAreaRatio must be greater than 0 and at most 1"
                .to_string(),
        );
    }
    Ok(placement)
}

fn overlay_main_window_placement<R: Runtime>(
    app: &tauri::App<R>,
    constraints: OverlayWindowConstraints,
) -> Result<OverlayWindowPlacement, String> {
    let placement_config = overlay_window_placement_config(app.config())?;
    let monitor = app
        .primary_monitor()
        .map_err(|error| format!("failed to read the primary monitor: {error}"))?
        .ok_or_else(|| "primary monitor is unavailable".to_string())?;
    let scale_factor = monitor.scale_factor();
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return Err(format!(
            "primary monitor reported invalid scale factor {scale_factor}"
        ));
    }

    let work_area = monitor.work_area();
    let work_size = OverlayWindowSize {
        width: f64::from(work_area.size.width) / scale_factor,
        height: f64::from(work_area.size.height) / scale_factor,
    };
    if work_size.width < constraints.min_size.width
        || work_size.height < constraints.min_size.height
    {
        return Err(format!(
            "primary monitor work area {:.0}x{:.0} cannot contain the legal Overlay minimum {:.0}x{:.0}",
            work_size.width,
            work_size.height,
            constraints.min_size.width,
            constraints.min_size.height,
        ));
    }

    let size = OverlayWindowSize {
        width: (work_size.width * placement_config.initial_work_area_ratio)
            .max(constraints.min_size.width),
        height: (work_size.height * placement_config.initial_work_area_ratio)
            .max(constraints.min_size.height),
    };
    let work_origin = OverlayWindowPosition {
        x: f64::from(work_area.position.x) / scale_factor,
        y: f64::from(work_area.position.y) / scale_factor,
    };
    Ok(OverlayWindowPlacement {
        size,
        position: OverlayWindowPosition {
            x: work_origin.x + (work_size.width - size.width) / 2.0,
            y: work_origin.y + (work_size.height - size.height) / 2.0,
        },
    })
}

fn overlay_min_aspect_ratio(constraints: OverlayWindowConstraints) -> f64 {
    constraints.min_aspect_ratio
}

#[cfg(windows)]
#[derive(Clone, Copy, Debug, PartialEq)]
struct OverlayResizeRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[cfg(windows)]
impl OverlayResizeRect {
    fn width(self) -> i32 {
        self.right - self.left
    }

    fn height(self) -> i32 {
        self.bottom - self.top
    }
}

#[cfg(windows)]
#[derive(Clone, Copy, Debug, PartialEq)]
struct OverlayMaximizedBounds {
    position_x: i32,
    position_y: i32,
    width: i32,
    height: i32,
}

#[cfg(windows)]
fn overlay_maximized_bounds_from_work_area(
    monitor: OverlayResizeRect,
    work_area: OverlayResizeRect,
) -> Option<OverlayMaximizedBounds> {
    let width = work_area.width();
    let height = work_area.height();
    if width <= 0 || height <= 0 {
        return None;
    }
    Some(OverlayMaximizedBounds {
        position_x: work_area.left - monitor.left,
        position_y: work_area.top - monitor.top,
        width,
        height,
    })
}

#[cfg(windows)]
unsafe fn apply_overlay_maximized_work_area(
    hwnd: windows_sys::Win32::Foundation::HWND,
    minmax: &mut windows_sys::Win32::UI::WindowsAndMessaging::MINMAXINFO,
) -> bool {
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    let monitor_handle = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    if monitor_handle.is_null() {
        return false;
    }
    let mut monitor_info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    if GetMonitorInfoW(monitor_handle, &mut monitor_info) == 0 {
        return false;
    }
    let Some(bounds) = overlay_maximized_bounds_from_work_area(
        OverlayResizeRect {
            left: monitor_info.rcMonitor.left,
            top: monitor_info.rcMonitor.top,
            right: monitor_info.rcMonitor.right,
            bottom: monitor_info.rcMonitor.bottom,
        },
        OverlayResizeRect {
            left: monitor_info.rcWork.left,
            top: monitor_info.rcWork.top,
            right: monitor_info.rcWork.right,
            bottom: monitor_info.rcWork.bottom,
        },
    ) else {
        return false;
    };
    minmax.ptMaxPosition.x = bounds.position_x;
    minmax.ptMaxPosition.y = bounds.position_y;
    minmax.ptMaxSize.x = bounds.width;
    minmax.ptMaxSize.y = bounds.height;
    true
}

#[cfg(windows)]
#[derive(Clone, Copy, Debug, PartialEq)]
enum OverlayResizeEdge {
    Left,
    Right,
    Top,
    TopLeft,
    TopRight,
    Bottom,
    BottomLeft,
    BottomRight,
}

#[cfg(windows)]
fn overlay_resize_edge_moves_left(edge: OverlayResizeEdge) -> bool {
    matches!(
        edge,
        OverlayResizeEdge::Left | OverlayResizeEdge::TopLeft | OverlayResizeEdge::BottomLeft
    )
}

#[cfg(windows)]
fn overlay_resize_edge_moves_top(edge: OverlayResizeEdge) -> bool {
    matches!(
        edge,
        OverlayResizeEdge::Top | OverlayResizeEdge::TopLeft | OverlayResizeEdge::TopRight
    )
}

#[cfg(windows)]
fn overlay_resize_edge_from_wparam(value: usize) -> Option<OverlayResizeEdge> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        WMSZ_BOTTOM, WMSZ_BOTTOMLEFT, WMSZ_BOTTOMRIGHT, WMSZ_LEFT, WMSZ_RIGHT, WMSZ_TOP,
        WMSZ_TOPLEFT, WMSZ_TOPRIGHT,
    };

    match value as u32 {
        WMSZ_LEFT => Some(OverlayResizeEdge::Left),
        WMSZ_RIGHT => Some(OverlayResizeEdge::Right),
        WMSZ_TOP => Some(OverlayResizeEdge::Top),
        WMSZ_TOPLEFT => Some(OverlayResizeEdge::TopLeft),
        WMSZ_TOPRIGHT => Some(OverlayResizeEdge::TopRight),
        WMSZ_BOTTOM => Some(OverlayResizeEdge::Bottom),
        WMSZ_BOTTOMLEFT => Some(OverlayResizeEdge::BottomLeft),
        WMSZ_BOTTOMRIGHT => Some(OverlayResizeEdge::BottomRight),
        _ => None,
    }
}

#[cfg(windows)]
fn constrain_overlay_resize_rect_to_minimum_aspect(
    rect: OverlayResizeRect,
    edge: OverlayResizeEdge,
    constraints: OverlayWindowConstraints,
) -> OverlayResizeRect {
    let mut next = rect;
    let min_size = constraints.min_size;
    let min_width = min_size.width.round() as i32;
    let min_height = min_size.height.round() as i32;
    if next.width() < min_width {
        if overlay_resize_edge_moves_left(edge) {
            next.left = next.right - min_width;
        } else {
            next.right = next.left + min_width;
        }
    }
    if next.height() < min_height {
        if overlay_resize_edge_moves_top(edge) {
            next.top = next.bottom - min_height;
        } else {
            next.bottom = next.top + min_height;
        }
    }

    let max_height = (next.width() as f64 / overlay_min_aspect_ratio(constraints))
        .round()
        .max(min_size.height) as i32;
    if next.height() > max_height {
        if overlay_resize_edge_moves_top(edge) {
            next.top = next.bottom - max_height;
        } else {
            next.bottom = next.top + max_height;
        }
    }

    next
}

#[cfg(windows)]
struct OverlayWindowGeometryState {
    constraints: OverlayWindowConstraints,
}

#[cfg(windows)]
static OVERLAY_WINDOW_GEOMETRY_STATE: OnceLock<OverlayWindowGeometryState> = OnceLock::new();

#[cfg(windows)]
const OVERLAY_WINDOW_GEOMETRY_SUBCLASS_ID: usize = 0x0C0A_5A51;

#[cfg(windows)]
unsafe extern "system" fn overlay_window_geometry_subclass_proc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows_sys::Win32::Foundation::WPARAM,
    lparam: windows_sys::Win32::Foundation::LPARAM,
    subclass_id: usize,
    ref_data: usize,
) -> windows_sys::Win32::Foundation::LRESULT {
    use windows_sys::Win32::{
        Foundation::RECT,
        UI::{
            Shell::{DefSubclassProc, RemoveWindowSubclass},
            WindowsAndMessaging::{MINMAXINFO, WM_GETMINMAXINFO, WM_NCDESTROY, WM_SIZING},
        },
    };

    // WM_GETMINMAXINFO (Window Message Get Minimum/Maximum Information)
    // is the Win32 pre-commit owner for taskbar-aware maximized geometry.
    if msg == WM_GETMINMAXINFO {
        let default_result = DefSubclassProc(hwnd, msg, wparam, lparam);
        let minmax = &mut *(lparam as *mut MINMAXINFO);
        apply_overlay_maximized_work_area(hwnd, minmax);
        return default_result;
    }

    if msg == WM_SIZING {
        let state = &*(ref_data as *const OverlayWindowGeometryState);
        if let Some(edge) = overlay_resize_edge_from_wparam(wparam) {
            let rect = &mut *(lparam as *mut RECT);
            let constrained = constrain_overlay_resize_rect_to_minimum_aspect(
                OverlayResizeRect {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                },
                edge,
                state.constraints,
            );
            rect.left = constrained.left;
            rect.top = constrained.top;
            rect.right = constrained.right;
            rect.bottom = constrained.bottom;
            return 1;
        }
    }

    if msg == WM_NCDESTROY {
        RemoveWindowSubclass(
            hwnd,
            Some(overlay_window_geometry_subclass_proc),
            subclass_id,
        );
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

#[cfg(windows)]
fn install_overlay_window_geometry_constraints<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    constraints: OverlayWindowConstraints,
) -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::SetWindowSubclass;

    let state =
        OVERLAY_WINDOW_GEOMETRY_STATE.get_or_init(|| OverlayWindowGeometryState { constraints });
    let hwnd = window.hwnd().map_err(|err| err.to_string())?;
    let ok = unsafe {
        SetWindowSubclass(
            hwnd.0 as _,
            Some(overlay_window_geometry_subclass_proc),
            OVERLAY_WINDOW_GEOMETRY_SUBCLASS_ID,
            state as *const OverlayWindowGeometryState as usize,
        )
    };
    if ok == 0 {
        return Err("failed to install overlay window geometry constraints".to_string());
    }
    Ok(())
}

// ── Windows: Job Object with KILL_ON_JOB_CLOSE ──────────────────────────────
//
// When the overlay exits (even on crash), closing the last handle to the job
// object causes Windows to terminate every process in the job — including all
// grandchildren spawned by the Bun server (LSP servers, PTY shells, etc.).
#[cfg(windows)]
mod job_object {
    use std::ffi::c_void;

    pub type HANDLE = *mut c_void;
    const INVALID_HANDLE_VALUE: HANDLE = -1isize as HANDLE;

    // JOBOBJECTINFOCLASS::JobObjectExtendedLimitInformation = 9
    const EXTENDED_LIMIT_INFO_CLASS: u32 = 9;
    // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    const KILL_ON_CLOSE: u32 = 0x00002000;

    #[repr(C)]
    struct IoCounters {
        read_op: u64,
        write_op: u64,
        other_op: u64,
        read_xfer: u64,
        write_xfer: u64,
        other_xfer: u64,
    }

    #[repr(C)]
    struct BasicLimitInfo {
        per_process_time: i64,
        per_job_time: i64,
        limit_flags: u32,
        min_ws: usize,
        max_ws: usize,
        active_process_limit: u32,
        affinity: usize,
        priority_class: u32,
        scheduling_class: u32,
    }

    #[repr(C)]
    struct ExtendedLimitInfo {
        basic: BasicLimitInfo,
        io: IoCounters,
        process_mem_limit: usize,
        job_mem_limit: usize,
        peak_process_mem: usize,
        peak_job_mem: usize,
    }

    extern "system" {
        fn CreateJobObjectW(attrs: *const c_void, name: *const u16) -> HANDLE;
        fn SetInformationJobObject(job: HANDLE, class: u32, info: *const c_void, len: u32) -> i32;
        fn AssignProcessToJobObject(job: HANDLE, process: HANDLE) -> i32;
        fn CloseHandle(handle: HANDLE) -> i32;
    }

    /// Owns a Windows Job Object handle. Dropping closes the handle, which
    /// triggers KILL_ON_JOB_CLOSE and terminates the entire process tree.
    pub struct JobObject(HANDLE);

    impl Drop for JobObject {
        fn drop(&mut self) {
            if !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE {
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }

    // HANDLE is just a pointer but we only ever use it from within a Mutex.
    unsafe impl Send for JobObject {}
    unsafe impl Sync for JobObject {}

    fn close_failed_job(job: HANDLE, error: String) -> String {
        let closed = unsafe { CloseHandle(job) };
        if closed == 0 {
            return format!(
                "{error}; CloseHandle failed: {}",
                std::io::Error::last_os_error()
            );
        }
        error
    }

    /// Creates a kill-on-close job object and assigns `child_handle` to it.
    pub fn create_and_assign(child_handle: HANDLE) -> Result<JobObject, String> {
        let job = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if job.is_null() || job == INVALID_HANDLE_VALUE {
            return Err(format!(
                "CreateJobObjectW failed: {}",
                std::io::Error::last_os_error()
            ));
        }
        let info = ExtendedLimitInfo {
            basic: BasicLimitInfo {
                limit_flags: KILL_ON_CLOSE,
                // SAFETY: all other fields are zero/null, which is valid.
                ..unsafe { std::mem::zeroed() }
            },
            // SAFETY: zero-initialised remaining fields are valid.
            ..unsafe { std::mem::zeroed() }
        };
        let ok = unsafe {
            SetInformationJobObject(
                job,
                EXTENDED_LIMIT_INFO_CLASS,
                &info as *const _ as *const c_void,
                std::mem::size_of::<ExtendedLimitInfo>() as u32,
            )
        };
        if ok == 0 {
            let error = format!(
                "SetInformationJobObject failed: {}",
                std::io::Error::last_os_error()
            );
            return Err(close_failed_job(job, error));
        }
        let assigned = unsafe { AssignProcessToJobObject(job, child_handle) };
        if assigned == 0 {
            let error = format!(
                "AssignProcessToJobObject failed: {}",
                std::io::Error::last_os_error()
            );
            return Err(close_failed_job(job, error));
        }
        Ok(JobObject(job))
    }
}

// ── Unix: process-group kill ─────────────────────────────────────────────────
//
// The child is spawned with process_group(0), making it a process group leader.
// All grandchildren inherit the group. On shutdown we send SIGKILL to the
// entire group via kill(-pgid, SIGKILL).
#[cfg(unix)]
extern "C" {
    fn kill(pid: i32, sig: i32) -> i32;
}

#[derive(Default)]
struct ServerState {
    child: Option<Child>,
    port: Option<u16>,
    sidecar_log_path: Option<PathBuf>,
    payload_lease: Option<EmbeddedPayloadLease>,
    process_occurrence: Option<ManagedProcessOccurrence>,
    /// Windows: Job Object that auto-kills all job members on drop.
    #[cfg(windows)]
    job: Option<job_object::JobObject>,
    /// Unix: process group ID of the server (== child PID after process_group(0)).
    #[cfg(unix)]
    pgid: Option<u32>,
}

#[derive(Clone)]
struct ManagedProcessOccurrence {
    id: String,
    supervisor_observation_id: String,
    path: PathBuf,
    started_at_ms: u128,
    parent_pid: u32,
    port: u16,
    pid: Option<u32>,
    predecessor_id: Option<String>,
    predecessor_path: Option<PathBuf>,
    executable_path: PathBuf,
    sidecar_log_path: PathBuf,
    shutdown_request_path: PathBuf,
}

#[derive(Serialize)]
struct ManagedProcessOccurrenceEnvelope {
    schema_version: u8,
    supervisor_observation_id: String,
    process_occurrence_id: String,
    predecessor_process_occurrence_id: Option<String>,
    predecessor_envelope_path: Option<String>,
    parent_pid: u32,
    port: u16,
    pid: Option<u32>,
    started_at_ms: u128,
    executable_path: String,
    build_identity: String,
    sidecar_log_path: String,
    state: String,
    shutdown_source: Option<String>,
    shutdown_reason: Option<String>,
    exit_code: Option<i32>,
    exit_signal: Option<i32>,
    terminal_at_ms: Option<u128>,
}

#[derive(Serialize, Deserialize)]
struct ManagedProcessOccurrenceLocator {
    schema_version: u8,
    process_occurrence_id: String,
    envelope_path: String,
}

#[derive(Deserialize)]
struct ManagedProcessShutdownRequest {
    schema_version: u8,
    process_occurrence_id: String,
    source: String,
    reason: String,
    requested_at_ms: u128,
}

struct Server {
    state: Mutex<ServerState>,
    operation: Mutex<()>,
    worker: StartupWorker,
}

#[derive(Default)]
struct PendingExpertSquadInstallHandoff(Mutex<Option<String>>);

fn accept_expert_squad_install_handoff<R: Runtime>(app: &AppHandle<R>, raw: &str) {
    let parsed = match tauri::Url::parse(raw) {
        Ok(value)
            if value.scheme() == "opencorvus"
                && value.host_str() == Some("expert-squad")
                && value.path() == "/install" =>
        {
            value
        }
        _ => return,
    };
    let raw = parsed.to_string();
    *app.state::<PendingExpertSquadInstallHandoff>()
        .0
        .lock()
        .unwrap() = Some(raw.clone());
    let _ = app.emit_to("main", EXPERT_SQUAD_INSTALL_HANDOFF_EVENT, raw);
    if let Some(window) = app.get_webview_window("main") {
        show_window(&window);
    }
}

impl Default for Server {
    fn default() -> Self {
        Self {
            state: Mutex::new(ServerState::default()),
            operation: Mutex::new(()),
            worker: StartupWorker::default(),
        }
    }
}

struct PreparedDesktopUpdate {
    update: Update,
    bytes: Vec<u8>,
}

struct DesktopUpdateCoordinator {
    busy: Arc<AtomicBool>,
    prepared: Mutex<Option<PreparedDesktopUpdate>>,
}

impl Default for DesktopUpdateCoordinator {
    fn default() -> Self {
        Self {
            busy: Arc::new(AtomicBool::new(false)),
            prepared: Mutex::new(None),
        }
    }
}

impl DesktopUpdateCoordinator {
    fn begin(&self) -> Result<DesktopUpdateOperation, DesktopUpdateCommandError> {
        self.busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| {
                DesktopUpdateCommandError::new(
                    "DESKTOP_UPDATE_BUSY",
                    "Another desktop update operation is already running.",
                )
            })?;
        Ok(DesktopUpdateOperation {
            busy: self.busy.clone(),
        })
    }
}

struct DesktopUpdateOperation {
    busy: Arc<AtomicBool>,
}

impl Drop for DesktopUpdateOperation {
    fn drop(&mut self) {
        self.busy.store(false, Ordering::Release);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopUpdateCommandError {
    code: &'static str,
    message: String,
}

impl DesktopUpdateCommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopUpdateInfo {
    current_version: String,
    available: bool,
    version: Option<String>,
    notes: Option<String>,
    publication_date: Option<String>,
    downloaded_bytes: Option<u64>,
}

impl DesktopUpdateInfo {
    fn current() -> Self {
        Self {
            current_version: env!("CARGO_PKG_VERSION").to_string(),
            available: false,
            version: None,
            notes: None,
            publication_date: None,
            downloaded_bytes: None,
        }
    }

    fn available(update: &Update, downloaded_bytes: Option<u64>) -> Self {
        Self {
            current_version: update.current_version.clone(),
            available: true,
            version: Some(update.version.clone()),
            notes: update.body.clone(),
            publication_date: update.date.map(|date| date.to_string()),
            downloaded_bytes,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopUpdateProgress {
    version: String,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    finished: bool,
}

#[derive(Default)]
struct StartupWorker(Mutex<()>);

impl StartupWorker {
    fn execute<T>(&self, operation: impl FnOnce() -> T) -> T {
        let _worker = self.0.lock().unwrap();
        operation()
    }
}

fn with_prepared_server<C: ?Sized, P, T>(
    server: &Server,
    context: &mut C,
    prepare: impl FnOnce(&mut C) -> Result<P, String>,
    publish: impl FnOnce(&mut C, P) -> Result<T, String>,
) -> Result<T, String> {
    let prepared = prepare(context)?;
    let _operation = server.operation.lock().unwrap();
    publish(context, prepared)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct StartupProgress {
    phase: String,
    completed_bytes: u64,
    total_bytes: u64,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    log_path: Option<String>,
}

impl StartupProgress {
    fn extracting(total_bytes: u64, message: impl Into<String>) -> Self {
        Self::extraction_progress(0, total_bytes, message)
    }

    fn extraction_progress(
        completed_bytes: u64,
        total_bytes: u64,
        message: impl Into<String>,
    ) -> Self {
        Self {
            phase: "extracting".to_string(),
            completed_bytes,
            total_bytes,
            message: message.into(),
            log_path: None,
        }
    }

    fn starting(total_bytes: u64, message: impl Into<String>) -> Self {
        Self {
            phase: "starting".to_string(),
            completed_bytes: total_bytes,
            total_bytes,
            message: message.into(),
            log_path: None,
        }
    }

    fn ready(total_bytes: u64, message: impl Into<String>) -> Self {
        Self {
            phase: "ready".to_string(),
            completed_bytes: total_bytes,
            total_bytes,
            message: message.into(),
            log_path: None,
        }
    }

    fn failed(
        completed_bytes: u64,
        total_bytes: u64,
        message: impl Into<String>,
        log_path: Option<&Path>,
    ) -> Self {
        Self {
            phase: "failed".to_string(),
            completed_bytes,
            total_bytes,
            message: message.into(),
            log_path: log_path.map(|path| path.to_string_lossy().into_owned()),
        }
    }
}

struct ExtractedByteAccumulator {
    completed_bytes: u64,
    total_bytes: u64,
}

impl ExtractedByteAccumulator {
    fn new(total_bytes: u64) -> Self {
        Self {
            completed_bytes: 0,
            total_bytes,
        }
    }

    fn record_persisted_file(&mut self, entry_size: u64) -> u64 {
        self.completed_bytes += entry_size;
        self.completed_bytes
    }

    fn completed_bytes(&self) -> u64 {
        self.completed_bytes
    }

    fn total_bytes(&self) -> u64 {
        self.total_bytes
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OverlayServerInfo {
    port: u16,
    url: String,
    /// PID of the spawned sidecar `bun` process. Surfaced in the title-bar
    /// connection badge next to the port so an operator can `kill <pid>` /
    /// `lsof -p <pid>` without hunting through netstat or Activity Monitor.
    /// Optional because some callers populate it lazily — every live
    /// callsite goes through `server_info_with_pid` (the legacy
    /// pid-less `server_info` constructor was deleted as dead code).
    #[serde(skip_serializing_if = "Option::is_none")]
    pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sidecar_log_path: Option<String>,
}

fn deserialize_present_value<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    T::deserialize(deserializer).map(Some)
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OverlaySettings {
    server_url: String,
    auto_server: bool,
    password: String,
    username: String,
    init_git: bool,
    sidebar_collapsed: bool,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_present_value"
    )]
    sidebar_width: Option<u64>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_present_value"
    )]
    right_dock_width: Option<u64>,
    work_ledger_organization: String,
    work_ledger_sort: String,
    zoom: f64,
    theme: String,
    locale: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_present_value"
    )]
    directory: Option<String>,
    project_editor: String,
    preferred_project_editor: String,
    #[serde(
        rename = "workspaceTaskID",
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_present_value"
    )]
    workspace_task_id: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_present_value"
    )]
    workspace_directory: Option<String>,
    desktop_notifications: bool,
}

fn overlay_settings_filename() -> &'static str {
    "overlay.jsonc"
}

fn validate_overlay_settings(settings: OverlaySettings) -> Result<OverlaySettings, String> {
    for (name, value) in [
        ("serverUrl", settings.server_url.as_str()),
        ("username", settings.username.as_str()),
        ("theme", settings.theme.as_str()),
        ("locale", settings.locale.as_str()),
    ] {
        if value.trim().is_empty() {
            return Err(format!("overlay settings field `{name}` must not be blank"));
        }
    }
    if !["dark", "light", "system", "vscode-dark"].contains(&settings.theme.as_str()) {
        return Err("overlay settings theme is invalid".to_string());
    }
    if !["by-project", "one-list"].contains(&settings.work_ledger_organization.as_str()) {
        return Err("overlay settings workLedgerOrganization is invalid".to_string());
    }
    if !["priority", "updated", "manual"].contains(&settings.work_ledger_sort.as_str()) {
        return Err("overlay settings workLedgerSort is invalid".to_string());
    }
    for (name, value) in [
        ("projectEditor", settings.project_editor.as_str()),
        (
            "preferredProjectEditor",
            settings.preferred_project_editor.as_str(),
        ),
    ] {
        if !["vscode", "pycharm", "webstorm", "intellij", "cursor"].contains(&value) {
            return Err(format!(
                "overlay settings field `{name}` contains an invalid editor id"
            ));
        }
    }
    if !settings.zoom.is_finite() || !(0.8..=1.6).contains(&settings.zoom) {
        return Err("overlay settings zoom must be finite and between 0.8 and 1.6".to_string());
    }
    for (name, value) in [
        ("sidebarWidth", settings.sidebar_width),
        ("rightDockWidth", settings.right_dock_width),
    ] {
        if value.is_some_and(|width| !(1..=u32::MAX as u64).contains(&width)) {
            return Err(format!(
                "overlay settings field `{name}` must be a positive unsigned 32-bit integer"
            ));
        }
    }
    for (name, value) in [
        ("directory", settings.directory.as_deref()),
        ("workspaceTaskID", settings.workspace_task_id.as_deref()),
        (
            "workspaceDirectory",
            settings.workspace_directory.as_deref(),
        ),
    ] {
        if value.is_some_and(|candidate| candidate.trim().is_empty()) {
            return Err(format!("overlay settings field `{name}` must not be blank"));
        }
    }
    Ok(settings)
}

fn parse_overlay_settings_text(text: &str) -> Result<OverlaySettings, String> {
    json5::from_str(text)
        .map_err(|err| err.to_string())
        .and_then(validate_overlay_settings)
}

fn format_overlay_settings_text(settings: &OverlaySettings) -> Result<String, String> {
    serde_json::to_string_pretty(settings).map_err(|err| err.to_string())
}

fn write_overlay_settings_text_with<F>(path: &Path, text: &str, write: F) -> Result<(), String>
where
    F: FnOnce(&mut fs::File, &[u8]) -> std::io::Result<()>,
{
    let parent = path
        .parent()
        .ok_or_else(|| "overlay settings path has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|err| err.to_string())?;
    write(temporary.as_file_mut(), text.as_bytes()).map_err(|err| err.to_string())?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|err| err.to_string())?;
    temporary
        .persist(path)
        .map_err(|err| err.error.to_string())?;
    Ok(())
}

fn write_overlay_settings_text(path: &Path, text: &str) -> Result<(), String> {
    write_overlay_settings_text_with(path, text, |file, bytes| file.write_all(bytes))
}

fn overlay_settings_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    overlay_runtime_paths(app).map(|paths| paths.config_dir.join(overlay_settings_filename()))
}

#[tauri::command]
fn overlay_clipboard_read_text<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|error| format!("cannot read system clipboard text: {error}"))
}

#[tauri::command]
fn overlay_clipboard_write_text<R: Runtime>(app: AppHandle<R>, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|error| format!("cannot write system clipboard text: {error}"))
}

#[tauri::command]
fn overlay_settings_load<R: Runtime>(app: AppHandle<R>) -> Result<Option<OverlaySettings>, String> {
    let path = overlay_settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(path).map_err(|err| err.to_string())?;
    parse_overlay_settings_text(&text).map(Some)
}

#[tauri::command]
fn overlay_settings_save<R: Runtime>(
    app: AppHandle<R>,
    settings: OverlaySettings,
) -> Result<bool, String> {
    let path = overlay_settings_path(&app)?;
    let settings = validate_overlay_settings(settings)?;
    let text = format_overlay_settings_text(&settings)?;
    write_overlay_settings_text(&path, &text)?;
    Ok(true)
}

#[tauri::command]
fn overlay_expert_squad_install_handoff_take(
    pending: tauri::State<'_, PendingExpertSquadInstallHandoff>,
) -> Option<String> {
    pending.0.lock().unwrap().take()
}

#[tauri::command]
fn overlay_open_path<R: Runtime>(app: AppHandle<R>, path: String) -> Result<bool, String> {
    if path.trim().is_empty() {
        return Ok(false);
    }

    app.opener()
        .open_path(path, None::<&str>)
        .map(|_| true)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn overlay_open_url<R: Runtime>(app: AppHandle<R>, url: String) -> Result<bool, String> {
    if url.trim().is_empty() {
        return Ok(false);
    }

    app.opener()
        .open_url(url, None::<&str>)
        .map(|_| true)
        .map_err(|err| err.to_string())
}

#[derive(Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "kebab-case")]
enum ProjectEditor {
    Vscode,
    Pycharm,
    Webstorm,
    Intellij,
    Cursor,
}

impl ProjectEditor {
    fn label(self) -> &'static str {
        match self {
            Self::Vscode => "VS Code",
            Self::Pycharm => "PyCharm",
            Self::Webstorm => "WebStorm",
            Self::Intellij => "IntelliJ IDEA",
            Self::Cursor => "Cursor",
        }
    }

    /// Command-line arguments that open `path` with the caret on a cited line.
    ///
    /// The opener plugin can only hand a path to an application, so a citation
    /// that names a line has to drive the editor's own launcher instead. Each
    /// family spells the location differently.
    fn line_arguments(self, path: &str, line: u32, column: Option<u32>) -> Vec<String> {
        match self {
            Self::Vscode | Self::Cursor => {
                let location = match column {
                    Some(column) => format!("{}:{}:{}", path, line, column),
                    None => format!("{}:{}", path, line),
                };
                vec!["--goto".to_string(), location]
            }
            Self::Pycharm | Self::Webstorm | Self::Intellij => {
                let mut arguments = vec!["--line".to_string(), line.to_string()];
                if let Some(column) = column {
                    arguments.push("--column".to_string());
                    arguments.push(column.to_string());
                }
                arguments.push(path.to_string());
                arguments
            }
        }
    }

    fn opener_application(self) -> &'static str {
        #[cfg(windows)]
        {
            match self {
                Self::Vscode => "code.cmd",
                Self::Pycharm => "pycharm64.exe",
                Self::Webstorm => "webstorm64.exe",
                Self::Intellij => "idea64.exe",
                Self::Cursor => "cursor.cmd",
            }
        }
        #[cfg(target_os = "macos")]
        {
            match self {
                Self::Vscode => "Visual Studio Code",
                Self::Pycharm => "PyCharm",
                Self::Webstorm => "WebStorm",
                Self::Intellij => "IntelliJ IDEA",
                Self::Cursor => "Cursor",
            }
        }
        #[cfg(all(unix, not(target_os = "macos")))]
        {
            match self {
                Self::Vscode => "code",
                Self::Pycharm => "pycharm",
                Self::Webstorm => "webstorm",
                Self::Intellij => "idea",
                Self::Cursor => "cursor",
            }
        }
    }
}

/// Launch the editor's own CLI so a cited location survives the hop.
///
/// Returns `Err` when the launcher could not be started at all, which is the
/// signal for the caller to fall back to the plain path open — a missing `code`
/// on PATH must degrade to "file opens at the top", never to "nothing happens".
fn spawn_project_editor_at_line(
    editor: ProjectEditor,
    path: &str,
    line: u32,
    column: Option<u32>,
) -> Result<(), String> {
    let program = editor.opener_application();
    // Windows resolves `.cmd` launchers (`code.cmd`, `cursor.cmd`) through the
    // shell; CreateProcess cannot execute a batch file directly.
    #[cfg(windows)]
    let mut command = {
        let mut command = Command::new("cmd");
        command.arg("/C").arg(program);
        command
    };
    #[cfg(not(windows))]
    let mut command = Command::new(program);

    command
        .args(editor.line_arguments(path, line, column))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    command.spawn().map(|_| ()).map_err(|err| err.to_string())
}

#[tauri::command]
fn overlay_open_project_editor<R: Runtime>(
    app: AppHandle<R>,
    editor: ProjectEditor,
    path: String,
    line: Option<u32>,
    column: Option<u32>,
) -> Result<bool, String> {
    let path = path.trim();
    if path.is_empty() {
        return Ok(false);
    }

    if let Some(line) = line.filter(|line| *line >= 1) {
        match spawn_project_editor_at_line(editor, path, line, column.filter(|column| *column >= 1)) {
            Ok(()) => return Ok(true),
            Err(err) => {
                eprintln!(
                    "[overlay] {} could not be launched at {}:{} ({}); opening the file instead",
                    editor.label(),
                    path,
                    line,
                    err
                );
            }
        }
    }

    app.opener()
        .open_path(path, Some(editor.opener_application()))
        .map(|_| true)
        .map_err(|err| format!("{}: {}", editor.label(), err))
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserPreviewBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrowserPreviewSelection {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    label: String,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    tag_name: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    selector: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    js_path: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    dom_path: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    text_preview: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    role: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    accessible_name: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    page_url: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    page_title: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    source_hint: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    computed_color: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    computed_font: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    anchor_x: Option<f64>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    anchor_y: Option<f64>,
    #[serde(
        default,
        deserialize_with = "deserialize_present_value",
        skip_serializing_if = "Option::is_none"
    )]
    captured_at: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrowserPreviewSelectionLabels {
    page: String,
    target: String,
    source: String,
    color: String,
    font: String,
    placeholder: String,
    cancel: String,
    send: String,
    label: String,
    annotate: String,
    context_hint: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrowserPreviewSelectionPalette {
    surface: String,
    surface_inset: String,
    surface_hover: String,
    text: String,
    text_muted: String,
    border: String,
    accent: String,
    accent_dim: String,
    accent_ring: String,
    shadow: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrowserPreviewSelectionPresentation {
    labels: BrowserPreviewSelectionLabels,
    palette: BrowserPreviewSelectionPalette,
}

fn clean_browser_preview_selection_value(name: &str, value: String) -> Result<String, String> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(format!(
            "browser preview selection presentation value `{name}` must not be blank"
        ));
    }
    Ok(value)
}

fn validate_browser_preview_selection_labels(
    labels: BrowserPreviewSelectionLabels,
) -> Result<BrowserPreviewSelectionLabels, String> {
    Ok(BrowserPreviewSelectionLabels {
        page: clean_browser_preview_selection_value("page", labels.page)?,
        target: clean_browser_preview_selection_value("target", labels.target)?,
        source: clean_browser_preview_selection_value("source", labels.source)?,
        color: clean_browser_preview_selection_value("color", labels.color)?,
        font: clean_browser_preview_selection_value("font", labels.font)?,
        placeholder: clean_browser_preview_selection_value("placeholder", labels.placeholder)?,
        cancel: clean_browser_preview_selection_value("cancel", labels.cancel)?,
        send: clean_browser_preview_selection_value("send", labels.send)?,
        label: clean_browser_preview_selection_value("label", labels.label)?,
        annotate: clean_browser_preview_selection_value("annotate", labels.annotate)?,
        context_hint: clean_browser_preview_selection_value("contextHint", labels.context_hint)?,
    })
}

fn validate_browser_preview_selection_palette(
    palette: BrowserPreviewSelectionPalette,
) -> Result<BrowserPreviewSelectionPalette, String> {
    Ok(BrowserPreviewSelectionPalette {
        surface: clean_browser_preview_selection_value("surface", palette.surface)?,
        surface_inset: clean_browser_preview_selection_value(
            "surfaceInset",
            palette.surface_inset,
        )?,
        surface_hover: clean_browser_preview_selection_value(
            "surfaceHover",
            palette.surface_hover,
        )?,
        text: clean_browser_preview_selection_value("text", palette.text)?,
        text_muted: clean_browser_preview_selection_value("textMuted", palette.text_muted)?,
        border: clean_browser_preview_selection_value("border", palette.border)?,
        accent: clean_browser_preview_selection_value("accent", palette.accent)?,
        accent_dim: clean_browser_preview_selection_value("accentDim", palette.accent_dim)?,
        accent_ring: clean_browser_preview_selection_value("accentRing", palette.accent_ring)?,
        shadow: clean_browser_preview_selection_value("shadow", palette.shadow)?,
    })
}

fn validate_browser_preview_selection_presentation(
    presentation: BrowserPreviewSelectionPresentation,
) -> Result<BrowserPreviewSelectionPresentation, String> {
    Ok(BrowserPreviewSelectionPresentation {
        labels: validate_browser_preview_selection_labels(presentation.labels)?,
        palette: validate_browser_preview_selection_palette(presentation.palette)?,
    })
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum BrowserPreviewSelectionResult {
    Comment {
        selection: BrowserPreviewSelection,
        comment: String,
    },
    Canceled,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct BrowserPreviewSelectionOwner {
    scope: BrowserPreviewScopeOwner,
    generation: u64,
}

#[derive(Default)]
struct BrowserPreviewSelectionState {
    active: Option<BrowserPreviewSelectionOwner>,
    next_generation: u64,
    callbacks: BrowserPreviewCallbackStore<BrowserPreviewSelectionResult>,
}

impl BrowserPreviewSelectionState {
    fn enable(
        &mut self,
        scope: BrowserPreviewScopeOwner,
    ) -> Result<BrowserPreviewSelectionOwner, String> {
        self.next_generation = self
            .next_generation
            .checked_add(1)
            .ok_or_else(|| "browser preview selection generation overflowed".to_string())?;
        let owner = BrowserPreviewSelectionOwner {
            scope,
            generation: self.next_generation,
        };
        self.active = Some(owner.clone());
        self.callbacks.clear();
        Ok(owner)
    }

    fn disable(&mut self) -> Result<(), String> {
        self.next_generation = self
            .next_generation
            .checked_add(1)
            .ok_or_else(|| "browser preview selection generation overflowed".to_string())?;
        self.active = None;
        self.callbacks.clear();
        Ok(())
    }
}

static BROWSER_PREVIEW_SELECTIONS: OnceLock<
    Mutex<HashMap<String, Arc<Mutex<BrowserPreviewSelectionState>>>>,
> = OnceLock::new();

fn browser_preview_selection_state(
    surface_id: &str,
) -> Result<Arc<Mutex<BrowserPreviewSelectionState>>, String> {
    let mut selections = BROWSER_PREVIEW_SELECTIONS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|err| err.to_string())?;
    Ok(selections
        .entry(surface_id.to_string())
        .or_insert_with(|| Arc::new(Mutex::new(BrowserPreviewSelectionState::default())))
        .clone())
}

fn clean_browser_preview_selection_text(input: Option<String>) -> Option<String> {
    input
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(500).collect())
}

fn clean_browser_preview_selection_number(input: Option<f64>) -> Option<f64> {
    input.filter(|value| value.is_finite())
}

fn validate_browser_preview_selection(
    selection: BrowserPreviewSelection,
) -> Result<BrowserPreviewSelection, String> {
    if !selection.x.is_finite()
        || !selection.y.is_finite()
        || !selection.width.is_finite()
        || !selection.height.is_finite()
        || selection.width <= 0.0
        || selection.height <= 0.0
    {
        return Err(
            "browser preview selection must contain finite x/y and positive width/height"
                .to_string(),
        );
    }
    let label = selection.label.trim().to_string();
    if label.is_empty() {
        return Err("browser preview selection label must not be empty".to_string());
    }
    Ok(BrowserPreviewSelection {
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height,
        label: label.chars().take(200).collect(),
        tag_name: clean_browser_preview_selection_text(selection.tag_name),
        selector: clean_browser_preview_selection_text(selection.selector),
        js_path: clean_browser_preview_selection_text(selection.js_path),
        dom_path: clean_browser_preview_selection_text(selection.dom_path),
        text_preview: clean_browser_preview_selection_text(selection.text_preview),
        role: clean_browser_preview_selection_text(selection.role),
        accessible_name: clean_browser_preview_selection_text(selection.accessible_name),
        page_url: clean_browser_preview_selection_text(selection.page_url),
        page_title: clean_browser_preview_selection_text(selection.page_title),
        source_hint: clean_browser_preview_selection_text(selection.source_hint),
        computed_color: clean_browser_preview_selection_text(selection.computed_color),
        computed_font: clean_browser_preview_selection_text(selection.computed_font),
        anchor_x: clean_browser_preview_selection_number(selection.anchor_x),
        anchor_y: clean_browser_preview_selection_number(selection.anchor_y),
        captured_at: clean_browser_preview_selection_number(selection.captured_at),
    })
}

fn validate_browser_preview_bounds(
    bounds: BrowserPreviewBounds,
) -> Result<BrowserPreviewBounds, String> {
    if !bounds.x.is_finite()
        || !bounds.y.is_finite()
        || !bounds.width.is_finite()
        || !bounds.height.is_finite()
        || bounds.width <= 0.0
        || bounds.height <= 0.0
    {
        return Err(
            "browser preview webview bounds must contain finite x/y and positive width/height"
                .to_string(),
        );
    }
    Ok(bounds)
}

fn browser_preview_position(bounds: BrowserPreviewBounds) -> tauri::LogicalPosition<f64> {
    tauri::LogicalPosition::new(bounds.x, bounds.y)
}

fn browser_preview_size(bounds: BrowserPreviewBounds) -> tauri::LogicalSize<f64> {
    tauri::LogicalSize::new(bounds.width, bounds.height)
}

fn require_browser_preview_scope_owner(
    state: &BrowserPreviewScopeState,
    scope_key: &str,
) -> Result<BrowserPreviewScopeOwner, String> {
    let scope_key = scope_key.trim();
    if scope_key.is_empty() {
        return Err("browser preview scope key is required".to_string());
    }
    let owner = state
        .active
        .as_ref()
        .ok_or_else(|| "browser preview has no active scope owner".to_string())?;
    if owner.scope_key != scope_key {
        return Err("browser preview command belongs to a stale scope owner".to_string());
    }
    Ok(owner.clone())
}

fn with_browser_preview_scope<T>(
    surface_id: &str,
    scope_key: &str,
    operation: impl FnOnce(&BrowserPreviewScopeOwner) -> Result<T, String>,
) -> Result<T, String> {
    let state = browser_preview_scope_state(surface_id)?;
    let state = state.lock().map_err(|err| err.to_string())?;
    let owner = require_browser_preview_scope_owner(&state, scope_key)?;
    operation(&owner)
}

fn invalidate_browser_preview_scope_owner(
    state: &mut BrowserPreviewScopeState,
    scope_key: &str,
) -> Result<(), String> {
    require_browser_preview_scope_owner(state, scope_key)?;
    state.next_generation = state
        .next_generation
        .checked_add(1)
        .ok_or_else(|| "browser preview scope generation overflowed".to_string())?;
    state.active = None;
    Ok(())
}

fn with_browser_preview_scope_replacement<T, E>(
    state: &Mutex<BrowserPreviewScopeState>,
    scope_key: &str,
    force_replacement: bool,
    operation: impl FnOnce(&BrowserPreviewScopeOwner, bool) -> Result<T, E>,
) -> Result<T, E>
where
    E: From<String>,
{
    let mut state = state.lock().map_err(|err| E::from(err.to_string()))?;
    let existing_owner = if !force_replacement {
        state
            .active
            .as_ref()
            .filter(|owner| owner.scope_key == scope_key)
            .cloned()
    } else {
        None
    };
    let (owner, scope_changed) = if let Some(owner) = existing_owner {
        (owner, false)
    } else {
        state.next_generation = state
            .next_generation
            .checked_add(1)
            .ok_or_else(|| E::from("browser preview scope generation overflowed".to_string()))?;
        state.active = None;
        (
            BrowserPreviewScopeOwner {
                scope_key: scope_key.to_string(),
                generation: state.next_generation,
            },
            true,
        )
    };
    match operation(&owner, scope_changed) {
        Ok(result) => {
            if scope_changed {
                state.active = Some(owner);
            }
            Ok(result)
        }
        Err(error) => {
            if !scope_changed {
                state.next_generation = state.next_generation.checked_add(1).ok_or_else(|| {
                    E::from("browser preview scope generation overflowed".to_string())
                })?;
                state.active = None;
            }
            Err(error)
        }
    }
}

fn replace_browser_preview_scope<T, E>(
    surface_id: &str,
    scope_key: &str,
    force_replacement: bool,
    operation: impl FnOnce(&BrowserPreviewScopeOwner, bool) -> Result<T, E>,
) -> Result<T, E>
where
    E: From<String>,
{
    let state = browser_preview_scope_state(surface_id).map_err(E::from)?;
    with_browser_preview_scope_replacement(&state, scope_key, force_replacement, operation)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserPreviewSyncError {
    message: String,
    surface_hidden: bool,
}

impl From<String> for BrowserPreviewSyncError {
    fn from(message: String) -> Self {
        Self {
            message,
            surface_hidden: false,
        }
    }
}

fn browser_preview_sync_error_with_cleanup(
    operation_error: String,
    cleanup_errors: Vec<String>,
    surface_hidden: bool,
) -> BrowserPreviewSyncError {
    let message = if cleanup_errors.is_empty() {
        operation_error
    } else {
        format!(
            "browser preview sync failed: {operation_error}; cleanup failed: {}",
            cleanup_errors.join("; ")
        )
    };
    BrowserPreviewSyncError {
        message,
        surface_hidden,
    }
}

fn with_browser_preview_sync_preflight_cleanup<Hide, ClearPage, ClearSelection>(
    state: &Mutex<BrowserPreviewScopeState>,
    operation_error: String,
    hide_surface: Hide,
    clear_page_info: ClearPage,
    clear_selection: ClearSelection,
) -> BrowserPreviewSyncError
where
    Hide: FnOnce() -> Result<(), String>,
    ClearPage: FnOnce() -> Result<(), String>,
    ClearSelection: FnOnce() -> Result<(), String>,
{
    let mut state = match state.lock() {
        Ok(state) => state,
        Err(error) => {
            return browser_preview_sync_error_with_cleanup(
                operation_error,
                vec![format!("scope owner cleanup failed: {error}")],
                false,
            );
        }
    };
    let mut cleanup_errors = Vec::new();
    let surface_hidden = match hide_surface() {
        Ok(()) => true,
        Err(error) => {
            cleanup_errors.push(format!("hide failed: {error}"));
            false
        }
    };
    if let Err(error) = clear_page_info() {
        cleanup_errors.push(format!("page callback cleanup failed: {error}"));
    }
    if let Err(error) = clear_selection() {
        cleanup_errors.push(format!("selection cleanup failed: {error}"));
    }
    if state.active.is_some() {
        match state.next_generation.checked_add(1) {
            Some(next_generation) => {
                state.next_generation = next_generation;
                state.active = None;
            }
            None => {
                state.active = None;
                cleanup_errors.push("scope generation overflowed during invalidation".to_string());
            }
        }
    }
    browser_preview_sync_error_with_cleanup(operation_error, cleanup_errors, surface_hidden)
}

fn browser_preview_sync_preflight_failed<R: Runtime>(
    app: &AppHandle<R>,
    surface_id: &str,
    webview_label: &str,
    operation_error: String,
) -> BrowserPreviewSyncError {
    let state = match browser_preview_scope_state(surface_id) {
        Ok(state) => state,
        Err(error) => {
            return browser_preview_sync_error_with_cleanup(
                operation_error,
                vec![format!("scope registry cleanup failed: {error}")],
                false,
            )
        }
    };
    with_browser_preview_sync_preflight_cleanup(
        &state,
        operation_error,
        || {
            if let Some(webview) = app.get_webview(webview_label) {
                webview.hide().map_err(|error| error.to_string())?;
            }
            Ok(())
        },
        || clear_browser_preview_page_info_store(surface_id),
        || clear_browser_preview_selection_state(surface_id),
    )
}

fn browser_preview_sync_mutation_failed<R: Runtime>(
    app: &AppHandle<R>,
    surface_id: &str,
    webview_label: &str,
    operation_error: String,
) -> BrowserPreviewSyncError {
    let mut cleanup_errors = Vec::new();
    let surface_hidden = if let Some(webview) = app.get_webview(webview_label) {
        match webview.hide() {
            Ok(()) => true,
            Err(error) => {
                cleanup_errors.push(format!("hide failed: {error}"));
                false
            }
        }
    } else {
        true
    };
    if let Err(error) = clear_browser_preview_page_info_store(surface_id) {
        cleanup_errors.push(format!("page callback cleanup failed: {error}"));
    }
    if let Err(error) = clear_browser_preview_selection_state(surface_id) {
        cleanup_errors.push(format!("selection cleanup failed: {error}"));
    }
    browser_preview_sync_error_with_cleanup(operation_error, cleanup_errors, surface_hidden)
}

#[tauri::command]
async fn overlay_browser_preview_sync<R: Runtime>(
    app: AppHandle<R>,
    surface_id: String,
    scope_key: String,
    mount_url: String,
    bounds: BrowserPreviewBounds,
) -> Result<bool, BrowserPreviewSyncError> {
    let webview_label = browser_preview_webview_label(&surface_id)
        .map_err(|message| BrowserPreviewSyncError::from(message))?;
    let scope_key = scope_key.trim();
    if scope_key.is_empty() {
        return Err(browser_preview_sync_preflight_failed(
            &app,
            &surface_id,
            &webview_label,
            "browser preview scope key is required".to_string(),
        ));
    }
    let bounds = validate_browser_preview_bounds(bounds).map_err(|message| {
        browser_preview_sync_preflight_failed(&app, &surface_id, &webview_label, message)
    })?;
    let mount_url = parse_browser_preview_navigation_url(&mount_url).map_err(|message| {
        browser_preview_sync_preflight_failed(&app, &surface_id, &webview_label, message)
    })?;
    let position = browser_preview_position(bounds);
    let size = browser_preview_size(bounds);
    if let Some(webview) = app.get_webview(&webview_label) {
        return replace_browser_preview_scope(&surface_id, scope_key, false, |_, scope_changed| {
            let mutation = (|| -> Result<bool, String> {
                if scope_changed && webview.url().map_err(|err| err.to_string())? != mount_url {
                    clear_browser_preview_page_info_store(&surface_id)?;
                    clear_browser_preview_selection_state(&surface_id)?;
                    webview
                        .navigate(mount_url.clone())
                        .map_err(|err| err.to_string())?;
                }
                webview
                    .set_position(position)
                    .map_err(|err| err.to_string())?;
                webview.set_size(size).map_err(|err| err.to_string())?;
                webview.show().map_err(|err| err.to_string())?;
                Ok(true)
            })();
            mutation.map_err(|error| {
                browser_preview_sync_mutation_failed(&app, &surface_id, &webview_label, error)
            })
        });
    }

    let window = app.get_window("main").ok_or_else(|| {
        browser_preview_sync_preflight_failed(
            &app,
            &surface_id,
            &webview_label,
            "main overlay window is unavailable".to_string(),
        )
    })?;
    let builder = tauri::webview::WebviewBuilder::<R>::new(
        &webview_label,
        tauri::WebviewUrl::External(mount_url),
    )
    .initialization_script_for_all_frames(BROWSER_PREVIEW_SELECTION_RUNTIME)
    .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny);
    replace_browser_preview_scope(&surface_id, scope_key, true, |_, _| {
        let mutation = (|| -> Result<bool, String> {
            clear_browser_preview_page_info_store(&surface_id)?;
            clear_browser_preview_selection_state(&surface_id)?;
            let webview = window
                .add_child(builder, position, size)
                .map_err(|err| err.to_string())?;
            webview
                .set_auto_resize(false)
                .map_err(|err| err.to_string())?;
            Ok(true)
        })();
        mutation.map_err(|error| {
            browser_preview_sync_mutation_failed(&app, &surface_id, &webview_label, error)
        })
    })
}

fn validate_browser_preview_zoom(factor: f64) -> Result<f64, String> {
    if !factor.is_finite() || factor <= 0.0 {
        return Err("browser preview zoom factor must be a finite positive number".to_string());
    }
    if !(0.25..=5.0).contains(&factor) {
        return Err("browser preview zoom factor must be between 0.25 and 5".to_string());
    }
    Ok(factor)
}

// Apply a WebView2 ZoomFactor-style page-content zoom to the browser-preview
// child webview. Mirrors browser Ctrl +/- behavior: the layout viewport (and
// therefore `getBoundingClientRect()` coordinates the selection runtime reads)
// stays in CSS pixels, while rendered content scales by `factor`.
#[tauri::command]
fn overlay_browser_preview_set_zoom<R: Runtime>(
    app: AppHandle<R>,
    surface_id: String,
    scope_key: String,
    factor: f64,
) -> Result<bool, String> {
    let factor = validate_browser_preview_zoom(factor)?;
    let webview_label = browser_preview_webview_label(&surface_id)?;
    let webview = app
        .get_webview(&webview_label)
        .ok_or_else(|| "browser preview webview is not mounted".to_string())?;
    with_browser_preview_scope(&surface_id, &scope_key, |_| {
        webview.set_zoom(factor).map_err(|err| err.to_string())?;
        Ok(true)
    })
}

fn browser_preview_navigation_script(action: &str) -> Result<Option<&'static str>, String> {
    match action {
        "back" => Ok(Some("history.back();")),
        "forward" => Ok(Some("history.forward();")),
        "reload" => Ok(None),
        _ => Err(format!(
            "unsupported browser preview navigation action: {action}"
        )),
    }
}

#[tauri::command]
fn overlay_browser_preview_navigate<R: Runtime>(
    app: AppHandle<R>,
    surface_id: String,
    scope_key: String,
    action: String,
) -> Result<bool, String> {
    let script = browser_preview_navigation_script(action.trim())?;
    let webview_label = browser_preview_webview_label(&surface_id)?;
    let webview = app
        .get_webview(&webview_label)
        .ok_or_else(|| "browser preview webview is not mounted".to_string())?;
    with_browser_preview_scope(&surface_id, &scope_key, |_| {
        clear_browser_preview_page_info_store(&surface_id)?;
        match script {
            Some(script) => webview.eval(script).map_err(|err| err.to_string())?,
            None => webview.reload().map_err(|err| err.to_string())?,
        }
        clear_browser_preview_selection_state(&surface_id)?;
        Ok(true)
    })
}

fn parse_browser_preview_navigation_url(input: &str) -> Result<tauri::Url, String> {
    let url = tauri::Url::parse(input.trim()).map_err(|error| error.to_string())?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err("browser preview URL must use HTTP or HTTPS".to_string());
    }
    Ok(url)
}

#[tauri::command]
fn overlay_browser_preview_navigate_url<R: Runtime>(
    app: AppHandle<R>,
    surface_id: String,
    scope_key: String,
    url: String,
) -> Result<bool, String> {
    let target_url = parse_browser_preview_navigation_url(&url)?;
    let webview_label = browser_preview_webview_label(&surface_id)?;
    let webview = app
        .get_webview(&webview_label)
        .ok_or_else(|| "browser preview webview is not mounted".to_string())?;
    with_browser_preview_scope(&surface_id, &scope_key, |_| {
        clear_browser_preview_page_info_store(&surface_id)?;
        clear_browser_preview_selection_state(&surface_id)?;
        webview
            .navigate(target_url)
            .map_err(|error| error.to_string())?;
        Ok(true)
    })
}

const BROWSER_PREVIEW_PAGE_INFO_SCRIPT: &str = r#"(function () {
  try {
    var runtime = window.__OPENCORVUS_PREVIEW_SELECTION__;
    var annotationRequested = !!(runtime && typeof runtime.takeContextRequest === "function" && runtime.takeContextRequest());
    var interactionReady = !!(runtime && typeof runtime.interactionReady === "function" && runtime.interactionReady());
    return JSON.stringify({ kind: "page", url: location.href, title: document.title || "", annotationRequested: annotationRequested, interactionReady: interactionReady });
  }
  catch (error) {
    return JSON.stringify({ kind: "error", message: String(error && error.message ? error.message : error) });
  }
})()"#;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrowserPreviewPageInfo {
    url: String,
    title: String,
    annotation_requested: bool,
    interaction_ready: bool,
}

#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum GuestPageInfoPayload {
    Page {
        url: String,
        title: String,
        annotation_requested: bool,
        interaction_ready: bool,
    },
    Error {
        message: String,
    },
}

static BROWSER_PREVIEW_PAGE_INFO: OnceLock<
    Mutex<HashMap<String, Arc<Mutex<BrowserPreviewCallbackStore<BrowserPreviewPageInfo>>>>>,
> = OnceLock::new();

fn browser_preview_page_info_store(
    surface_id: &str,
) -> Result<Arc<Mutex<BrowserPreviewCallbackStore<BrowserPreviewPageInfo>>>, String> {
    let mut stores = BROWSER_PREVIEW_PAGE_INFO
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|err| err.to_string())?;
    Ok(stores
        .entry(surface_id.to_string())
        .or_insert_with(|| Arc::new(Mutex::new(BrowserPreviewCallbackStore::default())))
        .clone())
}

fn clear_browser_preview_page_info_store(surface_id: &str) -> Result<(), String> {
    browser_preview_page_info_store(surface_id)?
        .lock()
        .map_err(|err| err.to_string())?
        .clear();
    Ok(())
}

fn decode_browser_preview_page_info(raw: &str) -> Result<BrowserPreviewPageInfo, String> {
    let inner = serde_json::from_str::<String>(raw.trim())
        .map_err(|err| format!("browser preview page callback is not a JSON string: {err}"))?;
    match serde_json::from_str::<GuestPageInfoPayload>(&inner)
        .map_err(|err| format!("browser preview guest page payload is invalid: {err}"))?
    {
        GuestPageInfoPayload::Error { message } => Err(format!(
            "browser preview guest page inspection failed: {message}"
        )),
        GuestPageInfoPayload::Page {
            url,
            title,
            annotation_requested,
            interaction_ready,
        } => {
            let url = url.trim().to_string();
            if url.is_empty() {
                return Err("browser preview guest page URL is empty".to_string());
            }
            Ok(BrowserPreviewPageInfo {
                url,
                title: title.trim().chars().take(240).collect(),
                annotation_requested,
                interaction_ready,
            })
        }
    }
}

fn store_browser_preview_page_info(
    store: &Mutex<BrowserPreviewCallbackStore<BrowserPreviewPageInfo>>,
    owner: &BrowserPreviewCallbackOwner,
    raw: &str,
) -> Result<(), String> {
    let completion = decode_browser_preview_page_info(raw);
    store
        .lock()
        .map_err(|err| err.to_string())?
        .complete(owner, completion);
    Ok(())
}

// Report the live URL and document title of the browser-preview child webview.
// The callback refreshes the page record for the next poll while the command
// returns the latest record that belongs to the current URL.
#[tauri::command]
fn overlay_browser_preview_current_page<R: Runtime>(
    app: AppHandle<R>,
    surface_id: String,
    scope_key: String,
) -> Result<Option<BrowserPreviewPageInfo>, String> {
    let webview_label = browser_preview_webview_label(&surface_id)?;
    let webview = app
        .get_webview(&webview_label)
        .ok_or_else(|| "browser preview webview is not mounted".to_string())?;
    let page_info_store = browser_preview_page_info_store(&surface_id)?;
    with_browser_preview_scope(&surface_id, &scope_key, |scope| {
        let request_owner = {
            let mut store = page_info_store.lock().map_err(|err| err.to_string())?;
            if let Some(completion) = store.take(scope) {
                return completion.map(Some);
            }
            store.begin(scope)?
        };
        if let Some(owner) = request_owner {
            let callback_owner = owner.clone();
            let callback_store = page_info_store.clone();
            if let Err(error) =
                webview.eval_with_callback(BROWSER_PREVIEW_PAGE_INFO_SCRIPT, move |raw| {
                    if let Err(error) =
                        store_browser_preview_page_info(&callback_store, &callback_owner, &raw)
                    {
                        eprintln!("browser preview page callback store failed: {error}");
                    }
                })
            {
                return browser_preview_callback_start_failed(
                    &page_info_store,
                    &owner,
                    error.to_string(),
                );
            }
        }
        Ok(None)
    })
}

#[tauri::command]
fn overlay_browser_preview_close<R: Runtime>(
    app: AppHandle<R>,
    surface_id: String,
    scope_key: String,
) -> Result<bool, String> {
    let webview_label = browser_preview_webview_label(&surface_id)?;
    let state = browser_preview_scope_state(&surface_id)?;
    let mut state = state.lock().map_err(|err| err.to_string())?;
    require_browser_preview_scope_owner(&state, &scope_key)?;
    let hidden = if let Some(webview) = app.get_webview(&webview_label) {
        // Reuse the single preview child webview across scope changes. Tauri's
        // `close()` removes the manager entry before native teardown finishes,
        // which can race a same-label `add_child(...)` and surface
        // "webview ... already exists" on fast reopen. Hiding keeps the label
        // stable and lets `sync` show/navigate/resize the same surface.
        webview.hide().map_err(|err| err.to_string())?;
        true
    } else {
        false
    };
    invalidate_browser_preview_scope_owner(&mut state, &scope_key)?;
    clear_browser_preview_page_info_store(&surface_id)?;
    clear_browser_preview_selection_state(&surface_id)?;
    drop(state);
    Ok(hidden)
}

#[tauri::command]
fn overlay_browser_preview_destroy<R: Runtime>(
    app: AppHandle<R>,
    surface_id: String,
) -> Result<bool, String> {
    let webview_label = browser_preview_webview_label(&surface_id)?;
    let removed = if let Some(webview) = app.get_webview(&webview_label) {
        webview.close().map_err(|err| err.to_string())?;
        true
    } else {
        false
    };
    BROWSER_PREVIEW_SCOPES
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|err| err.to_string())?
        .remove(surface_id.trim());
    BROWSER_PREVIEW_PAGE_INFO
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|err| err.to_string())?
        .remove(surface_id.trim());
    BROWSER_PREVIEW_SELECTIONS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|err| err.to_string())?
        .remove(surface_id.trim());
    Ok(removed)
}

fn browser_preview_selection_set_enabled_script(
    enabled: bool,
    presentation: Option<&BrowserPreviewSelectionPresentation>,
) -> Result<String, String> {
    let presentation_json = presentation
        .map(|value| serde_json::to_string(value).map_err(|err| err.to_string()))
        .transpose()?;
    if enabled {
        let presentation_json = presentation_json.ok_or_else(|| {
            "browser preview selection presentation is required when enabling selection".to_string()
        })?;
        Ok(format!(
            "window.__OPENCORVUS_PREVIEW_SELECTION__ && window.__OPENCORVUS_PREVIEW_SELECTION__.setEnabled(true, {presentation_json});"
        ))
    } else if let Some(presentation_json) = presentation_json {
        Ok(format!(
            "window.__OPENCORVUS_PREVIEW_SELECTION__ && window.__OPENCORVUS_PREVIEW_SELECTION__.setEnabled(false, {presentation_json});"
        ))
    } else {
        Ok("window.__OPENCORVUS_PREVIEW_SELECTION__ && window.__OPENCORVUS_PREVIEW_SELECTION__.setEnabled(false);".to_string())
    }
}

fn clear_browser_preview_selection_state(surface_id: &str) -> Result<(), String> {
    browser_preview_selection_state(surface_id)?
        .lock()
        .map_err(|err| err.to_string())?
        .disable()
}

fn begin_browser_preview_selection(
    surface_id: &str,
    scope: BrowserPreviewScopeOwner,
) -> Result<BrowserPreviewSelectionOwner, String> {
    browser_preview_selection_state(surface_id)?
        .lock()
        .map_err(|err| err.to_string())?
        .enable(scope)
}

fn invalidate_browser_preview_selection_owner(
    surface_id: &str,
    owner: &BrowserPreviewSelectionOwner,
) -> Result<(), String> {
    let selection_state = browser_preview_selection_state(surface_id)?;
    let mut state = selection_state.lock().map_err(|err| err.to_string())?;
    if state.active.as_ref() == Some(owner) {
        state.active = None;
        state.callbacks.clear();
    }
    Ok(())
}

// Toggle the in-guest element picker inside the browser-preview child webview.
// Enabling arms the injected runtime's click capture; disabling clears it. This
// keeps element selection inside the native webview (like open-mirror-app),
// instead of trying to route clicks through a host overlay that the native
// child webview would occlude.
#[tauri::command]
fn overlay_browser_preview_selection_set_enabled<R: Runtime>(
    app: AppHandle<R>,
    surface_id: String,
    scope_key: String,
    enabled: bool,
    presentation: Option<BrowserPreviewSelectionPresentation>,
) -> Result<bool, String> {
    let webview_label = browser_preview_webview_label(&surface_id)?;
    let webview = app
        .get_webview(&webview_label)
        .ok_or_else(|| "browser preview webview is not mounted".to_string())?;
    with_browser_preview_scope(&surface_id, &scope_key, |scope| {
        let presentation = presentation
            .map(validate_browser_preview_selection_presentation)
            .transpose()?;
        if enabled && presentation.is_none() {
            return Err(
                "browser preview selection presentation is required when enabling selection"
                    .to_string(),
            );
        }
        let owner = if enabled {
            Some(begin_browser_preview_selection(&surface_id, scope.clone())?)
        } else {
            clear_browser_preview_selection_state(&surface_id)?;
            None
        };
        let script = browser_preview_selection_set_enabled_script(enabled, presentation.as_ref())?;
        if let Err(error) = webview.eval(script) {
            if let Some(owner) = owner.as_ref() {
                invalidate_browser_preview_selection_owner(&surface_id, owner)?;
            }
            return Err(error.to_string());
        }
        Ok(true)
    })
}

// Deserialization mirror of the guest runtime's published selection payload
// (`window.__OPENCORVUS_PREVIEW_SELECTION_RESULT__`). The host reads this global
// via `eval_with_callback` while the overlay is polling for completion.
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
enum GuestSelectionPayload {
    Waiting {},
    Comment {
        selection: BrowserPreviewSelection,
        comment: String,
    },
    Canceled {},
    Error {
        message: String,
    },
}

// Read and clear the guest global that stores the latest selection/cancel. The
// expression always returns one JSON document as a string, which wry serializes
// into the callback as a JSON string. This is the sole callback wire format.
const BROWSER_PREVIEW_SELECTION_DRAIN_SCRIPT: &str = r#"(function () {
  try {
    var value = window.__OPENCORVUS_PREVIEW_SELECTION_RESULT__;
    window.__OPENCORVUS_PREVIEW_SELECTION_RESULT__ = null;
    if (value == null || value === "") return JSON.stringify({ kind: "waiting" });
    if (typeof value !== "string") {
      return JSON.stringify({ kind: "error", message: "guest selection result must be a JSON string" });
    }
    return value;
  } catch (err) {
    return JSON.stringify({ kind: "error", message: String(err && err.message ? err.message : err) });
  }
})()"#;

fn decode_guest_selection_payload(
    raw: &str,
) -> Result<Option<BrowserPreviewSelectionResult>, String> {
    let inner = serde_json::from_str::<String>(raw.trim())
        .map_err(|err| format!("browser preview selection callback is not a JSON string: {err}"))?;
    let payload = serde_json::from_str::<GuestSelectionPayload>(&inner)
        .map_err(|err| format!("browser preview guest selection payload is invalid: {err}"))?;
    let result = match payload {
        GuestSelectionPayload::Waiting {} => return Ok(None),
        GuestSelectionPayload::Error { message } => {
            return Err(format!("browser preview guest selection failed: {message}"));
        }
        GuestSelectionPayload::Canceled {} => BrowserPreviewSelectionResult::Canceled,
        GuestSelectionPayload::Comment { selection, comment } => {
            let selection = validate_browser_preview_selection(selection)?;
            let comment = comment.trim();
            if comment.is_empty() {
                return Err("browser preview guest selection comment is empty".to_string());
            }
            BrowserPreviewSelectionResult::Comment {
                selection,
                comment: comment.chars().take(2000).collect(),
            }
        }
    };
    Ok(Some(result))
}

fn store_guest_selection_payload(
    state: &Mutex<BrowserPreviewSelectionState>,
    owner: &BrowserPreviewCallbackOwner,
    raw: &str,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|err| err.to_string())?;
    match decode_guest_selection_payload(raw) {
        Ok(None) => state.callbacks.cancel(owner),
        Ok(Some(result)) => state.callbacks.complete(owner, Ok(result)),
        Err(error) => state.callbacks.complete(owner, Err(error)),
    }
    Ok(())
}

// Pull-and-clear the latest guest selection state. The overlay polls this after
// entering selection mode; returns None while the guest comment panel remains
// open. A host-side pull reads the guest global via `eval_with_callback`; its
// callback populates the store for the next poll.
#[tauri::command]
fn overlay_browser_preview_selection_take<R: Runtime>(
    app: AppHandle<R>,
    surface_id: String,
    scope_key: String,
) -> Result<Option<BrowserPreviewSelectionResult>, String> {
    let webview_label = browser_preview_webview_label(&surface_id)?;
    let webview = app
        .get_webview(&webview_label)
        .ok_or_else(|| "browser preview selection webview is not available".to_string())?;
    let selection_state = browser_preview_selection_state(&surface_id)?;
    with_browser_preview_scope(&surface_id, &scope_key, |scope| {
        let request_owner = {
            let mut state = selection_state.lock().map_err(|err| err.to_string())?;
            let active = state
                .active
                .as_ref()
                .filter(|owner| owner.scope == *scope)
                .ok_or_else(|| {
                    "browser preview selection is not enabled for the active scope".to_string()
                })?;
            let callback_scope = active.scope.clone();
            if let Some(completion) = state.callbacks.take(&callback_scope) {
                return completion.map(Some);
            }
            state.callbacks.begin(&callback_scope)?
        };
        if let Some(owner) = request_owner {
            let callback_owner = owner.clone();
            let callback_state = selection_state.clone();
            if let Err(error) =
                webview.eval_with_callback(BROWSER_PREVIEW_SELECTION_DRAIN_SCRIPT, move |raw| {
                    if let Err(error) =
                        store_guest_selection_payload(&callback_state, &callback_owner, &raw)
                    {
                        eprintln!("browser preview selection callback store failed: {error}");
                    }
                })
            {
                let mut state = selection_state.lock().map_err(|err| err.to_string())?;
                state.callbacks.cancel(&owner);
                return Err(error.to_string());
            }
        }
        Ok(None)
    })
}

#[tauri::command]
async fn overlay_pick_dir<R: Runtime>(
    app: AppHandle<R>,
    start: Option<String>,
) -> Result<Option<String>, String> {
    let start_clean = start
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty());
    let dialog = if let Some(ref dir) = start_clean {
        app.dialog().file().set_directory(dir)
    } else {
        app.dialog().file()
    };

    let result = match dialog.blocking_pick_folder() {
        Some(item) => Some(
            item.into_path()
                .map_err(|_| "picked directory is not a filesystem path".to_string())?
                .to_string_lossy()
                .to_string(),
        ),
        None => None,
    };

    Ok(result)
}

#[tauri::command]
async fn overlay_pick_files<R: Runtime>(
    app: AppHandle<R>,
    start: Option<String>,
    multiple: Option<bool>,
) -> Result<Vec<String>, String> {
    let mut builder = app.dialog().file().add_filter(
        "Supported Files",
        &[
            "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "pdf", "txt", "md", "json",
            "csv", "xml", "yaml", "yml", "log", "ts", "tsx", "js", "py", "go", "rs", "c", "cpp",
            "h", "java", "rb", "sh", "bat", "ps1", "html", "css", "sql", "toml",
        ],
    );

    if let Some(start) = start
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        builder = builder.set_directory(start);
    }

    let paths = if multiple.unwrap_or(true) {
        match builder.blocking_pick_files() {
            Some(paths) => paths,
            None => return Ok(Vec::new()),
        }
    } else {
        match builder.blocking_pick_file() {
            Some(path) => vec![path],
            None => return Ok(Vec::new()),
        }
    };

    let mut results = Vec::new();
    for entry in paths {
        let path = entry
            .into_path()
            .map_err(|_| "picked file is not a filesystem path".to_string())?;
        results.push(path.to_string_lossy().to_string());
    }

    Ok(results)
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct OverlayRuntimePaths {
    root: PathBuf,
    config_dir: PathBuf,
    data_dir: PathBuf,
    log_dir: PathBuf,
    embedded_dir: PathBuf,
    webview_dir: PathBuf,
}

impl OverlayRuntimePaths {
    fn from_root(root: PathBuf) -> Result<Self, String> {
        if root.as_os_str().is_empty() || root.to_str().is_some_and(|value| value.trim().is_empty())
        {
            return Err("OPENCORVUS_HOME must not be blank".to_string());
        }
        if !root.is_absolute() {
            return Err(format!(
                "OPENCORVUS_HOME must be an absolute path: {}",
                root.to_string_lossy()
            ));
        }
        let config_dir = root.join("config");
        let data_dir = root.join("data");
        let log_dir = root.join("log");
        let overlay_dir = root.join("overlay");
        let embedded_dir = overlay_dir.join("embedded");
        let webview_dir = overlay_dir.join("webview");
        Ok(Self {
            root,
            config_dir,
            data_dir,
            log_dir,
            embedded_dir,
            webview_dir,
        })
    }
}

fn default_overlay_runtime_root() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let base = std::env::var_os("LOCALAPPDATA")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("USERPROFILE")
                    .filter(|value| !value.is_empty())
                    .map(|home| PathBuf::from(home).join("AppData").join("Local"))
            })
            .ok_or_else(|| "OpenCorvus cannot resolve LOCALAPPDATA or USERPROFILE".to_string())?;
        return Ok(base.join("opencorvus"));
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .ok_or_else(|| "OpenCorvus cannot resolve HOME".to_string())?;
        return Ok(home
            .join("Library")
            .join("Application Support")
            .join("opencorvus"));
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(data) = std::env::var_os("XDG_DATA_HOME").filter(|value| !value.is_empty()) {
            return Ok(PathBuf::from(data).join("opencorvus"));
        }
        let home = std::env::var_os("HOME")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .ok_or_else(|| "OpenCorvus cannot resolve XDG_DATA_HOME or HOME".to_string())?;
        return Ok(home.join(".local").join("share").join("opencorvus"));
    }
    #[allow(unreachable_code)]
    Err("OpenCorvus cannot resolve a runtime root on this platform".to_string())
}

fn overlay_runtime_paths<R: Runtime>(_app: &AppHandle<R>) -> Result<OverlayRuntimePaths, String> {
    if let Some(root) = std::env::var_os("OPENCORVUS_HOME") {
        return OverlayRuntimePaths::from_root(PathBuf::from(root));
    }
    OverlayRuntimePaths::from_root(default_overlay_runtime_root()?)
}

fn embedded_server_payload_dir_name() -> String {
    format!("sidecar-{}", EMBEDDED_SERVER_STAMP)
}

const EMBEDDED_PAYLOAD_COMPLETE_FILE: &str = ".opencorvus-embedded-complete";
const EMBEDDED_PAYLOAD_LIFECYCLE_LOCK_FILE: &str = ".opencorvus-sidecar-lifecycle.lock";
const EMBEDDED_PAYLOAD_LEASE_DIR: &str = ".opencorvus-sidecar-leases";
const EMBEDDED_PAYLOAD_LEASE_SUFFIX: &str = ".lock";

struct EmbeddedPayloadLease {
    _file: fs::File,
}

struct ResolvedEmbeddedServer {
    executable: PathBuf,
    lease: EmbeddedPayloadLease,
}

fn embedded_payload_lease_path(parent: &Path, payload_dir_name: &str) -> PathBuf {
    parent
        .join(EMBEDDED_PAYLOAD_LEASE_DIR)
        .join(format!("{payload_dir_name}{EMBEDDED_PAYLOAD_LEASE_SUFFIX}"))
}

fn open_embedded_payload_lock(path: &Path) -> Result<fs::File, String> {
    fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .open(path)
        .map_err(|err| {
            format!(
                "failed to open embedded payload lock {}: {err}",
                path.to_string_lossy()
            )
        })
}

fn acquire_embedded_payload_lifecycle_lock(parent: &Path) -> Result<fs::File, String> {
    let path = parent.join(EMBEDDED_PAYLOAD_LIFECYCLE_LOCK_FILE);
    let file = open_embedded_payload_lock(&path)?;
    FileExt::lock(&file).map_err(|err| {
        format!(
            "failed to acquire embedded payload lifecycle lock {}: {err}",
            path.to_string_lossy()
        )
    })?;
    Ok(file)
}

fn acquire_embedded_payload_lease(
    parent: &Path,
    payload_dir_name: &str,
) -> Result<EmbeddedPayloadLease, String> {
    let lease_dir = parent.join(EMBEDDED_PAYLOAD_LEASE_DIR);
    fs::create_dir_all(&lease_dir).map_err(|err| {
        format!(
            "failed to create embedded payload lease directory {}: {err}",
            lease_dir.to_string_lossy()
        )
    })?;
    let path = embedded_payload_lease_path(parent, payload_dir_name);
    let file = open_embedded_payload_lock(&path)?;
    FileExt::lock_shared(&file).map_err(|err| {
        format!(
            "failed to acquire embedded payload lease {}: {err}",
            path.to_string_lossy()
        )
    })?;
    Ok(EmbeddedPayloadLease { _file: file })
}

fn collect_stale_embedded_payloads(
    parent: &Path,
    current_payload_dir_name: &str,
) -> Result<Vec<PathBuf>, String> {
    let mut entries = fs::read_dir(parent)
        .map_err(|err| {
            format!(
                "failed to enumerate embedded payload parent {}: {err}",
                parent.to_string_lossy()
            )
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| {
            format!(
                "failed to inspect entry in embedded payload parent {}: {err}",
                parent.to_string_lossy()
            )
        })?;
    entries.sort_by_key(|entry| entry.file_name());

    let mut removable_payloads = Vec::new();
    let mut unpublished_payloads = Vec::new();
    for entry in entries {
        let file_type = entry.file_type().map_err(|err| {
            format!(
                "failed to inspect embedded payload entry {}: {err}",
                entry.path().to_string_lossy()
            )
        })?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let is_unpublished = name.starts_with(".sidecar-") && name.contains("-extract-");
        if is_unpublished {
            if !file_type.is_dir() {
                return Err(format!(
                    "unpublished embedded payload path is not a directory: {}",
                    entry.path().to_string_lossy()
                ));
            }
            unpublished_payloads.push(entry.path());
            continue;
        }
        if name == current_payload_dir_name || !name.starts_with("sidecar-") {
            continue;
        }
        if !file_type.is_dir() {
            return Err(format!(
                "old embedded payload path is not a directory: {}",
                entry.path().to_string_lossy()
            ));
        }

        let lease_path = embedded_payload_lease_path(parent, &name);
        let lease_metadata = match fs::symlink_metadata(&lease_path) {
            Ok(metadata) => metadata,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => continue,
            Err(err) => {
                return Err(format!(
                    "failed to inspect embedded payload lease {}: {err}",
                    lease_path.to_string_lossy()
                ));
            }
        };
        if !lease_metadata.is_file() {
            return Err(format!(
                "embedded payload lease is not a file: {}",
                lease_path.to_string_lossy()
            ));
        }

        let lease_file = open_embedded_payload_lock(&lease_path)?;
        match FileExt::try_lock(&lease_file) {
            Ok(()) => removable_payloads.push((entry.path(), lease_path, lease_file)),
            Err(TryLockError::WouldBlock) => continue,
            Err(TryLockError::Error(err)) => {
                return Err(format!(
                    "failed to inspect embedded payload ownership {}: {err}",
                    lease_path.to_string_lossy()
                ));
            }
        }
    }

    let mut removed = Vec::new();
    for path in unpublished_payloads {
        fs::remove_dir_all(&path).map_err(|err| {
            format!(
                "failed to remove unpublished embedded payload {}: {err}",
                path.to_string_lossy()
            )
        })?;
        removed.push(path);
    }
    for (payload_path, lease_path, _lease_file) in removable_payloads {
        fs::remove_dir_all(&payload_path).map_err(|err| {
            format!(
                "failed to remove unowned embedded payload {}: {err}",
                payload_path.to_string_lossy()
            )
        })?;
        fs::remove_file(&lease_path).map_err(|err| {
            format!(
                "failed to remove embedded payload lease {}: {err}",
                lease_path.to_string_lossy()
            )
        })?;
        removed.push(payload_path);
    }
    Ok(removed)
}

#[cfg(unix)]
fn embedded_payload_file_mode_complete(executable: bool, mode: u32) -> bool {
    !executable || mode & 0o111 != 0
}

fn embedded_payload_files_complete(root: &Path) -> Result<bool, String> {
    for file in EMBEDDED_SERVER_FILES {
        let path = root.join(file.path);
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(false),
            Err(err) => {
                return Err(format!(
                    "failed to inspect embedded payload file {}: {err}",
                    path.to_string_lossy()
                ))
            }
        };
        if !metadata.is_file() || metadata.len() != file.size {
            return Ok(false);
        }
        #[cfg(unix)]
        if !embedded_payload_file_mode_complete(file.executable, metadata.permissions().mode()) {
            return Ok(false);
        }
    }
    Ok(true)
}

fn embedded_payload_complete(root: &Path) -> Result<bool, String> {
    let marker_path = root.join(EMBEDDED_PAYLOAD_COMPLETE_FILE);
    let marker = match fs::read_to_string(&marker_path) {
        Ok(marker) => marker,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(err) => {
            return Err(format!(
                "failed to read embedded payload completion marker {}: {err}",
                marker_path.to_string_lossy()
            ))
        }
    };
    if marker.trim() != EMBEDDED_SERVER_STAMP {
        return Ok(false);
    }
    embedded_payload_files_complete(root)
}

fn embedded_payload_temp_dir(parent: &Path) -> Result<PathBuf, String> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|err| format!("system clock is before Unix epoch: {err}"))?
        .as_nanos();
    Ok(parent.join(format!(
        ".sidecar-{}-extract-{}-{nanos}",
        EMBEDDED_SERVER_STAMP,
        std::process::id()
    )))
}

fn remove_unpublished_payload(path: &Path, primary_error: String) -> String {
    match fs::remove_dir_all(path) {
        Ok(()) => primary_error,
        Err(cleanup_error) if cleanup_error.kind() == std::io::ErrorKind::NotFound => primary_error,
        Err(cleanup_error) => format!(
            "{primary_error}; failed to remove unpublished payload {}: {cleanup_error}",
            path.to_string_lossy()
        ),
    }
}

fn embedded_payload_total_bytes() -> u64 {
    EMBEDDED_SERVER_FILES.iter().map(|file| file.size).sum()
}

fn unpack_embedded_payload(
    root: &Path,
    total_bytes: u64,
    report_progress: &mut dyn FnMut(StartupProgress),
) -> Result<(), String> {
    if EMBEDDED_SERVER_ARCHIVE_GZ.is_empty() {
        return Err("embedded opencorvus sidecar archive is empty".to_string());
    }

    fs::create_dir(root).map_err(|err| {
        format!(
            "failed to create unpublished embedded payload directory {}: {err}",
            root.to_string_lossy()
        )
    })?;

    let decoder = GzDecoder::new(Cursor::new(EMBEDDED_SERVER_ARCHIVE_GZ));
    let mut archive = Archive::new(decoder);
    let entries = archive.entries().map_err(|err| err.to_string())?;
    let mut extracted_bytes = ExtractedByteAccumulator::new(total_bytes);
    for entry in entries {
        let mut entry = entry.map_err(|err| err.to_string())?;
        let relative_path = entry.path().map_err(|err| err.to_string())?.into_owned();
        let is_file = entry.header().entry_type().is_file();
        let entry_size = entry.header().size().map_err(|err| err.to_string())?;
        let persisted = entry.unpack_in(root).map_err(|err| {
            format!(
                "failed to extract embedded payload entry {}: {err}",
                relative_path.to_string_lossy()
            )
        })?;
        if !persisted {
            return Err(format!(
                "embedded payload entry escapes extraction root: {}",
                relative_path.to_string_lossy()
            ));
        }
        if is_file {
            let completed_bytes = extracted_bytes.record_persisted_file(entry_size);
            report_progress(StartupProgress::extraction_progress(
                completed_bytes,
                extracted_bytes.total_bytes(),
                "Preparing embedded backend",
            ));
        }
    }
    if extracted_bytes.completed_bytes() != total_bytes {
        return Err(format!(
            "embedded payload archive contains {} file bytes but manifest declares {total_bytes}",
            extracted_bytes.completed_bytes()
        ));
    }

    #[cfg(unix)]
    for file in EMBEDDED_SERVER_FILES {
        if file.executable {
            let path = root.join(file.path);
            let perms = fs::Permissions::from_mode(0o755);
            fs::set_permissions(path, perms).map_err(|err| err.to_string())?;
        }
    }

    if !embedded_payload_files_complete(root)? {
        return Err(format!(
            "embedded opencorvus sidecar extraction incomplete at {}",
            root.to_string_lossy()
        ));
    }

    let marker_path = root.join(EMBEDDED_PAYLOAD_COMPLETE_FILE);
    let mut marker = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&marker_path)
        .map_err(|err| {
            format!(
                "failed to create embedded payload completion marker {}: {err}",
                marker_path.to_string_lossy()
            )
        })?;
    marker
        .write_all(format!("{EMBEDDED_SERVER_STAMP}\n").as_bytes())
        .map_err(|err| {
            format!(
                "failed to write embedded payload completion marker {}: {err}",
                marker_path.to_string_lossy()
            )
        })?;
    marker.sync_all().map_err(|err| {
        format!(
            "failed to sync embedded payload completion marker {}: {err}",
            marker_path.to_string_lossy()
        )
    })?;

    Ok(())
}

fn ensure_embedded_server_path(
    paths: &OverlayRuntimePaths,
    report_progress: &mut dyn FnMut(StartupProgress),
) -> Result<ResolvedEmbeddedServer, String> {
    if EMBEDDED_SERVER_FILES.is_empty() {
        return Err("embedded opencorvus sidecar payload is empty".to_string());
    }

    let parent = &paths.embedded_dir;
    fs::create_dir_all(parent).map_err(|err| {
        format!(
            "failed to create embedded payload parent {}: {err}",
            parent.to_string_lossy()
        )
    })?;
    let _lifecycle_lock = acquire_embedded_payload_lifecycle_lock(parent)?;
    let payload_dir_name = embedded_server_payload_dir_name();
    let root = parent.join(&payload_dir_name);
    match fs::symlink_metadata(&root) {
        Ok(_) => {
            if !embedded_payload_complete(&root)? {
                return Err(format!(
                    "immutable embedded payload directory is incomplete at {}",
                    root.to_string_lossy()
                ));
            }
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            let unpublished = embedded_payload_temp_dir(parent)?;
            let total_bytes = embedded_payload_total_bytes();
            report_progress(StartupProgress::extracting(
                total_bytes,
                "Preparing embedded backend",
            ));
            if let Err(error) = unpack_embedded_payload(&unpublished, total_bytes, report_progress)
            {
                return Err(remove_unpublished_payload(&unpublished, error));
            }
            if let Err(rename_error) = fs::rename(&unpublished, &root) {
                let concurrent_publish = embedded_payload_complete(&root);
                let error = remove_unpublished_payload(
                    &unpublished,
                    format!(
                        "failed to publish embedded payload {} to {}: {rename_error}",
                        unpublished.to_string_lossy(),
                        root.to_string_lossy()
                    ),
                );
                match concurrent_publish {
                    Ok(true) => {}
                    Ok(false) => return Err(error),
                    Err(validation_error) => {
                        return Err(format!(
                            "{error}; failed to validate concurrent payload publication: {validation_error}"
                        ))
                    }
                }
            }
            if !embedded_payload_complete(&root)? {
                return Err(format!(
                    "published embedded payload is incomplete at {}",
                    root.to_string_lossy()
                ));
            }
        }
        Err(err) => {
            return Err(format!(
                "failed to inspect immutable embedded payload directory {}: {err}",
                root.to_string_lossy()
            ))
        }
    }

    let lease = acquire_embedded_payload_lease(parent, &payload_dir_name)?;
    collect_stale_embedded_payloads(parent, &payload_dir_name)?;
    Ok(ResolvedEmbeddedServer {
        executable: root.join(EMBEDDED_SERVER_NAME),
        lease,
    })
}

fn server_info_with_pid_and_log(
    port: u16,
    pid: u32,
    sidecar_log_path: Option<PathBuf>,
) -> OverlayServerInfo {
    OverlayServerInfo {
        port,
        url: format!("http://{LOCAL_SERVER_HOST}:{port}"),
        pid: Some(pid),
        sidecar_log_path: sidecar_log_path.map(|path| path.to_string_lossy().to_string()),
    }
}

fn unix_time_millis() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|err| format!("system clock is before Unix epoch: {err}"))
}

fn prepare_managed_process_occurrence(
    data_dir: &Path,
    port: u16,
    executable_path: &Path,
    sidecar_log_path: &Path,
) -> Result<ManagedProcessOccurrence, String> {
    let started_at_ms = unix_time_millis()?;
    let parent_pid = std::process::id();
    let id = format!("process_{parent_pid}_{started_at_ms}_{port}");
    let directory = data_dir.join("process-occurrences");
    fs::create_dir_all(&directory).map_err(|err| {
        format!(
            "cannot create process occurrence directory {}: {err}",
            directory.to_string_lossy()
        )
    })?;
    let locator_path = directory.join("supervisor-current.json");
    let predecessor = if locator_path.exists() {
        let bytes = fs::read(&locator_path).map_err(|err| {
            format!(
                "cannot read supervisor process occurrence locator {}: {err}",
                locator_path.to_string_lossy()
            )
        })?;
        let locator: ManagedProcessOccurrenceLocator =
            serde_json::from_slice(&bytes).map_err(|err| {
                format!(
                    "invalid supervisor process occurrence locator {}: {err}",
                    locator_path.to_string_lossy()
                )
            })?;
        if locator.schema_version != 1 {
            return Err(format!(
                "unsupported supervisor process occurrence locator schema {}",
                locator.schema_version
            ));
        }
        Some((
            locator.process_occurrence_id,
            PathBuf::from(locator.envelope_path),
        ))
    } else {
        None
    };
    let occurrence = ManagedProcessOccurrence {
        path: directory.join(format!("{id}.json")),
        shutdown_request_path: directory.join(format!("{id}.shutdown.json")),
        supervisor_observation_id: format!("observation_{parent_pid}_{started_at_ms}_{port}"),
        id,
        started_at_ms,
        parent_pid,
        port,
        pid: None,
        predecessor_id: predecessor.as_ref().map(|value| value.0.clone()),
        predecessor_path: predecessor.map(|value| value.1),
        executable_path: executable_path.to_path_buf(),
        sidecar_log_path: sidecar_log_path.to_path_buf(),
    };
    write_managed_process_occurrence(&occurrence, "launching", None, None, None, None, None)?;
    Ok(occurrence)
}

fn replace_file_atomically(temporary: &Path, target: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Storage::FileSystem::{
            MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        };
        let source: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
        let destination: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
        let moved = unsafe {
            MoveFileExW(
                source.as_ptr(),
                destination.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        };
        if moved == 0 {
            return Err(format!(
                "cannot atomically replace {}: {}",
                target.to_string_lossy(),
                std::io::Error::last_os_error()
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        fs::rename(temporary, target).map_err(|err| {
            format!(
                "cannot atomically replace {}: {err}",
                target.to_string_lossy()
            )
        })
    }
}

fn write_managed_process_occurrence(
    occurrence: &ManagedProcessOccurrence,
    state: &str,
    terminal_at_ms: Option<u128>,
    shutdown_source: Option<&str>,
    shutdown_reason: Option<&str>,
    exit_code: Option<i32>,
    exit_signal: Option<i32>,
) -> Result<(), String> {
    let envelope = ManagedProcessOccurrenceEnvelope {
        schema_version: 2,
        supervisor_observation_id: occurrence.supervisor_observation_id.clone(),
        process_occurrence_id: occurrence.id.clone(),
        predecessor_process_occurrence_id: occurrence.predecessor_id.clone(),
        predecessor_envelope_path: occurrence
            .predecessor_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        parent_pid: occurrence.parent_pid,
        port: occurrence.port,
        pid: occurrence.pid,
        started_at_ms: occurrence.started_at_ms,
        executable_path: occurrence.executable_path.to_string_lossy().to_string(),
        build_identity: env!("CARGO_PKG_VERSION").to_string(),
        sidecar_log_path: occurrence.sidecar_log_path.to_string_lossy().to_string(),
        state: state.to_string(),
        shutdown_source: shutdown_source.map(str::to_string),
        shutdown_reason: shutdown_reason.map(str::to_string),
        exit_code,
        exit_signal,
        terminal_at_ms,
    };
    let bytes = serde_json::to_vec_pretty(&envelope).map_err(|err| err.to_string())?;
    let temporary = occurrence.path.with_extension("json.tmp");
    fs::write(&temporary, bytes).map_err(|err| {
        format!(
            "cannot write process occurrence {}: {err}",
            temporary.to_string_lossy()
        )
    })?;
    replace_file_atomically(&temporary, &occurrence.path)
}

fn publish_managed_process_occurrence_locator(
    occurrence: &ManagedProcessOccurrence,
) -> Result<(), String> {
    let target = occurrence
        .path
        .parent()
        .unwrap()
        .join("supervisor-current.json");
    let temporary = target.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(&ManagedProcessOccurrenceLocator {
        schema_version: 1,
        process_occurrence_id: occurrence.id.clone(),
        envelope_path: occurrence.path.to_string_lossy().to_string(),
    })
    .map_err(|err| err.to_string())?;
    fs::write(&temporary, bytes)
        .map_err(|err| format!("cannot write supervisor locator: {err}"))?;
    replace_file_atomically(&temporary, &target)
}

fn terminalize_managed_process_occurrence(
    occurrence: &ManagedProcessOccurrence,
    observed_state: &'static str,
    shutdown_source: Option<&str>,
    forced_termination: bool,
    exit_status: Option<&std::process::ExitStatus>,
) -> Result<(), String> {
    let terminal_at_ms = unix_time_millis().ok();
    #[cfg(unix)]
    let exit_signal = exit_status.and_then(|status| {
        use std::os::unix::process::ExitStatusExt;
        status.signal()
    });
    #[cfg(not(unix))]
    let exit_signal = None;
    let shutdown_request = read_managed_process_shutdown_request(occurrence)?;
    let (observed_source, observed_reason) = shutdown_request
        .as_ref()
        .map(|request| (Some(request.source.as_str()), Some(request.reason.as_str())))
        .unwrap_or((shutdown_source, None));
    let state = managed_process_terminal_state(
        observed_state,
        shutdown_request.is_some(),
        forced_termination,
    );
    write_managed_process_occurrence(
        occurrence,
        state,
        terminal_at_ms,
        observed_source,
        observed_reason,
        exit_status.and_then(|status| status.code()),
        exit_signal,
    )
}

fn managed_process_terminal_state(
    observed_state: &'static str,
    shutdown_requested: bool,
    forced_termination: bool,
) -> &'static str {
    if forced_termination {
        "forced_exit"
    } else if shutdown_requested {
        "graceful_exit"
    } else {
        observed_state
    }
}

fn read_managed_process_shutdown_request(
    occurrence: &ManagedProcessOccurrence,
) -> Result<Option<ManagedProcessShutdownRequest>, String> {
    if !occurrence.shutdown_request_path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&occurrence.shutdown_request_path).map_err(|err| {
        format!(
            "cannot read managed process shutdown request {}: {err}",
            occurrence.shutdown_request_path.to_string_lossy()
        )
    })?;
    let request: ManagedProcessShutdownRequest = serde_json::from_slice(&bytes).map_err(|err| {
        format!(
            "invalid managed process shutdown request {}: {err}",
            occurrence.shutdown_request_path.to_string_lossy()
        )
    })?;
    if request.schema_version != 1
        || request.process_occurrence_id != occurrence.id
        || request.requested_at_ms < occurrence.started_at_ms
        || request.reason.trim().is_empty()
        || !matches!(
            request.source.as_str(),
            "tauri-supervisor"
                | "managed-parent-watchdog"
                | "http-client"
                | "internal-restart"
                | "process-signal"
        )
    {
        return Err(format!(
            "managed process shutdown request does not match occurrence {}",
            occurrence.id
        ));
    }
    Ok(Some(request))
}

fn next_server_port() -> Result<u16, String> {
    if let Ok(listener) = TcpListener::bind((LOCAL_SERVER_HOST, DEFAULT_SERVER_PORT)) {
        return listener
            .local_addr()
            .map(|addr| addr.port())
            .map_err(|err| err.to_string());
    }

    for port in (DEFAULT_SERVER_PORT + 1)..=(DEFAULT_SERVER_PORT + 32) {
        if let Ok(listener) = TcpListener::bind((LOCAL_SERVER_HOST, port)) {
            return listener
                .local_addr()
                .map(|addr| addr.port())
                .map_err(|err| err.to_string());
        }
    }

    TcpListener::bind((LOCAL_SERVER_HOST, 0))
        .map_err(|err| err.to_string())?
        .local_addr()
        .map(|addr| addr.port())
        .map_err(|err| err.to_string())
}

fn stop_server_state(server: &Server) -> Result<(), String> {
    let mut lock = server.state.lock().unwrap();
    let process_occurrence = lock.process_occurrence.clone();
    let mut observed_exit_status = None;

    let exited_gracefully = if let (Some(port), Some(child)) = (lock.port, lock.child.as_mut()) {
        match request_server_shutdown(
            port,
            process_occurrence
                .as_ref()
                .map(|occurrence| occurrence.id.as_str()),
        ) {
            Ok(()) => match wait_for_child_exit(child, Duration::from_secs(5)) {
                Ok(status) => {
                    observed_exit_status = status;
                    observed_exit_status.is_some()
                }
                Err(err) => {
                    eprintln!("overlay: failed while waiting for graceful shutdown: {err}");
                    false
                }
            },
            Err(err) => {
                eprintln!("overlay: graceful shutdown request failed: {err}");
                false
            }
        }
    } else {
        false
    };

    let process_was_already_terminal = if exited_gracefully {
        false
    } else if let Some(child) = lock.child.as_mut() {
        match child.try_wait() {
            Ok(Some(status)) => {
                observed_exit_status = Some(status);
                true
            }
            Ok(None) => false,
            Err(err) => {
                eprintln!("overlay: failed to observe server process before termination: {err}");
                false
            }
        }
    } else {
        true
    };
    let forced_termination = !exited_gracefully && !process_was_already_terminal;

    // Windows: drop the Job Object handle 鈫?KILL_ON_JOB_CLOSE terminates every
    // process in the job (direct child + all grandchildren).
    #[cfg(windows)]
    {
        if forced_termination {
            lock.job = None;
        }
    }

    // Unix: SIGKILL the entire process group — reaches direct child and all
    // grandchildren that inherited the group (LSP servers, PTY shells, etc.).
    #[cfg(unix)]
    if let Some(pgid) = lock.pgid.take() {
        if forced_termination && pgid > 1 {
            // SAFETY: kill(2) is always safe to call; SIGKILL = 9.
            unsafe {
                kill(-(pgid as i32), 9);
            }
        }
    }

    // Reap the direct child (may already be dead from the above).
    if let Some(mut child) = lock.child.take() {
        if forced_termination {
            let _ = child.kill(); // Ignore error — process may already be gone.
        }
        if observed_exit_status.is_none() {
            observed_exit_status = Some(
                child
                    .wait()
                    .map_err(|err| format!("failed to wait on server process: {err}"))?,
            );
        }
    }

    if let Some(occurrence) = process_occurrence.as_ref() {
        terminalize_managed_process_occurrence(
            occurrence,
            "early_exit",
            forced_termination.then_some("tauri-supervisor"),
            forced_termination,
            observed_exit_status.as_ref(),
        )?;
    }

    lock.port = None;
    lock.sidecar_log_path = None;
    lock.process_occurrence = None;
    lock.payload_lease = None;
    Ok(())
}

fn stop_server<R: Runtime>(app: &AppHandle<R>) {
    let server = app.state::<Server>();
    let _operation = server.operation.lock().unwrap();
    if let Err(err) = stop_server_state(&server) {
        eprintln!("overlay: failed to preserve managed process terminal evidence: {err}");
    }
}

fn server_shutdown_authorization() -> Option<String> {
    let password = std::env::var("OPENCORVUS_SERVER_PASSWORD").ok()?;
    let password = password.trim();
    if password.is_empty() {
        return None;
    }
    let username = std::env::var("OPENCORVUS_SERVER_USERNAME")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "opencorvus".to_string());
    Some(format!(
        "Basic {}",
        STANDARD.encode(format!("{username}:{password}"))
    ))
}

fn request_server_shutdown(port: u16, process_occurrence_id: Option<&str>) -> Result<(), String> {
    let mut stream =
        TcpStream::connect((LOCAL_SERVER_HOST, port)).map_err(|err| err.to_string())?;
    let _ = stream.set_read_timeout(Some(Duration::from_millis(750)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(750)));

    let mut request = format!(
        "POST /shutdown HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\nContent-Length: 0\r\n",
        host = LOCAL_SERVER_HOST,
        port = port,
    );
    if let Some(auth) = server_shutdown_authorization() {
        request.push_str(&format!("Authorization: {auth}\r\n"));
    }
    request.push_str("X-OpenCorvus-Shutdown-Source: tauri-supervisor\r\n");
    if let Some(process_occurrence_id) = process_occurrence_id {
        request.push_str(&format!(
            "X-OpenCorvus-Process-Occurrence: {process_occurrence_id}\r\n"
        ));
    }
    request.push_str("\r\n");

    stream
        .write_all(request.as_bytes())
        .map_err(|err| err.to_string())?;
    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);
    Ok(())
}

#[derive(Debug, PartialEq, Eq)]
enum ServerHealth {
    Healthy,
    Unhealthy,
}

#[derive(Debug, PartialEq, Eq)]
struct ManagedBackendStartupFailure {
    message: String,
    sidecar_log_path: Option<PathBuf>,
}

enum ManagedBackendProcessObservation {
    Running(OverlayServerInfo),
    Inactive,
    Terminal(ManagedBackendStartupFailure),
}

#[derive(Deserialize)]
struct ServerHealthPayload {
    healthy: bool,
}

fn probe_server_health(
    address: SocketAddr,
    timeout: Duration,
    authorization: Option<&str>,
) -> Result<ServerHealth, String> {
    let mut stream =
        TcpStream::connect_timeout(&address, timeout).map_err(|err| err.to_string())?;
    stream
        .set_read_timeout(Some(timeout))
        .map_err(|err| err.to_string())?;
    stream
        .set_write_timeout(Some(timeout))
        .map_err(|err| err.to_string())?;
    let mut request =
        format!("GET /global/health HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\n");
    if let Some(authorization) = authorization {
        request.push_str(&format!("Authorization: {authorization}\r\n"));
    }
    request.push_str("\r\n");
    stream
        .write_all(request.as_bytes())
        .map_err(|err| err.to_string())?;

    let mut response = String::new();
    BufReader::new(stream)
        .read_to_string(&mut response)
        .map_err(|err| err.to_string())?;
    let (head, body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "health response is missing the HTTP header boundary".to_string())?;
    let status_line = head.lines().next().unwrap_or_default();
    let mut fields = status_line.split_ascii_whitespace();
    let protocol = fields.next().unwrap_or_default();
    let status = fields.next().unwrap_or_default();
    if !matches!(protocol, "HTTP/1.0" | "HTTP/1.1") || status != "200" {
        return Err(format!("health endpoint returned HTTP status {status}"));
    }
    let payload = serde_json::from_str::<ServerHealthPayload>(body)
        .map_err(|err| format!("health endpoint returned invalid JSON: {err}"))?;
    Ok(if payload.healthy {
        ServerHealth::Healthy
    } else {
        ServerHealth::Unhealthy
    })
}

fn sidecar_startup_failure_tail(path: &Path) -> Result<Option<String>, String> {
    let mut file = fs::File::open(path).map_err(|err| {
        format!(
            "cannot open managed backend startup log {}: {err}",
            path.to_string_lossy()
        )
    })?;
    let length = file
        .metadata()
        .map_err(|err| {
            format!(
                "cannot inspect managed backend startup log {}: {err}",
                path.to_string_lossy()
            )
        })?
        .len();
    if length > SIDECAR_STARTUP_FAILURE_TAIL_BYTES {
        file.seek(SeekFrom::Start(length - SIDECAR_STARTUP_FAILURE_TAIL_BYTES))
            .map_err(|err| {
                format!(
                    "cannot seek managed backend startup log {}: {err}",
                    path.to_string_lossy()
                )
            })?;
    }
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|err| {
        format!(
            "cannot read managed backend startup log {}: {err}",
            path.to_string_lossy()
        )
    })?;
    let output = String::from_utf8_lossy(&bytes).trim().to_string();
    Ok((!output.is_empty()).then_some(output))
}

fn managed_backend_terminal_failure(
    reason: String,
    sidecar_log_path: Option<PathBuf>,
) -> ManagedBackendStartupFailure {
    let mut message = reason;
    if let Some(path) = sidecar_log_path.as_deref() {
        if let Ok(Some(output)) = sidecar_startup_failure_tail(path) {
            message.push_str("\nmanaged backend captured output:\n");
            message.push_str(&output);
        }
    }
    ManagedBackendStartupFailure {
        message,
        sidecar_log_path,
    }
}

fn observe_server_process(server: &Server) -> ManagedBackendProcessObservation {
    let mut lock = server.state.lock().unwrap();
    let Some(port) = lock.port else {
        return ManagedBackendProcessObservation::Inactive;
    };
    let sidecar_log_path = lock.sidecar_log_path.clone();
    let Some(child) = lock.child.as_mut() else {
        return ManagedBackendProcessObservation::Inactive;
    };
    match child.try_wait() {
        Ok(None) => ManagedBackendProcessObservation::Running(server_info_with_pid_and_log(
            port,
            child.id(),
            sidecar_log_path,
        )),
        terminal => {
            let (mut reason, exit_status) = match terminal {
                Ok(Some(status)) => (
                    format!("managed backend exited before becoming healthy: {status}"),
                    Some(status),
                ),
                Err(err) => (
                    format!(
                        "managed backend process observation failed before health readiness: {err}"
                    ),
                    None,
                ),
                Ok(None) => unreachable!("running managed backend handled above"),
            };
            lock.child = None;
            lock.port = None;
            lock.sidecar_log_path = None;
            if let Some(occurrence) = lock.process_occurrence.take() {
                if let Err(err) = terminalize_managed_process_occurrence(
                    &occurrence,
                    "early_exit",
                    Some("health-observer"),
                    false,
                    exit_status.as_ref(),
                ) {
                    reason.push_str(&format!("; supervisor evidence persistence failed: {err}"));
                }
            }
            lock.payload_lease = None;
            #[cfg(windows)]
            {
                lock.job = None;
            }
            #[cfg(unix)]
            {
                lock.pgid = None;
            }
            ManagedBackendProcessObservation::Terminal(managed_backend_terminal_failure(
                reason,
                sidecar_log_path,
            ))
        }
    }
}

fn current_server_info(server: &Server) -> Option<OverlayServerInfo> {
    match observe_server_process(server) {
        ManagedBackendProcessObservation::Running(info) => Some(info),
        ManagedBackendProcessObservation::Inactive
        | ManagedBackendProcessObservation::Terminal(_) => None,
    }
}

fn wait_for_server_health<R: Runtime>(
    app: &AppHandle<R>,
    timeout: Duration,
) -> Result<OverlayServerInfo, ManagedBackendStartupFailure> {
    let server = app.state::<Server>();
    let started = Instant::now();
    let mut last_observation: String;
    let mut sidecar_log_path = None;
    let authorization = server_shutdown_authorization();

    loop {
        match observe_server_process(&server) {
            ManagedBackendProcessObservation::Running(info) => {
                sidecar_log_path = info.sidecar_log_path.as_ref().map(PathBuf::from);
                let address = (LOCAL_SERVER_HOST, info.port)
                    .to_socket_addrs()
                    .map_err(|err| ManagedBackendStartupFailure {
                        message: format!("failed to resolve managed backend health address: {err}"),
                        sidecar_log_path: sidecar_log_path.clone(),
                    })?
                    .next()
                    .ok_or_else(|| ManagedBackendStartupFailure {
                        message: "managed backend health address did not resolve".to_string(),
                        sidecar_log_path: sidecar_log_path.clone(),
                    })?;
                match probe_server_health(
                    address,
                    SERVER_HEALTH_ATTEMPT_TIMEOUT,
                    authorization.as_deref(),
                ) {
                    Ok(ServerHealth::Healthy) => return Ok(info),
                    Ok(ServerHealth::Unhealthy) => {
                        last_observation = "health endpoint reported unhealthy".to_string()
                    }
                    Err(err) => last_observation = err,
                }
            }
            ManagedBackendProcessObservation::Terminal(failure) => return Err(failure),
            ManagedBackendProcessObservation::Inactive => {
                return Err(ManagedBackendStartupFailure {
                    message: "managed backend process is inactive after spawn".to_string(),
                    sidecar_log_path,
                })
            }
        }

        let elapsed = started.elapsed();
        if elapsed >= timeout {
            return Err(ManagedBackendStartupFailure {
                message: format!(
                    "managed backend did not become healthy within {} seconds: {last_observation}",
                    timeout.as_secs()
                ),
                sidecar_log_path,
            });
        }
        thread::sleep(SERVER_HEALTH_RETRY_INTERVAL.min(timeout - elapsed));
    }
}

fn wait_for_child_exit(
    child: &mut Child,
    timeout: Duration,
) -> Result<Option<std::process::ExitStatus>, String> {
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(Some(status)),
            Ok(None) => {
                if started.elapsed() >= timeout {
                    return Ok(None);
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(err) => return Err(err.to_string()),
        }
    }
}

fn ensure_sidecar_cwd_dir(sidecar_cwd: &Path) -> Result<(), String> {
    fs::create_dir_all(sidecar_cwd).map_err(|err| {
        format!(
            "failed to create sidecar cwd {}: {err}",
            sidecar_cwd.to_string_lossy()
        )
    })
}

fn append_overlay_startup_diagnostic<R: Runtime>(
    app: &AppHandle<R>,
    message: &str,
) -> Result<PathBuf, String> {
    let paths = overlay_runtime_paths(app)?;
    let dir = paths.log_dir;
    fs::create_dir_all(&dir).map_err(|err| {
        format!(
            "cannot create overlay startup diagnostic directory {}: {err}",
            dir.to_string_lossy()
        )
    })?;
    let path = dir.join("overlay-startup.log");
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|err| format!("system clock is before Unix epoch: {err}"))?
        .as_secs();
    let entry = format!("[{secs}] {message}\n\n");
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|err| {
            format!(
                "cannot open overlay startup diagnostic log {}: {err}",
                path.to_string_lossy()
            )
        })?;
    file.write_all(entry.as_bytes()).map_err(|err| {
        format!(
            "cannot write overlay startup diagnostic log {}: {err}",
            path.to_string_lossy()
        )
    })?;
    Ok(path)
}

fn startup_failure_diagnostic_message(
    error: &str,
    log_path: Option<&PathBuf>,
    diagnostic_error: Option<&str>,
) -> String {
    let mut parts = vec![
        "OpenCorvus backend failed to start.".to_string(),
        error.to_string(),
    ];
    if let Some(path) = log_path {
        parts.push(format!(
            "overlay diagnostic log: {}",
            path.to_string_lossy()
        ));
    }
    if let Some(diagnostic_error) = diagnostic_error {
        parts.push(format!(
            "overlay diagnostic log unavailable: {diagnostic_error}"
        ));
    }
    parts.join("\n\n")
}

fn surface_startup_failure<R: Runtime>(
    app: &AppHandle<R>,
    error: &str,
    sidecar_log_path: Option<&Path>,
) -> Option<PathBuf> {
    let recorded_error = match sidecar_log_path {
        Some(path) => format!("{error}\nsidecar log: {}", path.to_string_lossy()),
        None => error.to_string(),
    };
    let diagnostic = append_overlay_startup_diagnostic(app, &recorded_error);
    let (log_path, diagnostic_error) = match diagnostic {
        Ok(path) => (Some(path), None),
        Err(error) => (None, Some(error)),
    };
    let details = startup_failure_diagnostic_message(
        &recorded_error,
        log_path.as_ref(),
        diagnostic_error.as_deref(),
    );
    eprintln!("overlay: initial managed server start failed: {details}");

    if let Err(err) = app
        .notification()
        .builder()
        .title("OpenCorvus backend failed to start")
        .body("Overlay could not start the managed backend. Open the error dialog for the diagnostic log path.")
        .large_body(details.clone())
        .show()
    {
        let retry = format!("native notification failed: {err}\n\n{details}");
        if let Err(write_error) = append_overlay_startup_diagnostic(app, &retry) {
            eprintln!("overlay: cannot persist notification failure: {write_error}");
        }
        eprintln!("overlay: native startup failure notification failed: {err}");
    }

    app.dialog()
        .message(details)
        .title("OpenCorvus backend failed to start")
        .kind(MessageDialogKind::Error)
        .show(|_| {});

    log_path
}

/// Build (stdout, stderr) targets for the managed sidecar. Both streams use a
/// single per-launch file so startup failures remain observable in event order.
fn sidecar_stdio_targets(log_dir: &Path) -> Result<(Stdio, Stdio, PathBuf), String> {
    fs::create_dir_all(log_dir).map_err(|err| {
        format!(
            "cannot create sidecar log directory {}: {err}",
            log_dir.to_string_lossy()
        )
    })?;
    let pid = std::process::id();
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|err| format!("system clock is before Unix epoch: {err}"))?
        .as_secs();
    let path = log_dir.join(format!("sidecar-{}-{}.log", secs, pid));
    let file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|err| format!("cannot open sidecar log {}: {err}", path.to_string_lossy()))?;
    let dup = file.try_clone().map_err(|err| {
        format!(
            "cannot clone sidecar log handle {}: {err}",
            path.to_string_lossy()
        )
    })?;
    Ok((Stdio::from(file), Stdio::from(dup), path))
}

struct PreparedServer {
    runtime_paths: OverlayRuntimePaths,
    resolved_server: ResolvedEmbeddedServer,
}

fn prepare_server<R: Runtime>(
    app: &AppHandle<R>,
    report_progress: &mut dyn FnMut(StartupProgress),
) -> Result<PreparedServer, String> {
    let runtime_paths = overlay_runtime_paths(app)?;
    let resolved_server = ensure_embedded_server_path(&runtime_paths, report_progress)?;
    Ok(PreparedServer {
        runtime_paths,
        resolved_server,
    })
}

fn start_prepared_server<R: Runtime>(
    app: &AppHandle<R>,
    prepared: PreparedServer,
    report_progress: &mut dyn FnMut(StartupProgress),
) -> Result<OverlayServerInfo, String> {
    let PreparedServer {
        runtime_paths,
        resolved_server,
    } = prepared;
    let path = resolved_server.executable;
    let total_bytes = embedded_payload_total_bytes();
    report_progress(StartupProgress::starting(
        total_bytes,
        "Starting embedded backend",
    ));
    let port = next_server_port()?;

    // Capture the sidecar's stdio to a per-launch log file. Without this,
    // any panic the sidecar produces before its internal Log.init() writes
    // the first record (env/proxy detection, registry probes, missing DLLs,
    // bun runtime errors) is silently dropped — which is exactly what makes
    // VM-only failures impossible to diagnose. The Tauri-side stderr is
    // already eaten by the windows_subsystem = "windows" attribute, so the
    // log file is the only signal.
    let (stdout_target, stderr_target, sidecar_log_path) =
        sidecar_stdio_targets(&runtime_paths.log_dir)?;

    // W2-V35: ensure the spawned sidecar inherits a writable, predictable
    // cwd. Without this, macOS .app launched from Finder/Dock spawns the
    // sidecar with `cwd="/"`. Anything inside the sidecar that reads
    // `process.cwd()` (or did so before W2-V31 / W2-V32 removed the
    // server-side fallbacks) would then attempt to write at `/` and
    // permission-deny across every project route.
    let sidecar_cwd = runtime_paths.data_dir;
    ensure_sidecar_cwd_dir(&sidecar_cwd).map_err(|err| {
        let log = sidecar_log_path.to_string_lossy();
        format!(
            "{err}\nserver binary: {}\nserver cwd: {}\nserver port: {port}\nsidecar log: {log}",
            path.to_string_lossy(),
            sidecar_cwd.to_string_lossy(),
        )
    })?;
    let mut process_occurrence =
        prepare_managed_process_occurrence(&sidecar_cwd, port, &path, &sidecar_log_path)?;
    let mut cmd = Command::new(&path);
    cmd.current_dir(&sidecar_cwd)
        .arg("serve")
        .arg("--hostname")
        .arg(LOCAL_SERVER_HOST)
        .arg("--port")
        .arg(port.to_string())
        .arg("--parent-pid")
        .arg(std::process::id().to_string())
        .env("OPENCORVUS_VERSION", env!("CARGO_PKG_VERSION"))
        .env("OPENCORVUS_CHANNEL", "latest")
        .env("OPENCORVUS_CLIENT", "app")
        .env("OPENCORVUS_PROCESS_OCCURRENCE_ID", &process_occurrence.id)
        .env(
            "OPENCORVUS_PROCESS_OCCURRENCE_PATH",
            &process_occurrence.path,
        )
        .env(
            "OPENCORVUS_PROCESS_SHUTDOWN_REQUEST_PATH",
            &process_occurrence.shutdown_request_path,
        )
        // Overlay-launched opencorvus must always write trace files under the
        // active project's `<Instance.directory>/.opencorvus/trace/`. Inheriting
        // a stray `OPENCORVUS_AGENT_TRACE_DIR` from the launching shell (or
        // a prior benchmark run that exported it globally) would silently
        // route trace into a stale temp path instead of the project directory,
        // and the overlay's debug surfaces would never see it. Strip it before
        // spawn so the env override only applies where it's set on purpose.
        .env_remove("OPENCORVUS_AGENT_TRACE_DIR")
        .stdin(Stdio::null())
        .stdout(stdout_target)
        .stderr(stderr_target);
    cmd.env("OPENCORVUS_HOME", &runtime_paths.root);
    if let Some(predecessor_path) = process_occurrence.predecessor_path.as_ref() {
        cmd.env(
            "OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH",
            predecessor_path,
        );
    } else {
        cmd.env_remove("OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH");
    }
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    // Unix: move child into its own process group so kill(-pgid) reaches all
    // grandchildren (LSP servers, PTY shells, JSON-RPC processes, etc.).
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    let spawned_child = cmd.spawn().map_err(|err| {
        let evidence_error = terminalize_managed_process_occurrence(
            &process_occurrence,
            "spawn_failed",
            Some("spawn"),
            false,
            None,
        )
        .err()
        .map(|failure| format!("\nsupervisor evidence persistence failed: {failure}"))
        .unwrap_or_default();
        let log = sidecar_log_path.to_string_lossy();
        format!(
            "failed to spawn bundled opencorvus server: {err}\nserver binary: {}\nserver cwd: {}\nserver port: {port}\nsidecar log: {log}{evidence_error}",
            path.to_string_lossy(),
            sidecar_cwd.to_string_lossy(),
        )
    })?;
    let mut child = spawned_child;

    // Windows: assign the child to a kill-on-close Job Object so the entire
    // process tree is terminated automatically when the overlay exits.
    #[cfg(windows)]
    let job = {
        let raw = child.as_raw_handle() as job_object::HANDLE;
        match job_object::create_and_assign(raw) {
            Ok(job) => job,
            Err(job_error) => {
                let kill_result = match child.kill() {
                    Ok(()) => "child termination requested".to_string(),
                    Err(err) => format!("child termination failed: {err}"),
                };
                let wait_result = match child.wait() {
                    Ok(status) => format!("child reaped with status {status}"),
                    Err(err) => format!("child reap failed: {err}"),
                };
                terminalize_managed_process_occurrence(
                    &process_occurrence,
                    "ownership_failed",
                    Some("ownership"),
                    true,
                    None,
                )?;
                return Err(format!(
                    "failed to establish Windows sidecar process-tree ownership: {job_error}\n{kill_result}\n{wait_result}\nsidecar log: {}",
                    sidecar_log_path.to_string_lossy()
                ));
            }
        }
    };

    // Unix: PGID == child PID because we used process_group(0).
    #[cfg(unix)]
    let pgid = child.id();

    let pid = child.id();
    process_occurrence.pid = Some(pid);
    if let Err(err) = write_managed_process_occurrence(
        &process_occurrence,
        "running",
        None,
        None,
        None,
        None,
        None,
    )
    .and_then(|_| publish_managed_process_occurrence_locator(&process_occurrence))
    {
        let _ = child.kill();
        let _ = child.wait();
        let evidence_error = terminalize_managed_process_occurrence(
            &process_occurrence,
            "occurrence_publish_failed",
            Some("supervisor-publish"),
            true,
            None,
        )
        .err()
        .map(|failure| format!("; supervisor terminal evidence persistence failed: {failure}"))
        .unwrap_or_default();
        return Err(format!("{err}{evidence_error}"));
    }
    let info = server_info_with_pid_and_log(port, pid, Some(sidecar_log_path.clone()));
    let state = app.state::<Server>();
    let mut lock = state.state.lock().unwrap();
    lock.child = Some(child);
    lock.port = Some(port);
    lock.sidecar_log_path = Some(sidecar_log_path);
    lock.process_occurrence = Some(process_occurrence);
    lock.payload_lease = Some(resolved_server.lease);
    #[cfg(windows)]
    {
        lock.job = Some(job);
    }
    #[cfg(unix)]
    {
        lock.pgid = Some(pgid);
    }
    Ok(info)
}

fn restart_server_with_progress<R: Runtime>(
    app: &AppHandle<R>,
    report_progress: &mut dyn FnMut(StartupProgress),
) -> Result<OverlayServerInfo, String> {
    let server = app.state::<Server>();
    with_prepared_server(
        &server,
        report_progress,
        |report_progress| prepare_server(app, report_progress),
        |report_progress, prepared| {
            stop_server_state(&server)?;
            start_prepared_server(app, prepared, report_progress)
        },
    )
}

fn restart_server<R: Runtime>(app: &AppHandle<R>) -> Result<OverlayServerInfo, String> {
    restart_server_with_progress(app, &mut |_| {})
}

fn ensure_server_with_progress<R: Runtime>(
    app: &AppHandle<R>,
    report_progress: &mut dyn FnMut(StartupProgress),
) -> Result<OverlayServerInfo, String> {
    let server = app.state::<Server>();
    {
        let _operation = server.operation.lock().unwrap();
        if let Some(info) = current_server_info(&server) {
            return Ok(info);
        }
    }

    with_prepared_server(
        &server,
        report_progress,
        |report_progress| prepare_server(app, report_progress),
        |report_progress, prepared| {
            if let Some(info) = current_server_info(&server) {
                return Ok(info);
            }
            start_prepared_server(app, prepared, report_progress)
        },
    )
}

fn ensure_server<R: Runtime>(app: &AppHandle<R>) -> Result<OverlayServerInfo, String> {
    ensure_server_with_progress(app, &mut |_| {})
}

fn emit_startup_progress<R: Runtime>(app: &AppHandle<R>, progress: StartupProgress) {
    if let Err(err) = app.emit(STARTUP_PROGRESS_EVENT, progress) {
        eprintln!("overlay: failed to emit startup progress: {err}");
    }
}

type ServerStartupOperation<R> =
    fn(&AppHandle<R>, &mut dyn FnMut(StartupProgress)) -> Result<OverlayServerInfo, String>;

fn run_startup_worker<R: Runtime>(app: AppHandle<R>, start_operation: ServerStartupOperation<R>) {
    let server = app.state::<Server>();
    server.worker.execute(|| {
        let total_bytes = embedded_payload_total_bytes();
        let mut completed_bytes = 0;
        let startup_surface_reveal = Once::new();
        let reveal_startup_surface = || {
            startup_surface_reveal.call_once(|| {
                if let Some(window) = app.get_webview_window("main") {
                    show_window(&window);
                }
            });
        };
        let mut report_progress = |progress: StartupProgress| {
            reveal_startup_surface();
            completed_bytes = progress.completed_bytes;
            emit_startup_progress(&app, progress);
        };
        let startup = start_operation(&app, &mut report_progress);
        drop(report_progress);

        match startup {
            Ok(_) => {
                // HTTP means Hypertext Transfer Protocol. A successful TCP accept is
                // not readiness; the backend must answer its explicit health route.
                match wait_for_server_health(&app, SERVER_HEALTH_READINESS_TIMEOUT) {
                    Ok(_) => emit_startup_progress(
                        &app,
                        StartupProgress::ready(total_bytes, "Backend ready"),
                    ),
                    Err(failure) => {
                        reveal_startup_surface();
                        let error = failure.message;
                        let sidecar_log = failure.sidecar_log_path;
                        // The overlay diagnostic is the sole failure-event log owner.
                        // A sidecar path is recorded inside it as evidence, never
                        // substituted as a second `logPath` source.
                        let diagnostic_log =
                            surface_startup_failure(&app, &error, sidecar_log.as_deref());
                        emit_startup_progress(
                            &app,
                            StartupProgress::failed(
                                completed_bytes,
                                total_bytes,
                                error,
                                diagnostic_log.as_deref(),
                            ),
                        );
                    }
                }
            }
            Err(error) => {
                reveal_startup_surface();
                let diagnostic_log = surface_startup_failure(&app, &error, None);
                emit_startup_progress(
                    &app,
                    StartupProgress::failed(
                        completed_bytes,
                        total_bytes,
                        error,
                        diagnostic_log.as_deref(),
                    ),
                );
            }
        }
    });
}

fn spawn_startup_worker<R: Runtime>(app: AppHandle<R>, start_operation: ServerStartupOperation<R>) {
    thread::spawn(move || run_startup_worker(app, start_operation));
}

#[tauri::command]
fn overlay_server_info<R: Runtime>(app: AppHandle<R>) -> Result<OverlayServerInfo, String> {
    ensure_server(&app)
}

#[tauri::command]
fn overlay_server_restart<R: Runtime>(app: AppHandle<R>) -> Result<OverlayServerInfo, String> {
    restart_server(&app)
}

#[tauri::command]
fn overlay_startup_retry<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    spawn_startup_worker(app, restart_server_with_progress::<R>);
    Ok(true)
}

#[tauri::command]
fn overlay_startup_open_log<R: Runtime>(app: AppHandle<R>, path: String) -> Result<bool, String> {
    overlay_open_path(app, path)
}

/// AUMID means Application User Model ID, the stable identity Windows requires
/// for a portable desktop executable to submit an attributed system toast.
#[cfg(windows)]
fn windows_notification_identity<'a>(
    application_id: &'a str,
    product_name: Option<&'a str>,
) -> Result<(&'a str, &'a str), String> {
    let display_name = product_name.ok_or_else(|| {
        "Windows notification display name is missing from Tauri configuration".to_string()
    })?;
    Ok((application_id, display_name))
}

#[cfg(windows)]
fn send_overlay_system_notification<R: Runtime>(
    app: &AppHandle<R>,
    title: &str,
    body: Option<&str>,
) -> Result<(), String> {
    let config = app.config();
    let (application_id, display_name) =
        windows_notification_identity(config.identifier.as_str(), config.product_name.as_deref())?;
    register(application_id, display_name, None).map_err(|error| {
        format!("cannot register Windows notification identity {application_id}: {error}")
    })?;

    let mut toast = Toast::new();
    toast.text1(title);
    if let Some(body) = body {
        toast.text2(body);
    }
    let manager = ToastManager::new(application_id);
    manager
        .show(&toast)
        .map_err(|error| format!("cannot submit Windows system notification: {error}"))
}

#[cfg(not(windows))]
fn send_overlay_system_notification<R: Runtime>(
    app: &AppHandle<R>,
    title: &str,
    body: Option<&str>,
) -> Result<(), String> {
    let mut notification = app.notification().builder().title(title);
    if let Some(body) = body {
        notification = notification.body(body);
    }
    notification
        .show()
        .map_err(|error| format!("cannot submit system notification: {error}"))
}

#[tauri::command]
fn overlay_notification_send<R: Runtime>(
    app: AppHandle<R>,
    title: String,
    body: Option<String>,
) -> Result<bool, String> {
    deliver_native_message_notification(
        || request_native_notification_attention(&app),
        || send_overlay_system_notification(&app, &title, body.as_deref()),
    )
}

fn deliver_native_message_notification(
    request_attention: impl FnOnce() -> Result<(), String>,
    send_system_notification: impl FnOnce() -> Result<(), String>,
) -> Result<bool, String> {
    request_attention()?;
    send_system_notification()?;
    Ok(true)
}

/// Embed the window icon at compile time so it works in both dev and prod builds.
const WINDOW_ICON_PNG: &[u8] = include_bytes!("../icons/icon.png");

fn embedded_icon(size: Option<u32>) -> Option<tauri::image::Image<'static>> {
    match image::load_from_memory_with_format(WINDOW_ICON_PNG, image::ImageFormat::Png) {
        Ok(img) => {
            let rgba = if let Some(size) = size {
                img.resize_exact(size, size, image::imageops::FilterType::Lanczos3)
                    .to_rgba8()
            } else {
                img.to_rgba8()
            };
            let (width, height) = rgba.dimensions();
            Some(tauri::image::Image::new_owned(
                rgba.into_raw(),
                width,
                height,
            ))
        }
        Err(err) => {
            eprintln!("overlay: failed to decode window icon: {err}");
            None
        }
    }
}

fn tray_background(pixel: &image::Rgba<u8>) -> bool {
    let [r, g, b, a] = pixel.0;
    if a == 0 {
        return false;
    }

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let lum = (u16::from(r) + u16::from(g) + u16::from(b)) / 3;
    max - min <= 28 && lum >= 150
}

fn queue_tray_pixel(
    rgba: &image::RgbaImage,
    seen: &mut [bool],
    queue: &mut VecDeque<(u32, u32)>,
    x: u32,
    y: u32,
) {
    let idx = (y * rgba.width() + x) as usize;
    if seen[idx] || !tray_background(rgba.get_pixel(x, y)) {
        return;
    }
    seen[idx] = true;
    queue.push_back((x, y));
}

fn clear_tray_background(rgba: &mut image::RgbaImage) {
    let (width, height) = rgba.dimensions();
    let mut seen = vec![false; (width * height) as usize];
    let mut queue = VecDeque::new();

    for x in 0..width {
        queue_tray_pixel(rgba, &mut seen, &mut queue, x, 0);
        queue_tray_pixel(rgba, &mut seen, &mut queue, x, height - 1);
    }
    for y in 1..height.saturating_sub(1) {
        queue_tray_pixel(rgba, &mut seen, &mut queue, 0, y);
        queue_tray_pixel(rgba, &mut seen, &mut queue, width - 1, y);
    }

    while let Some((x, y)) = queue.pop_front() {
        rgba.get_pixel_mut(x, y).0[3] = 0;

        if x > 0 {
            queue_tray_pixel(rgba, &mut seen, &mut queue, x - 1, y);
        }
        if x + 1 < width {
            queue_tray_pixel(rgba, &mut seen, &mut queue, x + 1, y);
        }
        if y > 0 {
            queue_tray_pixel(rgba, &mut seen, &mut queue, x, y - 1);
        }
        if y + 1 < height {
            queue_tray_pixel(rgba, &mut seen, &mut queue, x, y + 1);
        }
    }
}

fn crop_tray_icon(rgba: image::RgbaImage) -> Option<image::RgbaImage> {
    let (width, height) = rgba.dimensions();
    let mut left = width;
    let mut top = height;
    let mut right = 0;
    let mut bottom = 0;

    for y in 0..height {
        for x in 0..width {
            if rgba.get_pixel(x, y).0[3] == 0 {
                continue;
            }
            left = left.min(x);
            top = top.min(y);
            right = right.max(x);
            bottom = bottom.max(y);
        }
    }

    if left == width || top == height {
        return None;
    }

    let pad = ((right - left + 1).min(bottom - top + 1) / 18).max(12);
    let left = left.saturating_sub(pad);
    let top = top.saturating_sub(pad);
    let right = (right + pad).min(width - 1);
    let bottom = (bottom + pad).min(height - 1);

    Some(image::imageops::crop_imm(&rgba, left, top, right - left + 1, bottom - top + 1).to_image())
}

fn tray_icon_from_bundle() -> Option<tauri::image::Image<'static>> {
    match image::load_from_memory_with_format(WINDOW_ICON_PNG, image::ImageFormat::Png) {
        Ok(img) => {
            let mut rgba = img.to_rgba8();
            clear_tray_background(&mut rgba);
            let rgba = crop_tray_icon(rgba)?;
            let rgba = image::DynamicImage::ImageRgba8(rgba)
                .resize_exact(32, 32, image::imageops::FilterType::Lanczos3)
                .to_rgba8();
            Some(tauri::image::Image::new_owned(rgba.into_raw(), 32, 32))
        }
        Err(err) => {
            eprintln!("overlay: failed to decode tray icon: {err}");
            None
        }
    }
}

fn set_window_icon<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    if let Some(icon) = embedded_icon(None) {
        let _ = window.set_icon(icon);
    }
}

fn show_window<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    clear_native_notification_attention(|| window.request_user_attention(None));
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

fn native_notification_attention_type() -> UserAttentionType {
    UserAttentionType::Informational
}

fn request_native_notification_attention<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or_else(|| {
        "main window is unavailable for native notification attention".to_string()
    })?;
    window
        .request_user_attention(Some(native_notification_attention_type()))
        .map_err(|error| format!("cannot request native notification attention: {error}"))
}

fn clear_native_notification_attention<E: std::fmt::Display>(
    clear_attention: impl FnOnce() -> Result<(), E>,
) {
    if let Err(error) = clear_attention() {
        eprintln!("overlay: cannot clear native notification attention: {error}");
    }
}

#[tauri::command]
#[cfg(feature = "devtools")]
fn overlay_toggle_devtools<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
        Ok(true)
    } else {
        Ok(false)
    }
}

fn desktop_update_error(
    code: &'static str,
    context: &'static str,
    error: impl std::fmt::Display,
) -> DesktopUpdateCommandError {
    DesktopUpdateCommandError::new(code, format!("{context}: {error}"))
}

fn emit_desktop_update_progress<R: Runtime>(app: &AppHandle<R>, progress: DesktopUpdateProgress) {
    if let Err(error) = app.emit_to("main", "overlay:desktop-update-progress", progress) {
        eprintln!("overlay: failed to emit desktop update progress: {error}");
    }
}

#[tauri::command]
async fn overlay_desktop_update_check<R: Runtime>(
    app: AppHandle<R>,
) -> Result<DesktopUpdateInfo, DesktopUpdateCommandError> {
    let coordinator = app.state::<DesktopUpdateCoordinator>();
    let _operation = coordinator.begin()?;
    let updater = app.updater().map_err(|error| {
        desktop_update_error(
            "DESKTOP_UPDATE_CHECK_FAILED",
            "Cannot configure desktop updater",
            error,
        )
    })?;
    let update = updater.check().await.map_err(|error| {
        desktop_update_error(
            "DESKTOP_UPDATE_CHECK_FAILED",
            "Cannot check for desktop updates",
            error,
        )
    })?;

    let Some(update) = update else {
        *coordinator.prepared.lock().unwrap() = None;
        return Ok(DesktopUpdateInfo::current());
    };
    let info = DesktopUpdateInfo::available(&update, None);
    if coordinator
        .prepared
        .lock()
        .unwrap()
        .as_ref()
        .map(|prepared| prepared.update.version.as_str())
        != Some(update.version.as_str())
    {
        *coordinator.prepared.lock().unwrap() = None;
    }
    Ok(info)
}

#[tauri::command]
async fn overlay_desktop_update_download<R: Runtime>(
    app: AppHandle<R>,
    expected_version: String,
) -> Result<DesktopUpdateInfo, DesktopUpdateCommandError> {
    let expected_version = expected_version.trim().to_string();
    if expected_version.is_empty() {
        return Err(DesktopUpdateCommandError::new(
            "DESKTOP_UPDATE_VERSION_REQUIRED",
            "The expected desktop update version is required.",
        ));
    }
    let coordinator = app.state::<DesktopUpdateCoordinator>();
    let _operation = coordinator.begin()?;
    let updater = app.updater().map_err(|error| {
        desktop_update_error(
            "DESKTOP_UPDATE_DOWNLOAD_FAILED",
            "Cannot configure desktop updater",
            error,
        )
    })?;
    let update = updater
        .check()
        .await
        .map_err(|error| {
            desktop_update_error(
                "DESKTOP_UPDATE_DOWNLOAD_FAILED",
                "Cannot refresh desktop update",
                error,
            )
        })?
        .ok_or_else(|| {
            DesktopUpdateCommandError::new(
                "DESKTOP_UPDATE_NOT_AVAILABLE",
                "The announced desktop update is no longer available.",
            )
        })?;
    if update.version != expected_version {
        return Err(DesktopUpdateCommandError::new(
            "DESKTOP_UPDATE_VERSION_CHANGED",
            format!(
                "The desktop update changed from {expected_version} to {}. Check again before downloading.",
                update.version
            ),
        ));
    }

    let downloaded = Arc::new(AtomicU64::new(0));
    let progress_bytes = downloaded.clone();
    let progress_app = app.clone();
    let progress_version = update.version.clone();
    let finish_bytes = downloaded.clone();
    let finish_app = app.clone();
    let finish_version = update.version.clone();
    let bytes = update
        .download(
            move |chunk_length, content_length| {
                let downloaded_bytes = progress_bytes
                    .fetch_add(chunk_length as u64, Ordering::AcqRel)
                    + chunk_length as u64;
                emit_desktop_update_progress(
                    &progress_app,
                    DesktopUpdateProgress {
                        version: progress_version.clone(),
                        downloaded_bytes,
                        total_bytes: content_length,
                        finished: false,
                    },
                );
            },
            move || {
                emit_desktop_update_progress(
                    &finish_app,
                    DesktopUpdateProgress {
                        version: finish_version,
                        downloaded_bytes: finish_bytes.load(Ordering::Acquire),
                        total_bytes: None,
                        finished: true,
                    },
                );
            },
        )
        .await
        .map_err(|error| {
            desktop_update_error(
                "DESKTOP_UPDATE_DOWNLOAD_FAILED",
                "Cannot download signed desktop update",
                error,
            )
        })?;
    let info = DesktopUpdateInfo::available(&update, Some(bytes.len() as u64));
    *coordinator.prepared.lock().unwrap() = Some(PreparedDesktopUpdate { update, bytes });
    Ok(info)
}

#[tauri::command]
fn overlay_desktop_update_install<R: Runtime>(
    app: AppHandle<R>,
    expected_version: String,
) -> Result<bool, DesktopUpdateCommandError> {
    let expected_version = expected_version.trim();
    let coordinator = app.state::<DesktopUpdateCoordinator>();
    let _operation = coordinator.begin()?;
    let prepared = {
        let mut prepared = coordinator.prepared.lock().unwrap();
        let matches = prepared
            .as_ref()
            .map(|update| update.update.version.as_str())
            == Some(expected_version);
        if !matches {
            return Err(DesktopUpdateCommandError::new(
                "DESKTOP_UPDATE_NOT_DOWNLOADED",
                format!("Desktop update {expected_version} has not been downloaded and verified."),
            ));
        }
        prepared.take().unwrap()
    };

    // The verified package survives a failed install: put it back so the next
    // attempt installs what was already downloaded instead of reporting the
    // package missing forever.
    let restore = |prepared: PreparedDesktopUpdate| {
        *coordinator.prepared.lock().unwrap() = Some(prepared);
    };

    {
        let server = app.state::<Server>();
        let _server_operation = server.operation.lock().unwrap();
        if let Err(error) = stop_server_state(&server) {
            restore(prepared);
            return Err(desktop_update_error(
                "DESKTOP_UPDATE_SHUTDOWN_FAILED",
                "Cannot establish terminal managed-backend ownership before update",
                error,
            ));
        }
    }

    let installed = prepared.update.install(&prepared.bytes);
    if let Err(error) = installed {
        let recovery = restart_server(&app).err();
        let recovery_suffix = recovery
            .map(|restart_error| format!(" Managed backend restart also failed: {restart_error}"))
            .unwrap_or_default();
        restore(prepared);
        return Err(DesktopUpdateCommandError::new(
            "DESKTOP_UPDATE_INSTALL_FAILED",
            format!("Cannot install verified desktop update: {error}.{recovery_suffix}"),
        ));
    }
    app.restart()
}

#[tauri::command]
fn overlay_quit<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    app.exit(0);
    Ok(true)
}

#[cfg(target_os = "macos")]
fn build_macos_application_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let settings = MenuItem::with_id(
        app,
        "native-menu:settings",
        "Settings...",
        true,
        Some("CmdOrCtrl+,"),
    )?;
    let quit = MenuItem::with_id(
        app,
        "native-menu:quit",
        "Quit OpenCorvus",
        true,
        Some("CmdOrCtrl+Q"),
    )?;
    let application = SubmenuBuilder::new(app, "OpenCorvus")
        .about(Some(
            AboutMetadataBuilder::new()
                .name(Some("OpenCorvus"))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .build(),
        ))
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .item(&quit)
        .build()?;

    let new_window = MenuItem::with_id(
        app,
        "native-menu:new-window",
        "New Window",
        true,
        Some("CmdOrCtrl+Shift+N"),
    )?;
    let new_chat = MenuItem::with_id(
        app,
        "native-menu:new-chat",
        "New Chat",
        true,
        Some("CmdOrCtrl+N"),
    )?;
    let quick_chat = MenuItem::with_id(
        app,
        "native-menu:quick-chat",
        "Quick Chat",
        true,
        Some("CmdOrCtrl+Alt+N"),
    )?;
    let open_folder = MenuItem::with_id(
        app,
        "native-menu:open-folder",
        "Open Folder...",
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let close_project = MenuItem::with_id(
        app,
        "native-menu:close-project",
        "Close Project",
        true,
        Some("CmdOrCtrl+W"),
    )?;
    let file = SubmenuBuilder::new(app, "File")
        .item(&new_window)
        .item(&new_chat)
        .item(&quick_chat)
        .separator()
        .item(&open_folder)
        .item(&close_project)
        .build()?;

    let search = MenuItem::with_id(
        app,
        "native-menu:search",
        "Search",
        true,
        Some("CmdOrCtrl+G"),
    )?;
    let providers = MenuItem::with_id(
        app,
        "native-menu:providers",
        "Providers...",
        true,
        None::<&str>,
    )?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&search)
        .item(&providers)
        .build()?;

    let theme = SubmenuBuilder::new(app, "Theme")
        .text("native-menu:theme-system", "System")
        .text("native-menu:theme-light", "Light")
        .text("native-menu:theme-dark", "Dark")
        .text("native-menu:theme-vscode-dark", "VS Code Dark")
        .build()?;
    let toggle_locale = MenuItem::with_id(
        app,
        "native-menu:toggle-locale",
        "Switch Language",
        true,
        None::<&str>,
    )?;
    let zoom_in = MenuItem::with_id(
        app,
        "native-menu:zoom-in",
        "Zoom In",
        true,
        Some("CmdOrCtrl+="),
    )?;
    let zoom_out = MenuItem::with_id(
        app,
        "native-menu:zoom-out",
        "Zoom Out",
        true,
        Some("CmdOrCtrl+-"),
    )?;
    let zoom_reset = MenuItem::with_id(
        app,
        "native-menu:zoom-reset",
        "Actual Size",
        true,
        Some("CmdOrCtrl+0"),
    )?;
    let reset_layout = MenuItem::with_id(
        app,
        "native-menu:reset-layout",
        "Reset Layout",
        true,
        None::<&str>,
    )?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&theme)
        .item(&toggle_locale)
        .separator()
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_reset)
        .separator()
        .item(&reset_layout)
        .build()?;

    let window = SubmenuBuilder::new(app, "Window")
        .minimize()
        .fullscreen()
        .separator()
        .bring_all_to_front()
        .build()?;

    let docs = MenuItem::with_id(app, "native-menu:docs", "Documentation", true, None::<&str>)?;
    let sdk = MenuItem::with_id(app, "native-menu:sdk", "SDK Reference", true, None::<&str>)?;
    let logs = MenuItem::with_id(app, "native-menu:logs", "Open Logs", true, None::<&str>)?;
    let devtools = MenuItem::with_id(
        app,
        "native-menu:devtools",
        "Developer Tools",
        cfg!(debug_assertions),
        None::<&str>,
    )?;
    let help = SubmenuBuilder::new(app, "Help")
        .item(&docs)
        .item(&sdk)
        .separator()
        .item(&logs)
        .item(&devtools)
        .build()?;

    MenuBuilder::new(app)
        .items(&[&application, &file, &edit, &view, &window, &help])
        .build()
}

fn main() {
    let builder = tauri::Builder::default();

    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        for argument in argv {
            accept_expert_squad_install_handoff(app, &argument);
        }
    }));

    let builder = builder
        .manage(Server::default())
        .manage(PendingExpertSquadInstallHandoff::default())
        .manage(DesktopUpdateCoordinator::default())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_deep_link::init());

    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(build_macos_application_menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id.starts_with("native-menu:") {
                let _ = app.emit_to("main", NATIVE_MENU_EVENT, id);
            }
        });

    #[cfg(feature = "devtools")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        overlay_settings_load,
        overlay_settings_save,
        overlay_clipboard_read_text,
        overlay_clipboard_write_text,
        overlay_expert_squad_install_handoff_take,
        overlay_server_info,
        overlay_server_restart,
        overlay_startup_retry,
        overlay_startup_open_log,
        overlay_open_path,
        overlay_open_url,
        overlay_open_project_editor,
        overlay_browser_preview_sync,
        overlay_browser_preview_navigate,
        overlay_browser_preview_navigate_url,
        overlay_browser_preview_current_page,
        overlay_browser_preview_close,
        overlay_browser_preview_destroy,
        overlay_browser_preview_selection_set_enabled,
        overlay_browser_preview_selection_take,
        overlay_browser_preview_set_zoom,
        overlay_pick_dir,
        overlay_pick_files,
        overlay_notification_send,
        overlay_toggle_devtools,
        overlay_desktop_update_check,
        overlay_desktop_update_download,
        overlay_desktop_update_install,
        overlay_quit
    ]);

    #[cfg(not(feature = "devtools"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        overlay_settings_load,
        overlay_settings_save,
        overlay_clipboard_read_text,
        overlay_clipboard_write_text,
        overlay_expert_squad_install_handoff_take,
        overlay_server_info,
        overlay_server_restart,
        overlay_startup_retry,
        overlay_startup_open_log,
        overlay_open_path,
        overlay_open_url,
        overlay_open_project_editor,
        overlay_browser_preview_sync,
        overlay_browser_preview_navigate,
        overlay_browser_preview_navigate_url,
        overlay_browser_preview_current_page,
        overlay_browser_preview_close,
        overlay_browser_preview_destroy,
        overlay_browser_preview_selection_set_enabled,
        overlay_browser_preview_selection_take,
        overlay_browser_preview_set_zoom,
        overlay_pick_dir,
        overlay_pick_files,
        overlay_notification_send,
        overlay_desktop_update_check,
        overlay_desktop_update_download,
        overlay_desktop_update_install,
        overlay_quit
    ]);

    builder
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished
                && webview.label() == "main"
            {
                spawn_startup_worker(webview.app_handle().clone(), ensure_server_with_progress);
            }
        })
        .setup(|app| {
            app.manage(Server::default());
            #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
            {
                // A first Windows protocol launch reaches the registered executable as a
                // command-line argument. The deep-link plugin's `get_current()` is not a
                // reliable source for that cold-start argument, so ingest argv through the
                // same strict handoff parser used by the single-instance callback.
                for argument in std::env::args().skip(1) {
                    accept_expert_squad_install_handoff(app.handle(), &argument);
                }
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        accept_expert_squad_install_handoff(&handle, url.as_str());
                    }
                });
                if let Some(urls) = app
                    .deep_link()
                    .get_current()
                    .map_err(std::io::Error::other)?
                {
                    for url in urls {
                        accept_expert_squad_install_handoff(app.handle(), url.as_str());
                    }
                }
                #[cfg(any(windows, target_os = "linux"))]
                app.deep_link()
                    .register_all()
                    .map_err(std::io::Error::other)?;
            }
            let runtime_paths =
                overlay_runtime_paths(app.handle()).map_err(std::io::Error::other)?;
            fs::create_dir_all(&runtime_paths.webview_dir)?;
            let main_window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == "main")
                .ok_or_else(|| std::io::Error::other("main window config must exist"))?;
            let constraints = overlay_main_size_constraints(app.config());
            let placement =
                overlay_main_window_placement(app, constraints).map_err(std::io::Error::other)?;
            let startup_theme = overlay_settings_load(app.handle().clone())
                .ok()
                .flatten()
                .map(|settings| settings.theme)
                .unwrap_or_else(|| "system".to_string());
            let startup_theme_json = serde_json::to_string(&startup_theme)?;
            tauri::WebviewWindowBuilder::from_config(app.handle(), main_window_config)?
                .initialization_script(format!(
                    "globalThis.__OPENCORVUS_STARTUP_THEME__ = {startup_theme_json};"
                ))
                .inner_size(placement.size.width, placement.size.height)
                .position(placement.position.x, placement.position.y)
                .data_directory(runtime_paths.webview_dir)
                .build()?;
            // bundle.icon applies to packaged apps; set the runtime icon as well
            // so development builds use the same native taskbar/Alt+Tab identity.
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                window.with_webview(|webview| {
                    macos_webview_keyboard::install_arrow_key_repair(webview.inner())
                        .expect("failed to install the macOS WebView arrow-key repair");
                })?;

                let _ = set_window_icon(&window);
                // macOS receives its full-size Overlay titlebar during window
                // construction. Windows and Linux remove the hidden
                // construction decoration before this window is ever shown.
                #[cfg(not(target_os = "macos"))]
                window.set_decorations(false)?;
                #[cfg(not(target_os = "macos"))]
                let _ = window.remove_menu();
                let startup_surface = match startup_theme.as_str() {
                    "dark" => OVERLAY_STARTUP_SURFACE_DARK,
                    "vscode-dark" => OVERLAY_STARTUP_SURFACE_VSCODE_DARK,
                    "light" => OVERLAY_STARTUP_SURFACE_LIGHT,
                    _ if window
                        .theme()
                        .is_ok_and(|theme| theme == tauri::Theme::Dark) =>
                    {
                        OVERLAY_STARTUP_SURFACE_DARK
                    }
                    _ => OVERLAY_STARTUP_SURFACE_LIGHT,
                };
                window.set_background_color(Some(startup_surface))?;

                // Keep the WebView2 controller at its configured construction
                // size. Resizing the native parent before its first document
                // paint leaves a temporarily uncovered backing surface.
                let min_size = constraints.min_size;
                let _ = window.set_min_size(Some(tauri::LogicalSize::new(
                    min_size.width,
                    min_size.height,
                )));
                #[cfg(windows)]
                install_overlay_window_geometry_constraints(&window, constraints)
                    .map_err(std::io::Error::other)?;
            }

            // Build tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Panel", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide Panel", true, None::<&str>)?;
            let restart_item = MenuItem::with_id(app, "restart", "Restart", true, None::<&str>)?;
            let separator = MenuItem::with_id(app, "sep", "────────", false, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &hide_item,
                    &restart_item,
                    &separator,
                    &quit_item,
                ],
            )?;

            let icon = create_tray_icon();

            let _tray = TrayIconBuilder::with_id(TRAY_ID)
                .icon(icon)
                .tooltip(TRAY_TOOLTIP_DEFAULT)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    let id = event.id().as_ref();
                    match id {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                show_window(&window);
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "restart" => {
                            let _ = restart_server(app);
                            if let Some(window) = app.get_webview_window("main") {
                                // Reload the frontend
                                let _ = window.eval("location.reload()");
                                show_window(&window);
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            show_window(&window);
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Focused(true)) {
                clear_native_notification_attention(|| window.request_user_attention(None));
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            tauri::RunEvent::Exit => stop_server(app),
            _ => {}
        })
}

// The tray icon is decoded once (PNG decode + Lanczos3 resize + flood-fill)
// and cached for the lifetime of the process.

struct CachedIcon {
    rgba: Vec<u8>,
    width: u32,
    height: u32,
}

fn cached_icon_image(cached: &'static CachedIcon) -> tauri::image::Image<'static> {
    tauri::image::Image::new(cached.rgba.as_slice(), cached.width, cached.height)
}

fn build_normal_tray_icon() -> CachedIcon {
    if let Some(icon) = tray_icon_from_bundle() {
        let width = icon.width();
        let height = icon.height();
        return CachedIcon {
            rgba: icon.rgba().to_vec(),
            width,
            height,
        };
    }

    let size: u32 = 32;
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let cx = size as f64 / 2.0;
    let cy = size as f64 / 2.0;
    let r = 12.0;

    for y in 0..size {
        for x in 0..size {
            let dx = x as f64 - cx;
            let dy = y as f64 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            let idx = ((y * size + x) * 4) as usize;

            if dist <= r {
                rgba[idx] = 0x5b;
                rgba[idx + 1] = 0x8d;
                rgba[idx + 2] = 0xef;
                let edge = r - dist;
                rgba[idx + 3] = if edge >= 1.0 {
                    255
                } else {
                    (edge * 255.0) as u8
                };
            }
        }
    }

    CachedIcon {
        rgba,
        width: size,
        height: size,
    }
}

fn create_tray_icon() -> tauri::image::Image<'static> {
    static CACHED: OnceLock<CachedIcon> = OnceLock::new();
    cached_icon_image(CACHED.get_or_init(build_normal_tray_icon))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_message_delivery_requests_attention_before_system_notification() {
        let effects = std::cell::RefCell::new(Vec::new());
        let accepted = deliver_native_message_notification(
            || {
                effects.borrow_mut().push(format!(
                    "attention:{:?}",
                    native_notification_attention_type()
                ));
                Ok(())
            },
            || {
                effects.borrow_mut().push("system-notification".to_string());
                Ok(())
            },
        )
        .expect("native delivery should succeed");

        assert!(accepted);
        assert_eq!(
            effects.into_inner(),
            ["attention:Informational", "system-notification"]
        );
    }

    #[test]
    fn managed_process_terminal_state_preserves_observed_physical_exit() {
        assert_eq!(
            managed_process_terminal_state("early_exit", true, false),
            "graceful_exit"
        );
        assert_eq!(
            managed_process_terminal_state("early_exit", true, true),
            "forced_exit"
        );
        assert_eq!(
            managed_process_terminal_state("early_exit", false, false),
            "early_exit"
        );
    }

    #[test]
    fn startup_progress_extraction_event_serializes_the_actual_total_bytes() {
        let progress = StartupProgress::extracting(4_096, "Extracting embedded sidecar");
        let payload = serde_json::to_value(&progress).expect("startup progress must serialize");

        assert_eq!(STARTUP_PROGRESS_EVENT, "overlay:startup-progress");
        assert!(
            !progress.phase.is_empty(),
            "extraction phase must be present"
        );
        assert_eq!(progress.completed_bytes, 0);
        assert_eq!(progress.total_bytes, 4_096);
        assert_eq!(payload["totalBytes"], 4_096);
    }

    #[test]
    fn startup_progress_ready_event_completes_all_bytes() {
        let progress = StartupProgress::ready(4_096, "Backend ready");

        assert_eq!(progress.completed_bytes, progress.total_bytes);
        assert_eq!(progress.total_bytes, 4_096);
        assert!(!progress.phase.is_empty(), "ready phase must be present");
    }

    #[test]
    fn startup_progress_runtime_phases_preserve_actual_bytes_and_log() {
        let starting = StartupProgress::starting(4_096, "Starting embedded backend");
        let log_path = PathBuf::from("C:/opencorvus/log/overlay-startup.log");
        let failed =
            StartupProgress::failed(2_048, 4_096, "Backend failed", Some(log_path.as_path()));

        assert_eq!(starting.phase, "starting");
        assert_eq!(starting.completed_bytes, 4_096);
        assert_eq!(starting.total_bytes, 4_096);
        assert_eq!(failed.phase, "failed");
        assert_eq!(failed.completed_bytes, 2_048);
        assert_eq!(failed.total_bytes, 4_096);
        assert_eq!(
            failed.log_path,
            Some(log_path.to_string_lossy().into_owned())
        );
    }

    #[test]
    fn extracted_byte_accumulator_reports_each_persisted_archive_entry() {
        let mut accumulator = ExtractedByteAccumulator::new(704);

        let completed = [128, 512, 64]
            .into_iter()
            .map(|entry_size| accumulator.record_persisted_file(entry_size))
            .collect::<Vec<_>>();

        assert_eq!(completed, vec![128, 640, 704]);
        assert_eq!(accumulator.completed_bytes(), 704);
        assert_eq!(accumulator.total_bytes(), 704);
    }

    #[test]
    fn startup_worker_executes_each_concurrent_request_in_order() {
        let worker = Arc::new(StartupWorker::default());
        let observations = Arc::new(Mutex::new(Vec::new()));
        let (first_entered_tx, first_entered_rx) = std::sync::mpsc::channel();
        let (release_first_tx, release_first_rx) = std::sync::mpsc::channel();

        let first_worker = Arc::clone(&worker);
        let first_observations = Arc::clone(&observations);
        let first = thread::spawn(move || {
            first_worker.execute(|| {
                first_observations.lock().unwrap().push("first-started");
                first_entered_tx.send(()).unwrap();
                release_first_rx.recv().unwrap();
                first_observations.lock().unwrap().push("first-finished");
            });
        });
        first_entered_rx.recv().unwrap();

        let second_worker = Arc::clone(&worker);
        let second_observations = Arc::clone(&observations);
        let second = thread::spawn(move || {
            second_worker.execute(|| {
                second_observations.lock().unwrap().push("second-finished");
            });
        });

        release_first_tx.send(()).unwrap();
        first.join().unwrap();
        second.join().unwrap();

        assert_eq!(
            observations.lock().unwrap().as_slice(),
            ["first-started", "first-finished", "second-finished"]
        );
    }

    #[test]
    fn cold_payload_preparation_releases_native_server_operation_scope() {
        let server = Arc::new(Server::default());
        let (preparation_entered_tx, preparation_entered_rx) = std::sync::mpsc::channel();
        let (release_preparation_tx, release_preparation_rx) = std::sync::mpsc::channel();

        let startup_server = Arc::clone(&server);
        let startup = thread::spawn(move || {
            let mut context = ();
            with_prepared_server(
                &startup_server,
                &mut context,
                |_| {
                    preparation_entered_tx.send(()).unwrap();
                    release_preparation_rx.recv().unwrap();
                    Ok::<_, String>("prepared-payload")
                },
                |_, prepared| Ok::<_, String>(prepared),
            )
        });
        preparation_entered_rx.recv().unwrap();

        let native_operation = {
            let _operation = server.operation.lock().unwrap();
            "native-operation-completed"
        };
        release_preparation_tx.send(()).unwrap();

        assert_eq!(native_operation, "native-operation-completed");
        assert_eq!(startup.join().unwrap().unwrap(), "prepared-payload");
    }

    #[test]
    fn server_health_probe_accepts_authenticated_healthy_response() {
        let listener = TcpListener::bind(("127.0.0.1", 0))
            .expect("test health server should bind to an ephemeral port");
        let address = listener
            .local_addr()
            .expect("test health server should expose its address");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener
                .accept()
                .expect("test health server should accept one probe");
            let mut request = [0_u8; 512];
            let read = stream
                .read(&mut request)
                .expect("test health server should read the probe");
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 16\r\nConnection: close\r\n\r\n{\"healthy\":true}")
                .expect("test health server should write a success response");
            String::from_utf8_lossy(&request[..read]).into_owned()
        });

        let health = probe_server_health(
            address,
            Duration::from_secs(1),
            Some("Basic b3BlbmNvcnZ1czpzZWNyZXQ="),
        )
        .expect("successful health response should be readable");
        let request = server.join().expect("test health server should finish");

        assert_eq!(health, ServerHealth::Healthy);
        assert!(request.starts_with("GET /global/health HTTP/1.1\r\n"));
        assert!(request.contains("\r\nAuthorization: Basic b3BlbmNvcnZ1czpzZWNyZXQ=\r\n"));
    }

    #[test]
    fn server_health_probe_reports_http_success_with_unhealthy_payload() {
        let listener = TcpListener::bind(("127.0.0.1", 0))
            .expect("test health server should bind to an ephemeral port");
        let address = listener
            .local_addr()
            .expect("test health server should expose its address");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener
                .accept()
                .expect("test health server should accept one probe");
            let mut request = [0_u8; 512];
            stream
                .read(&mut request)
                .expect("test health server should read the probe");
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 17\r\nConnection: close\r\n\r\n{\"healthy\":false}")
                .expect("test health server should write an unhealthy response");
        });

        let health = probe_server_health(address, Duration::from_secs(1), None)
            .expect("unhealthy health response should be readable");
        server.join().expect("test health server should finish");

        assert_eq!(health, ServerHealth::Unhealthy);
    }

    #[test]
    fn project_editors_use_native_opener_application_identifiers() {
        #[cfg(windows)]
        let expected = [
            (ProjectEditor::Vscode, "code.cmd"),
            (ProjectEditor::Pycharm, "pycharm64.exe"),
            (ProjectEditor::Webstorm, "webstorm64.exe"),
            (ProjectEditor::Intellij, "idea64.exe"),
            (ProjectEditor::Cursor, "cursor.cmd"),
        ];
        #[cfg(target_os = "macos")]
        let expected = [
            (ProjectEditor::Vscode, "Visual Studio Code"),
            (ProjectEditor::Pycharm, "PyCharm"),
            (ProjectEditor::Webstorm, "WebStorm"),
            (ProjectEditor::Intellij, "IntelliJ IDEA"),
            (ProjectEditor::Cursor, "Cursor"),
        ];
        #[cfg(all(unix, not(target_os = "macos")))]
        let expected = [
            (ProjectEditor::Vscode, "code"),
            (ProjectEditor::Pycharm, "pycharm"),
            (ProjectEditor::Webstorm, "webstorm"),
            (ProjectEditor::Intellij, "idea"),
            (ProjectEditor::Cursor, "cursor"),
        ];

        for (editor, application) in expected {
            assert_eq!(editor.opener_application(), application);
        }
    }

    #[test]
    fn browser_preview_page_info_decodes_the_canonical_callback_wire_format() {
        let raw = r#""{\"kind\":\"page\",\"url\":\"https://example.test/page\",\"title\":\"  Example Page  \",\"annotationRequested\":true,\"interactionReady\":true}""#;
        let page = decode_browser_preview_page_info(raw).expect("page info");
        assert_eq!(page.url, "https://example.test/page");
        assert_eq!(page.title, "Example Page");
        assert!(page.annotation_requested);
        assert!(page.interaction_ready);
    }

    #[test]
    fn overlay_settings_filename_is_jsonc() {
        assert_eq!(overlay_settings_filename(), "overlay.jsonc");
    }

    fn overlay_test_settings() -> OverlaySettings {
        OverlaySettings {
            server_url: "http://127.0.0.1:7878".to_string(),
            auto_server: false,
            password: "secret".to_string(),
            username: "opencorvus".to_string(),
            init_git: true,
            sidebar_collapsed: true,
            sidebar_width: Some(280),
            right_dock_width: Some(420),
            work_ledger_organization: "by-project".to_string(),
            work_ledger_sort: "updated".to_string(),
            zoom: 1.25,
            theme: "vscode-dark".to_string(),
            locale: "zh-CN".to_string(),
            directory: Some("C:/repo".to_string()),
            project_editor: "cursor".to_string(),
            preferred_project_editor: "pycharm".to_string(),
            workspace_task_id: Some("tsk_settings".to_string()),
            workspace_directory: Some("C:/repo/workspace".to_string()),
            desktop_notifications: false,
        }
    }

    #[test]
    fn overlay_settings_parser_accepts_complete_jsonc_settings() {
        let text = format_overlay_settings_text(&overlay_test_settings())
            .expect("test settings should serialize")
            .replacen('{', "{\n  // Desktop overlay settings.", 1);
        let parsed =
            parse_overlay_settings_text(&text).expect("overlay JSONC settings should parse");
        assert_eq!(parsed, overlay_test_settings());
    }

    #[test]
    fn overlay_settings_saved_text_round_trips_through_jsonc_parser() {
        let settings = overlay_test_settings();

        let text = format_overlay_settings_text(&settings).expect("settings should serialize");
        let parsed = parse_overlay_settings_text(&text).expect("serialized settings should parse");

        assert_eq!(parsed, settings);
        let object = serde_json::from_str::<serde_json::Value>(&text)
            .expect("serialized settings should be JSON")
            .as_object()
            .expect("serialized settings should be an object")
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        assert_eq!(
            object,
            vec![
                "autoServer",
                "desktopNotifications",
                "directory",
                "initGit",
                "locale",
                "password",
                "preferredProjectEditor",
                "projectEditor",
                "rightDockWidth",
                "serverUrl",
                "sidebarCollapsed",
                "sidebarWidth",
                "theme",
                "username",
                "workLedgerOrganization",
                "workLedgerSort",
                "workspaceDirectory",
                "workspaceTaskID",
                "zoom",
            ]
        );
    }

    #[test]
    fn overlay_settings_parser_rejects_retired_or_unknown_fields() {
        for (field, retired_value) in [
            ("executor", serde_json::json!("opencorvus")),
            ("sectionsWidth", serde_json::json!(320)),
        ] {
            let mut value =
                serde_json::to_value(overlay_test_settings()).expect("test settings value");
            value[field] = retired_value;
            let error = parse_overlay_settings_text(&value.to_string())
                .expect_err("retired settings fields must not be ignored");
            assert!(
                error.contains(&format!("unknown field `{field}`")),
                "{error}"
            );
        }
    }

    #[test]
    fn overlay_settings_parser_rejects_missing_invalid_and_null_fields() {
        let baseline = serde_json::to_value(overlay_test_settings()).expect("test settings value");
        for required in [
            "serverUrl",
            "autoServer",
            "password",
            "username",
            "projectEditor",
            "initGit",
            "sidebarCollapsed",
            "workLedgerOrganization",
            "workLedgerSort",
            "zoom",
            "theme",
            "locale",
            "preferredProjectEditor",
            "desktopNotifications",
        ] {
            let mut value = baseline.clone();
            value
                .as_object_mut()
                .expect("settings object")
                .remove(required);
            assert!(
                parse_overlay_settings_text(&value.to_string()).is_err(),
                "missing required field {required} must fail"
            );
        }
        for optional in [
            "sidebarWidth",
            "rightDockWidth",
            "directory",
            "workspaceTaskID",
            "workspaceDirectory",
        ] {
            let mut value = baseline.clone();
            value[optional] = serde_json::Value::Null;
            assert!(
                parse_overlay_settings_text(&value.to_string()).is_err(),
                "explicit null field {optional} must fail"
            );
        }
        for (field, invalid) in [
            ("projectEditor", serde_json::json!("unknown")),
            ("zoom", serde_json::json!(2.0)),
            ("sidebarWidth", serde_json::json!(0)),
            ("sidebarWidth", serde_json::json!(4_294_967_296_u64)),
            ("theme", serde_json::json!("garbage")),
            ("workLedgerOrganization", serde_json::json!("folders")),
            ("workLedgerSort", serde_json::json!("alphabetical")),
            ("workspaceTaskID", serde_json::json!("   ")),
        ] {
            let mut value = baseline.clone();
            value[field] = invalid;
            assert!(
                parse_overlay_settings_text(&value.to_string()).is_err(),
                "invalid field {field} must fail"
            );
        }
    }

    #[test]
    fn overlay_settings_atomic_write_failure_preserves_confirmed_file() {
        let directory = tempfile::tempdir().expect("settings test directory");
        let path = directory.path().join("overlay.jsonc");
        fs::write(&path, "confirmed settings").expect("confirmed file");

        let error =
            write_overlay_settings_text_with(&path, "replacement settings", |file, bytes| {
                file.write_all(&bytes[..4])?;
                Err(std::io::Error::other("injected write failure"))
            })
            .expect_err("injected write failure must be visible");

        assert!(error.contains("injected write failure"), "{error}");
        assert_eq!(
            fs::read_to_string(&path).expect("confirmed file should remain readable"),
            "confirmed settings"
        );
    }

    #[test]
    fn browser_preview_bounds_require_finite_positive_size() {
        assert!(validate_browser_preview_bounds(BrowserPreviewBounds {
            x: 0.0,
            y: 12.0,
            width: 640.0,
            height: 480.0,
        })
        .is_ok());
        assert!(validate_browser_preview_bounds(BrowserPreviewBounds {
            x: f64::INFINITY,
            y: 12.0,
            width: 640.0,
            height: 480.0,
        })
        .is_err());
        assert!(validate_browser_preview_bounds(BrowserPreviewBounds {
            x: 0.0,
            y: 12.0,
            width: 0.0,
            height: 480.0,
        })
        .is_err());
    }

    #[test]
    fn browser_preview_navigation_actions_are_exact() {
        assert_eq!(
            browser_preview_navigation_script("back").unwrap(),
            Some("history.back();")
        );
        assert_eq!(
            browser_preview_navigation_script("forward").unwrap(),
            Some("history.forward();")
        );
        assert_eq!(browser_preview_navigation_script("reload").unwrap(), None);
        assert!(browser_preview_navigation_script("stop").is_err());
    }

    #[test]
    fn browser_preview_url_navigation_accepts_only_http_and_https() {
        assert_eq!(
            parse_browser_preview_navigation_url("https://example.com/path")
                .unwrap()
                .as_str(),
            "https://example.com/path"
        );
        assert_eq!(
            parse_browser_preview_navigation_url("http://localhost:5173/")
                .unwrap()
                .as_str(),
            "http://localhost:5173/"
        );
        assert!(parse_browser_preview_navigation_url("file:///tmp/index.html").is_err());
        assert!(parse_browser_preview_navigation_url("about:blank").is_err());
    }

    #[test]
    fn browser_preview_surface_ids_produce_distinct_stable_webview_labels() {
        assert_eq!(
            browser_preview_webview_label("browser-tab-a").unwrap(),
            "browser-preview-live-webview-browser-tab-a"
        );
        assert_ne!(
            browser_preview_webview_label("browser-tab-a").unwrap(),
            browser_preview_webview_label("browser-tab-b").unwrap()
        );
        assert!(browser_preview_webview_label("   ").is_err());
        assert!(browser_preview_webview_label("browser/tab").is_err());
    }

    #[test]
    fn browser_preview_scope_owners_are_isolated_by_surface() {
        for (surface, scope) in [
            ("native-surface-contract-a", "scope-a"),
            ("native-surface-contract-b", "scope-b"),
        ] {
            replace_browser_preview_scope(surface, scope, true, |owner, changed| {
                assert!(changed);
                assert_eq!(owner.scope_key, scope);
                Ok::<(), String>(())
            })
            .expect("surface scope should activate");
        }

        let first = browser_preview_scope_state("native-surface-contract-a").unwrap();
        invalidate_browser_preview_scope_owner(&mut first.lock().unwrap(), "scope-a")
            .expect("first surface owner should invalidate independently");
        with_browser_preview_scope("native-surface-contract-b", "scope-b", |_| Ok(()))
            .expect("second surface owner must remain active");
    }

    #[test]
    fn browser_preview_callback_stores_are_isolated_by_surface() {
        let scope_a = BrowserPreviewScopeOwner {
            scope_key: "callback-scope-a".to_string(),
            generation: 1,
        };
        let scope_b = BrowserPreviewScopeOwner {
            scope_key: "callback-scope-b".to_string(),
            generation: 1,
        };
        let page_a = browser_preview_page_info_store("callback-surface-a").unwrap();
        let page_b = browser_preview_page_info_store("callback-surface-b").unwrap();
        assert!(!Arc::ptr_eq(&page_a, &page_b));
        page_a
            .lock()
            .unwrap()
            .begin(&scope_a)
            .expect("first surface page callback should begin");
        assert!(page_b.lock().unwrap().pending.is_none());

        let selection_a = browser_preview_selection_state("callback-surface-a").unwrap();
        let selection_b = browser_preview_selection_state("callback-surface-b").unwrap();
        assert!(!Arc::ptr_eq(&selection_a, &selection_b));
        selection_a
            .lock()
            .unwrap()
            .enable(scope_a)
            .expect("first surface selection should enable");
        selection_b
            .lock()
            .unwrap()
            .enable(scope_b)
            .expect("second surface selection should enable");
        selection_a.lock().unwrap().disable().unwrap();
        assert!(selection_b.lock().unwrap().active.is_some());
    }

    #[test]
    fn browser_preview_guest_comment_is_the_completed_selection_payload() {
        let raw = r#""{\"kind\":\"comment\",\"selection\":{\"x\":12,\"y\":24,\"width\":320,\"height\":96,\"label\":\"main#content\",\"sourceHint\":\"src/Content.tsx:12\"},\"comment\":\"  Align this region.  \"}""#;
        let result = decode_guest_selection_payload(raw)
            .expect("comment callback should decode")
            .expect("comment callback should complete");
        let value = serde_json::to_value(result).expect("comment result should serialize");
        assert_eq!(value["kind"], "comment");
        assert_eq!(value["comment"], "Align this region.");
        assert_eq!(value["selection"]["label"], "main#content");
        assert_eq!(value["selection"]["sourceHint"], "src/Content.tsx:12");
    }

    fn browser_preview_test_scope(scope_key: &str, generation: u64) -> BrowserPreviewScopeOwner {
        BrowserPreviewScopeOwner {
            scope_key: scope_key.to_string(),
            generation,
        }
    }

    #[test]
    fn browser_preview_delayed_old_scope_close_cannot_invalidate_replacement() {
        let original = browser_preview_test_scope("task-a:preview", 1);
        let state = Mutex::new(BrowserPreviewScopeState {
            active: Some(original),
            next_generation: 1,
        });
        with_browser_preview_scope_replacement(
            &state,
            "task-b:preview",
            false,
            |replacement, changed| {
                assert!(changed);
                assert_eq!(
                    replacement,
                    &browser_preview_test_scope("task-b:preview", 2)
                );
                assert!(
                    state.try_lock().is_err(),
                    "replacement mutation must hold the scope lock"
                );
                Ok::<(), String>(())
            },
        )
        .expect("replacement should activate atomically");

        let mut state = state.lock().expect("scope state should relock");
        let replacement = browser_preview_test_scope("task-b:preview", 2);
        assert!(invalidate_browser_preview_scope_owner(&mut state, "task-a:preview").is_err());
        assert_eq!(state.active, Some(replacement.clone()));
        assert_eq!(state.next_generation, replacement.generation);
        assert!(require_browser_preview_scope_owner(&state, "   ").is_err());

        invalidate_browser_preview_scope_owner(&mut state, "task-b:preview")
            .expect("current scope close should invalidate its exact owner");
        assert!(state.active.is_none());
        assert_eq!(state.next_generation, replacement.generation + 1);
    }

    #[test]
    fn browser_preview_same_lease_sync_failure_invalidates_owner_before_unlock() {
        let lease = browser_preview_test_scope("opaque-lease", 7);
        let state = Mutex::new(BrowserPreviewScopeState {
            active: Some(lease.clone()),
            next_generation: lease.generation,
        });

        let error = with_browser_preview_scope_replacement(
            &state,
            &lease.scope_key,
            false,
            |owner, changed| {
                assert!(!changed);
                assert_eq!(owner, &lease);
                assert!(
                    state.try_lock().is_err(),
                    "sync mutation and failure cleanup must retain the scope mutex"
                );
                Err::<(), String>("set_position failed".to_string())
            },
        )
        .expect_err("same-lease sync mutation failure must remain visible");

        assert_eq!(error, "set_position failed");
        let state = state
            .lock()
            .expect("scope mutex must not deadlock after failure");
        assert!(state.active.is_none());
        assert_eq!(state.next_generation, lease.generation + 1);
        for scope_key in [&lease.scope_key, "other-lease", ""] {
            assert!(require_browser_preview_scope_owner(&state, scope_key).is_err());
        }
    }

    #[test]
    fn browser_preview_sync_preflight_failures_hide_cleanup_and_invalidate_active_owner() {
        let preflight_errors = [
            "browser preview scope key is required",
            "browser preview webview bounds must contain finite x/y and positive width/height",
            "relative URL without a base",
            "main overlay window is unavailable",
        ];

        for (index, operation_error) in preflight_errors.into_iter().enumerate() {
            let lease = browser_preview_test_scope("opaque-lease", index as u64 + 11);
            let state = Mutex::new(BrowserPreviewScopeState {
                active: Some(lease.clone()),
                next_generation: lease.generation,
            });
            let hide_calls = std::cell::Cell::new(0);
            let page_cleanup_calls = std::cell::Cell::new(0);
            let selection_cleanup_calls = std::cell::Cell::new(0);

            let error = with_browser_preview_sync_preflight_cleanup(
                &state,
                operation_error.to_string(),
                || {
                    assert!(
                        state.try_lock().is_err(),
                        "preflight hide must retain the scope mutex"
                    );
                    hide_calls.set(hide_calls.get() + 1);
                    Ok(())
                },
                || {
                    assert!(state.try_lock().is_err());
                    page_cleanup_calls.set(page_cleanup_calls.get() + 1);
                    Ok(())
                },
                || {
                    assert!(state.try_lock().is_err());
                    selection_cleanup_calls.set(selection_cleanup_calls.get() + 1);
                    Ok(())
                },
            );

            assert_eq!(error.message, operation_error);
            assert!(error.surface_hidden);
            assert_eq!(hide_calls.get(), 1);
            assert_eq!(page_cleanup_calls.get(), 1);
            assert_eq!(selection_cleanup_calls.get(), 1);
            let state = state
                .lock()
                .expect("preflight cleanup must release its mutex");
            assert!(state.active.is_none());
            assert_eq!(state.next_generation, lease.generation + 1);
        }
    }

    #[test]
    fn browser_preview_sync_preflight_hide_failure_is_exact_and_still_invalidates_owner() {
        let lease = browser_preview_test_scope("opaque-lease", 31);
        let state = Mutex::new(BrowserPreviewScopeState {
            active: Some(lease.clone()),
            next_generation: lease.generation,
        });

        let error = with_browser_preview_sync_preflight_cleanup(
            &state,
            "invalid bounds".to_string(),
            || Err("native child refused hide".to_string()),
            || Err("page store poisoned".to_string()),
            || Ok(()),
        );

        assert!(!error.surface_hidden);
        assert!(error.message.contains("invalid bounds"));
        assert!(error
            .message
            .contains("hide failed: native child refused hide"));
        assert!(error
            .message
            .contains("page callback cleanup failed: page store poisoned"));
        let state = state
            .lock()
            .expect("preflight cleanup must release its mutex");
        assert!(state.active.is_none());
        assert_eq!(state.next_generation, lease.generation + 1);
    }

    #[test]
    fn browser_preview_callback_store_rejects_delayed_cross_scope_completion() {
        let scope_a = browser_preview_test_scope("task-a:preview", 1);
        let scope_b = browser_preview_test_scope("task-b:preview", 2);
        let mut store = BrowserPreviewCallbackStore::<String>::default();
        let owner_a = store
            .begin(&scope_a)
            .expect("scope A request should begin")
            .expect("scope A request owner");
        store.clear();
        let owner_b = store
            .begin(&scope_b)
            .expect("scope B request should begin")
            .expect("scope B request owner");

        store.complete(&owner_a, Ok("stale A".to_string()));
        assert!(store.take(&scope_b).is_none());
        store.complete(&owner_b, Ok("current B".to_string()));
        assert_eq!(
            store.take(&scope_b).expect("scope B completion").unwrap(),
            "current B"
        );
    }

    #[test]
    fn browser_preview_callback_store_rejects_delayed_same_scope_navigation_completion() {
        let scope = browser_preview_test_scope("task-a:preview", 1);
        let mut store = BrowserPreviewCallbackStore::<String>::default();
        let before_navigation = store
            .begin(&scope)
            .expect("pre-navigation request should begin")
            .expect("pre-navigation request owner");
        store.clear();
        let after_navigation = store
            .begin(&scope)
            .expect("post-navigation request should begin")
            .expect("post-navigation request owner");

        store.complete(&before_navigation, Ok("old page".to_string()));
        assert!(store.take(&scope).is_none());
        store.complete(&after_navigation, Ok("new page".to_string()));
        assert_eq!(
            store
                .take(&scope)
                .expect("post-navigation completion")
                .unwrap(),
            "new page"
        );
    }

    #[test]
    fn browser_preview_callback_store_rejects_completion_after_disable_and_reenable() {
        let scope = browser_preview_test_scope("task-a:preview", 1);
        let mut state = BrowserPreviewSelectionState::default();
        state
            .enable(scope.clone())
            .expect("selection should enable");
        let disabled_owner = state
            .callbacks
            .begin(&scope)
            .expect("first selection request should begin")
            .expect("first selection request owner");
        state.disable().expect("selection should disable");
        state
            .enable(scope.clone())
            .expect("selection should reenable");
        let reenabled_owner = state
            .callbacks
            .begin(&scope)
            .expect("reenabled selection request should begin")
            .expect("reenabled selection request owner");

        state
            .callbacks
            .complete(&disabled_owner, Ok(BrowserPreviewSelectionResult::Canceled));
        assert!(state.callbacks.take(&scope).is_none());
        state.callbacks.complete(
            &reenabled_owner,
            Ok(BrowserPreviewSelectionResult::Canceled),
        );
        assert_eq!(
            serde_json::to_value(
                state
                    .callbacks
                    .take(&scope)
                    .expect("reenabled completion")
                    .unwrap()
            )
            .expect("completion should serialize")["kind"],
            "canceled"
        );
    }

    #[test]
    fn browser_preview_callback_start_failure_is_exposed_and_releases_pending_owner() {
        let scope = browser_preview_test_scope("task-a:preview", 1);
        let store = Mutex::new(BrowserPreviewCallbackStore::<String>::default());
        let owner = store
            .lock()
            .expect("callback store should lock")
            .begin(&scope)
            .expect("callback request should begin")
            .expect("callback request owner");

        assert_eq!(
            browser_preview_callback_start_failed(
                &store,
                &owner,
                "eval startup failed".to_string()
            )
            .expect_err("startup failure must remain visible"),
            "eval startup failed"
        );
        assert!(store
            .lock()
            .expect("callback store should relock")
            .begin(&scope)
            .expect("a new callback should be allowed")
            .is_some());
    }

    #[test]
    fn browser_preview_zoom_accepts_canonical_boundary_factors() {
        assert_eq!(validate_browser_preview_zoom(0.25).unwrap(), 0.25);
        assert_eq!(validate_browser_preview_zoom(5.0).unwrap(), 5.0);
    }

    #[test]
    fn browser_preview_guest_callback_distinguishes_waiting_from_failure() {
        let waiting = r#""{\"kind\":\"waiting\"}""#;
        assert!(decode_guest_selection_payload(waiting)
            .expect("waiting payload should decode")
            .is_none());

        let failure = r#""{\"kind\":\"error\",\"message\":\"guest global is inaccessible\"}""#;
        assert_eq!(
            decode_guest_selection_payload(failure)
                .expect_err("guest runtime failure must not become waiting"),
            "browser preview guest selection failed: guest global is inaccessible"
        );
    }

    #[test]
    fn browser_preview_page_callback_decodes_guest_error() {
        let failure = r#""{\"kind\":\"error\",\"message\":\"document access failed\"}""#;
        assert_eq!(
            decode_browser_preview_page_info(failure).expect_err("guest page inspection error"),
            "browser preview guest page inspection failed: document access failed"
        );
    }

    #[test]
    fn overlay_runtime_paths_resolve_one_complete_root_layout() {
        let root = unique_sidecar_test_dir("runtime-root");
        let paths =
            OverlayRuntimePaths::from_root(root.clone()).expect("runtime root should resolve");

        assert_eq!(paths.root, root);
        assert_eq!(paths.config_dir, root.join("config"));
        assert_eq!(paths.data_dir, root.join("data"));
        assert_eq!(paths.log_dir, root.join("log"));
        assert_eq!(paths.embedded_dir, root.join("overlay").join("embedded"));
        assert_eq!(paths.webview_dir, root.join("overlay").join("webview"));
    }

    #[test]
    fn overlay_runtime_paths_return_typed_invalid_root_errors() {
        let error = OverlayRuntimePaths::from_root(PathBuf::new())
            .expect_err("empty OPENCORVUS_HOME must be rejected");
        let blank = OverlayRuntimePaths::from_root(PathBuf::from("   "))
            .expect_err("blank OPENCORVUS_HOME must be rejected");
        let relative = OverlayRuntimePaths::from_root(PathBuf::from("relative-home"))
            .expect_err("relative OPENCORVUS_HOME must be rejected");

        assert_eq!(error, "OPENCORVUS_HOME must not be blank");
        assert_eq!(blank, "OPENCORVUS_HOME must not be blank");
        assert!(relative.contains("OPENCORVUS_HOME must be an absolute path"));
    }

    #[test]
    fn ensure_sidecar_cwd_dir_rejects_file_path() {
        let root = unique_sidecar_test_dir("oc-sidecar-cwd-file");
        std::fs::create_dir_all(&root).expect("test root should be created");
        let file = root.join("data");
        std::fs::write(&file, b"not a directory").expect("test file should be written");

        let error =
            ensure_sidecar_cwd_dir(&file).expect_err("file path must not be accepted as cwd");

        assert!(
            error.contains("failed to create sidecar cwd"),
            "unexpected error: {error}"
        );
        assert!(
            error.contains(&file.to_string_lossy().to_string()),
            "error should include target path: {error}"
        );
        std::fs::remove_dir_all(&root).expect("test root should be removed");
    }

    #[test]
    fn sidecar_stdio_targets_reject_file_log_directory() {
        let root = unique_sidecar_test_dir("oc-sidecar-log-file");
        std::fs::create_dir_all(&root).expect("test root should be created");
        let file = root.join("log");
        std::fs::write(&file, b"not a directory").expect("test file should be written");

        let error = sidecar_stdio_targets(&file)
            .expect_err("a file path must not be accepted as the sidecar log directory");

        assert!(
            error.contains("cannot create sidecar log directory"),
            "unexpected error: {error}"
        );
        assert!(
            error.contains(&file.to_string_lossy().to_string()),
            "error should include target path: {error}"
        );
        std::fs::remove_dir_all(&root).expect("test root should be removed");
    }

    #[test]
    fn server_info_preserves_sidecar_log_path() {
        let path = PathBuf::from("C:/opencorvus/log/sidecar-test.log");
        let info = server_info_with_pid_and_log(7878, 123, Some(path.clone()));

        assert_eq!(info.port, 7878);
        assert_eq!(info.pid, Some(123));
        assert_eq!(
            info.sidecar_log_path,
            Some(path.to_string_lossy().to_string())
        );
    }

    #[test]
    fn managed_backend_terminal_failure_preserves_complete_startup_evidence() {
        let root = unique_sidecar_test_dir("oc-sidecar-terminal-evidence");
        std::fs::create_dir_all(&root).expect("test root should be created");
        let log_path = root.join("sidecar.log");
        let captured_output = "backend startup failed after database initialization\n";
        std::fs::write(&log_path, captured_output)
            .expect("captured startup output should be written");

        let failure = managed_backend_terminal_failure(
            "managed backend exited before becoming healthy: exit code: 1".to_string(),
            Some(log_path.clone()),
        );

        assert_eq!(failure.sidecar_log_path, Some(log_path));
        assert_eq!(
            failure.message,
            format!(
                "managed backend exited before becoming healthy: exit code: 1\nmanaged backend captured output:\n{}",
                captured_output.trim()
            )
        );
        std::fs::remove_dir_all(&root).expect("test root should be removed");
    }

    #[test]
    fn managed_backend_process_observation_returns_terminal_exit_evidence() {
        let root = unique_sidecar_test_dir("oc-sidecar-terminal-observation");
        std::fs::create_dir_all(&root).expect("test root should be created");
        let log_path = root.join("sidecar.log");
        std::fs::write(&log_path, "backend startup failure detail\n")
            .expect("captured startup output should be written");
        let mut child =
            Command::new(std::env::current_exe().expect("test executable should resolve"))
                .arg("--help")
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("terminal observation child should start");
        let status = child
            .wait()
            .expect("terminal observation child should exit");
        assert!(status.success());

        let server = Server::default();
        {
            let mut state = server.state.lock().expect("server state should lock");
            state.child = Some(child);
            state.port = Some(7879);
            state.sidecar_log_path = Some(log_path.clone());
        }

        let failure = match observe_server_process(&server) {
            ManagedBackendProcessObservation::Terminal(failure) => failure,
            ManagedBackendProcessObservation::Running(info) => {
                panic!("expected terminal observation, received running process {info:?}")
            }
            ManagedBackendProcessObservation::Inactive => {
                panic!("expected terminal observation, received inactive process")
            }
        };

        assert_eq!(failure.sidecar_log_path, Some(log_path));
        assert!(failure
            .message
            .starts_with("managed backend exited before becoming healthy:"));
        assert!(failure.message.ends_with("backend startup failure detail"));
        std::fs::remove_dir_all(&root).expect("test root should be removed");
    }

    fn unique_sidecar_test_dir(name: &str) -> PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let runtime_root = std::env::var_os("OPENCORVUS_HOME")
            .map(PathBuf::from)
            .map(OverlayRuntimePaths::from_root)
            .unwrap_or_else(|| {
                default_overlay_runtime_root().and_then(OverlayRuntimePaths::from_root)
            })
            .expect("canonical OpenCorvus test root should resolve")
            .root;
        runtime_root
            .join("tmp")
            .join("tests")
            .join("rust")
            .join(std::process::id().to_string())
            .join(format!("{name}-{stamp}"))
    }

    #[test]
    fn embedded_payload_temp_directory_is_an_unpublished_sibling() {
        let parent = unique_sidecar_test_dir("oc-embedded-parent");
        let unpublished = embedded_payload_temp_dir(&parent)
            .expect("unpublished payload directory should resolve");

        assert_eq!(unpublished.parent(), Some(parent.as_path()));
        assert!(unpublished
            .file_name()
            .expect("unpublished directory should have a name")
            .to_string_lossy()
            .starts_with(&format!(".sidecar-{EMBEDDED_SERVER_STAMP}-extract-")));
        assert_ne!(unpublished, parent.join(embedded_server_payload_dir_name()));
    }

    #[test]
    fn embedded_payload_completion_requires_manifest_files() {
        let root = unique_sidecar_test_dir("oc-embedded-completion");
        fs::create_dir_all(&root).expect("test payload directory should be created");
        fs::write(
            root.join(EMBEDDED_PAYLOAD_COMPLETE_FILE),
            format!("{EMBEDDED_SERVER_STAMP}\n"),
        )
        .expect("completion marker should be written");

        let complete = embedded_payload_complete(&root)
            .expect("completion inspection should not fail for readable files");

        assert!(
            !complete,
            "a marker without payload files must be incomplete"
        );
        fs::remove_dir_all(&root).expect("test payload directory should be removed");
    }

    #[test]
    fn embedded_payload_collection_removes_only_unowned_protocol_and_unpublished_payloads() {
        let parent = unique_sidecar_test_dir("oc-embedded-collection");
        fs::create_dir_all(&parent).expect("test payload parent should be created");
        let current_name = "sidecar-current";
        let active_name = "sidecar-active";
        let removable_name = "sidecar-removable";
        let unproven_name = "sidecar-unproven";
        let unpublished_name = ".sidecar-interrupted-extract-100";
        let unrelated_name = "unrelated-directory";
        for name in [
            current_name,
            active_name,
            removable_name,
            unproven_name,
            unpublished_name,
            unrelated_name,
        ] {
            fs::create_dir(parent.join(name)).expect("test directory should be created");
        }

        let _lifecycle_lock = acquire_embedded_payload_lifecycle_lock(&parent)
            .expect("test lifecycle lock should be acquired");
        let _current_lease = acquire_embedded_payload_lease(&parent, current_name)
            .expect("current payload lease should be acquired");
        let active_lease = acquire_embedded_payload_lease(&parent, active_name)
            .expect("active payload lease should be acquired");
        drop(
            acquire_embedded_payload_lease(&parent, removable_name)
                .expect("removable payload should participate in the lease protocol"),
        );

        let removed = collect_stale_embedded_payloads(&parent, current_name)
            .expect("ownership-proven collection should succeed");

        assert_eq!(
            removed,
            vec![parent.join(unpublished_name), parent.join(removable_name)]
        );
        assert!(parent.join(current_name).is_dir());
        assert!(parent.join(active_name).is_dir());
        assert!(parent.join(unproven_name).is_dir());
        assert!(parent.join(unrelated_name).is_dir());
        assert!(!parent.join(unpublished_name).exists());
        assert!(!parent.join(removable_name).exists());
        assert!(!embedded_payload_lease_path(&parent, removable_name).exists());
        assert!(embedded_payload_lease_path(&parent, active_name).is_file());
        assert!(!embedded_payload_lease_path(&parent, unproven_name).exists());

        drop(active_lease);
        let removed = collect_stale_embedded_payloads(&parent, current_name)
            .expect("released protocol payload should be collectible");
        assert_eq!(removed, vec![parent.join(active_name)]);
        assert!(!parent.join(active_name).exists());
        assert!(parent.join(unproven_name).is_dir());
        assert!(parent.join(current_name).is_dir());

        fs::remove_dir_all(&parent).expect("test payload parent should be removed");
    }

    #[cfg(unix)]
    #[test]
    fn embedded_payload_completion_rejects_missing_executable_mode() {
        assert!(embedded_payload_file_mode_complete(true, 0o755));
        assert!(!embedded_payload_file_mode_complete(true, 0o644));
        assert!(embedded_payload_file_mode_complete(false, 0o644));
    }

    #[test]
    fn embedded_payload_contains_server_file() {
        assert!(!EMBEDDED_SERVER_FILES.is_empty());
        assert!(
            EMBEDDED_SERVER_FILES
                .iter()
                .any(|file| file.path == EMBEDDED_SERVER_NAME),
            "embedded sidecar payload must include {}",
            EMBEDDED_SERVER_NAME
        );
    }

    #[test]
    fn embedded_payload_contains_browser_mcp_runtime() {
        assert!(!EMBEDDED_SERVER_FILES.is_empty());
        let node = if cfg!(windows) {
            "browser-mcp-node/node.exe"
        } else {
            "browser-mcp-node/node"
        };
        assert!(
            EMBEDDED_SERVER_FILES
                .iter()
                .any(|file| file.path == "browser-mcp-node/browser.mjs"),
            "embedded sidecar payload must include browser-mcp-node/browser.mjs"
        );
        assert!(
            EMBEDDED_SERVER_FILES
                .iter()
                .any(|file| file.path == "browser-mcp-node/package.json"),
            "embedded sidecar payload must include browser-mcp-node/package.json"
        );
        let node_entry = EMBEDDED_SERVER_FILES
            .iter()
            .find(|file| file.path == node)
            .unwrap_or_else(|| panic!("embedded sidecar payload must include {node}"));
        assert!(
            node_entry.size > 0,
            "{node} must not be embedded as an empty file"
        );
        #[cfg(unix)]
        assert!(
            node_entry.executable,
            "{node} must be executable after extraction"
        );
    }

    #[test]
    fn embedded_payload_marks_ripgrep_runtime_executable() {
        let ripgrep = if cfg!(windows) {
            "bin/rg.exe"
        } else {
            "bin/rg"
        };
        let entry = EMBEDDED_SERVER_FILES
            .iter()
            .find(|file| file.path == ripgrep)
            .unwrap_or_else(|| panic!("embedded sidecar payload must include {ripgrep}"));
        assert!(
            entry.size > 0,
            "{ripgrep} must not be embedded as an empty file"
        );
        #[cfg(unix)]
        assert!(
            entry.executable,
            "{ripgrep} must be executable after extraction"
        );
    }

    #[test]
    fn embedded_payload_archive_is_present_and_compressed_when_payload_is_large() {
        assert!(!EMBEDDED_SERVER_FILES.is_empty());
        let total_size: u64 = EMBEDDED_SERVER_FILES.iter().map(|file| file.size).sum();
        assert!(
            !EMBEDDED_SERVER_ARCHIVE_GZ.is_empty(),
            "embedded sidecar payload must be stored in a compressed archive"
        );
        if total_size > 1024 * 1024 {
            assert!(
                (EMBEDDED_SERVER_ARCHIVE_GZ.len() as u64) < total_size,
                "embedded archive should be smaller than raw payload bytes"
            );
        }
    }

    #[test]
    fn embedded_payload_contains_browser_mcp_node_modules() {
        assert!(!EMBEDDED_SERVER_FILES.is_empty());
        for package_json in [
            "node_modules/playwright/package.json",
            "node_modules/playwright-core/package.json",
            "browser-mcp-node/node_modules/playwright/package.json",
            "browser-mcp-node/node_modules/playwright-core/package.json",
        ] {
            assert!(
                EMBEDDED_SERVER_FILES
                    .iter()
                    .any(|file| file.path == package_json),
                "embedded sidecar payload must include {package_json}"
            );
        }
    }

    #[test]
    fn embedded_payload_contains_manifest_listed_plugin_resources_when_present() {
        for path in EMBEDDED_PLUGIN_RESOURCE_FILES {
            assert!(
                EMBEDDED_SERVER_FILES.iter().any(|file| file.path == *path),
                "embedded sidecar payload must include manifest-listed plugin resource {path}"
            );
        }
    }

    #[test]
    fn embedded_payload_marks_manifest_worker_resource_executable_when_present() {
        let Some(worker) = EMBEDDED_PLUGIN_RESOURCE_FILES
            .iter()
            .find(|path| path.contains("worker"))
        else {
            return;
        };
        let entry = EMBEDDED_SERVER_FILES
            .iter()
            .find(|file| file.path == *worker)
            .unwrap_or_else(|| {
                panic!("embedded sidecar payload must include plugin worker resource {worker}")
            });
        assert!(
            entry.executable,
            "embedded plugin worker resource {worker} must be executable after extraction"
        );
    }

    #[test]
    fn embedded_payload_contains_parcel_watcher_runtime() {
        assert!(!EMBEDDED_SERVER_FILES.is_empty());
        let native_package = if cfg!(windows) {
            "node_modules/@parcel/watcher-win32-x64/package.json"
        } else if cfg!(target_os = "macos") && cfg!(target_arch = "x86_64") {
            "node_modules/@parcel/watcher-darwin-x64/package.json"
        } else if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
            "node_modules/@parcel/watcher-darwin-arm64/package.json"
        } else if cfg!(target_os = "linux") && cfg!(target_arch = "x86_64") {
            "node_modules/@parcel/watcher-linux-x64-glibc/package.json"
        } else if cfg!(target_os = "linux") && cfg!(target_arch = "aarch64") {
            "node_modules/@parcel/watcher-linux-arm64-glibc/package.json"
        } else {
            return;
        };

        for path in ["node_modules/@parcel/watcher/wrapper.js", native_package] {
            assert!(
                EMBEDDED_SERVER_FILES.iter().any(|file| file.path == path),
                "embedded sidecar payload must include {path}"
            );
        }
    }

    #[test]
    fn startup_failure_diagnostic_exposes_log_write_failure() {
        let message = startup_failure_diagnostic_message(
            "path resolution failed",
            None,
            Some("app_log_dir unavailable"),
        );

        assert!(message.contains("path resolution failed"));
        assert!(message.contains("overlay diagnostic log unavailable"));
        assert!(message.contains("app_log_dir unavailable"));
    }
}
