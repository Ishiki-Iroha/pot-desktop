use crate::config::{get, set};
use crate::window::{ai_action, text_translate};
use crate::APP;
use log::{info, warn};
use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{ClipboardManager, Manager, Window, WindowBuilder};

pub struct SelectionToolbarTextWrapper(pub Mutex<String>);

const TOOLBAR_WIDTH: f64 = 220.0;
const TOOLBAR_HEIGHT: f64 = 40.0;

struct TriggerState {
    last_text: String,
    last_at: Instant,
    suppress_until: Instant,
}

static TRIGGER_STATE: Lazy<Mutex<TriggerState>> = Lazy::new(|| {
    let now = Instant::now();
    Mutex::new(TriggerState {
        last_text: String::new(),
        last_at: now - Duration::from_secs(10),
        suppress_until: now,
    })
});

fn selection_toolbar_enabled() -> bool {
    match get("selection_toolbar_enable") {
        Some(v) => v.as_bool().unwrap_or(true),
        None => {
            set("selection_toolbar_enable", true);
            true
        }
    }
}

fn suppress_selection_check(duration: Duration) {
    let mut state = TRIGGER_STATE.lock().unwrap();
    state.suppress_until = Instant::now() + duration;
}

fn get_toolbar_window() -> Window {
    let app_handle = APP.get().unwrap();
    if let Some(window) = app_handle.get_window("selection_toolbar") {
        return window;
    }

    let window = WindowBuilder::new(
        app_handle,
        "selection_toolbar",
        tauri::WindowUrl::App("index.html".into()),
    )
    .title("Selection Toolbar")
    .visible(false)
    .focused(false)
    .resizable(false)
    .transparent(true)
    .decorations(false)
    .additional_browser_args("--disable-web-security")
    .build()
    .unwrap();

    let _ = window.set_skip_taskbar(true);
    let _ = window.set_always_on_top(true);
    window
}

fn show_toolbar_near_mouse(text: String) {
    use mouse_position::mouse_position::{Mouse, Position};

    let mouse_position = match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => Position { x, y },
        Mouse::Error => {
            warn!("Mouse position not found, skip selection toolbar");
            return;
        }
    };

    let app_handle = APP.get().unwrap();
    let text_state: tauri::State<SelectionToolbarTextWrapper> = app_handle.state();
    text_state.0.lock().unwrap().replace_range(.., &text);

    let window = get_toolbar_window();
    let monitor = match window.available_monitors() {
        Ok(monitors) => monitors
            .into_iter()
            .find(|monitor| {
                let size = monitor.size();
                let position = monitor.position();
                mouse_position.x >= position.x
                    && mouse_position.x <= position.x + size.width as i32
                    && mouse_position.y >= position.y
                    && mouse_position.y <= position.y + size.height as i32
            })
            .or_else(|| window.primary_monitor().unwrap_or(None)),
        Err(_) => window.primary_monitor().unwrap_or(None),
    };
    let Some(monitor) = monitor else {
        warn!("Monitor not found, skip selection toolbar");
        return;
    };
    let dpi = monitor.scale_factor();
    let monitor_size = monitor.size();
    let monitor_position = monitor.position();
    let width = TOOLBAR_WIDTH * dpi;
    let height = TOOLBAR_HEIGHT * dpi;

    let mut x = mouse_position.x as f64 - width / 2.0;
    let mut y = mouse_position.y as f64 + 18.0 * dpi;
    let min_x = monitor_position.x as f64;
    let min_y = monitor_position.y as f64;
    let max_x = min_x + monitor_size.width as f64 - width;
    let max_y = min_y + monitor_size.height as f64 - height;

    if x < min_x {
        x = min_x;
    }
    if x > max_x {
        x = max_x;
    }
    if y > max_y {
        y = mouse_position.y as f64 - height - 18.0 * dpi;
    }
    if y < min_y {
        y = min_y;
    }

    let _ = window.set_size(tauri::PhysicalSize::new(width, height));
    let _ = window.set_position(tauri::PhysicalPosition::new(
        x.round() as i32,
        y.round() as i32,
    ));
    let _ = window.show();
    let _ = window.emit("selection_toolbar_text_changed", text);
}

fn hide_toolbar_window() {
    let app_handle = APP.get().unwrap();
    if let Some(window) = app_handle.get_window("selection_toolbar") {
        match window.hide() {
            Ok(_) => info!("Selection toolbar hidden"),
            Err(e) => warn!("Failed to hide selection toolbar: {:?}", e),
        }
    }
}

fn mouse_is_over_toolbar_window() -> bool {
    use mouse_position::mouse_position::{Mouse, Position};

    let app_handle = APP.get().unwrap();
    let Some(window) = app_handle.get_window("selection_toolbar") else {
        return false;
    };
    if !window.is_visible().unwrap_or(false) {
        return false;
    }
    let mouse_position = match Mouse::get_mouse_position() {
        Mouse::Position { x, y } => Position { x, y },
        Mouse::Error => return false,
    };
    let position = match window.outer_position() {
        Ok(position) => position,
        Err(_) => return false,
    };
    let size = match window.outer_size() {
        Ok(size) => size,
        Err(_) => return false,
    };

    mouse_position.x >= position.x
        && mouse_position.x <= position.x + size.width as i32
        && mouse_position.y >= position.y
        && mouse_position.y <= position.y + size.height as i32
}

#[cfg(target_os = "windows")]
struct ComInitialization;

#[cfg(target_os = "windows")]
impl Drop for ComInitialization {
    fn drop(&mut self) {
        unsafe {
            windows::Win32::System::Com::CoUninitialize();
        }
    }
}

#[cfg(target_os = "windows")]
fn get_selected_text_by_automation() -> windows::core::Result<String> {
    use windows::Win32::System::Com::{CoCreateInstance, CoInitialize, CLSCTX_ALL};
    use windows::Win32::UI::Accessibility::{
        CUIAutomation, IUIAutomation, IUIAutomationTextPattern, UIA_TextPatternId,
    };

    unsafe { CoInitialize(None) }.ok()?;
    let _com = ComInitialization;

    let automation: IUIAutomation = unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL) }?;
    let element = unsafe { automation.GetFocusedElement() }?;
    let text_pattern: IUIAutomationTextPattern =
        unsafe { element.GetCurrentPatternAs(UIA_TextPatternId) }?;
    let text_ranges = unsafe { text_pattern.GetSelection() }?;
    let length = unsafe { text_ranges.Length() }?;
    let mut text = String::new();

    for index in 0..length {
        let range = unsafe { text_ranges.GetElement(index) }?;
        let range_text = unsafe { range.GetText(-1) }?;
        text.push_str(&range_text.to_string());
    }

    Ok(text)
}

#[cfg(target_os = "windows")]
fn get_selected_text_without_clipboard() -> String {
    match get_selected_text_by_automation() {
        Ok(text) => text.trim().to_string(),
        Err(_) => String::new(),
    }
}

#[cfg(not(target_os = "windows"))]
fn get_selected_text_without_clipboard() -> String {
    selection::get_text().trim().to_string()
}

fn check_selection_after_delay() {
    std::thread::spawn(|| {
        std::thread::sleep(Duration::from_millis(120));

        if !selection_toolbar_enabled() {
            hide_toolbar_window();
            return;
        }

        if mouse_is_over_toolbar_window() {
            return;
        }

        {
            let state = TRIGGER_STATE.lock().unwrap();
            if Instant::now() < state.suppress_until {
                return;
            }
        }

        let text = get_selected_text_without_clipboard();
        if text.is_empty() {
            hide_toolbar_window();
            return;
        }

        {
            let mut state = TRIGGER_STATE.lock().unwrap();
            let now = Instant::now();
            if state.last_text == text
                && now.duration_since(state.last_at) < Duration::from_millis(800)
            {
                return;
            }
            state.last_text = text.clone();
            state.last_at = now;
        }

        info!("Show selection toolbar for selected text");
        show_toolbar_near_mouse(text);
    });
}

#[cfg(target_os = "windows")]
pub fn start_selection_toolbar_monitor() {
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, GetMessageW, SetWindowsHookExW, MSG, WH_MOUSE_LL, WM_LBUTTONUP,
    };

    unsafe extern "system" fn mouse_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= 0 && wparam.0 as u32 == WM_LBUTTONUP {
            check_selection_after_delay();
        }
        unsafe { CallNextHookEx(None, code, wparam, lparam) }
    }

    std::thread::spawn(|| unsafe {
        let _hook = match SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook), None, 0) {
            Ok(hook) => hook,
            Err(e) => {
                warn!("Failed to install selection toolbar mouse hook: {:?}", e);
                return;
            }
        };

        let mut message = MSG::default();
        while GetMessageW(&mut message, None, 0, 0).as_bool() {}
    });
}

#[cfg(not(target_os = "windows"))]
pub fn start_selection_toolbar_monitor() {
    info!("Selection toolbar monitor is only enabled on Windows");
}

#[tauri::command]
pub fn get_selection_toolbar_text(state: tauri::State<SelectionToolbarTextWrapper>) -> String {
    state.0.lock().unwrap().to_string()
}

#[tauri::command]
pub fn hide_selection_toolbar() {
    suppress_selection_check(Duration::from_millis(500));
    hide_toolbar_window();
}

#[tauri::command]
pub fn selection_toolbar_action(action: String) -> Result<(), String> {
    suppress_selection_check(Duration::from_millis(15_000));
    hide_toolbar_window();

    let app_handle = APP.get().unwrap();
    let text_state: tauri::State<SelectionToolbarTextWrapper> = app_handle.state();
    let text = text_state.0.lock().unwrap().trim().to_string();
    if text.is_empty() {
        warn!("Selection toolbar action ignored: no selected text");
        return Err("No selected text".to_string());
    }

    info!(
        "Selection toolbar action requested: {}, text chars: {}",
        action,
        text.chars().count()
    );

    match action.as_str() {
        "copy" => app_handle
            .clipboard_manager()
            .write_text(text)
            .map_err(|e| e.to_string()),
        "translate" => {
            let engine = match get("selection_toolbar_translate_engine") {
                Some(v) => v.as_str().unwrap_or("default").to_string(),
                None => "default".to_string(),
            };
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(80));
                info!("Run queued selection toolbar translate action");
                if engine == "ai" {
                    ai_action("translate".to_string(), text);
                } else {
                    text_translate(text);
                }
            });
            Ok(())
        }
        "explain" => {
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(80));
                info!("Run queued selection toolbar explain action");
                ai_action("explain".to_string(), text);
            });
            Ok(())
        }
        _ => Err(format!("Unsupported selection toolbar action: {}", action)),
    }
}
