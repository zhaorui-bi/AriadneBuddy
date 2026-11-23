# Keyboard reference

This page lists the keys AriadneBuddy binds. Every entry was read from the source that
implements it: `main.js` for the desktop shell,
`engine/apps/ariadne-buddy/theme/research-desk.js` for the Research Desk, and
`engine/apps/ariadne-buddy/src/cli.ts` for the command line. Nothing here is planned or
aspirational.

## Desktop application

The desktop application menu is labelled in Chinese. The two accelerators declared in
`main.js` are:

| Keys | Menu item | Effect |
| --- | --- | --- |
| `Cmd`/`Ctrl` + `O` | 文件 → 打开工作目录… | choose a workspace directory |
| `Cmd`/`Ctrl` + `Shift` + `R` | 文件 → 重启引擎 | restart the engine for the current workspace |

The remaining menu entries use Electron roles, so they carry the platform's standard
accelerators rather than an AriadneBuddy-specific binding:

| Menu | Items |
| --- | --- |
| 文件 | 打开日志目录 · 在文件管理器中显示工作目录 · 刷新界面 (`reload`) · 开发者工具 (`toggleDevTools`, only in an unpackaged build or with `ARIADNE_DEBUG=1`) · 退出 (`quit`) |
| 编辑 | 撤销 · 重做 · 剪切 · 复制 · 粘贴 · 粘贴并匹配样式 · 全选 |
| 视图 | 实际大小 · 放大 · 缩小 (`resetZoom`, `zoomIn`, `zoomOut`) · 全屏 (`togglefullscreen`) |
| 视图 → 外观 | 跟随系统 · 浅色 · 深色 — no accelerators |
| 帮助 | 关于 AriadneBuddy · 打开日志目录 · 报告问题… — no accelerators |

There are no global shortcuts: nothing is registered outside the application window, and
the desk page is a web surface with no renderer-level key interception.

## Research Desk

The Desk is the research-task surface opened from the session list. Its bindings are
registered on the desk document.

### Tab navigation

The three activity tabs — Compute, Artifacts, Trajectory — form a tablist. With focus
inside the tablist:

| Key | Effect |
| --- | --- |
| `ArrowRight` | select the next tab, wrapping at the end |
| `ArrowLeft` | select the previous tab, wrapping at the start |
| `Home` | select the first tab |
| `End` | select the last tab |

`Tab` and `Shift` + `Tab` move focus normally between the tab buttons; the arrow keys
above are handled in addition, and each selection also moves focus to the newly selected
tab.

### Shortcuts

| Key | Effect |
| --- | --- |
| `/` | focus the sequence search field in the report controls; if the page has no search field, focus Refresh |
| `r` | reload the current research task and focus Refresh |
| `Escape` | dismiss the open job-cancellation confirmation group |

The `/` and `r` bindings are ignored while a modifier key is held, while focus is inside
an input, textarea, or select, and while any dialog is open. `r` only acts when a research
task is loaded. Native `<dialog>` elements close on `Escape` on their own; the desk
prevents that close only while an AFPK task is starting.

The desk also reloads itself when the page becomes visible again, so a decision recorded
in Chat is picked up without a manual refresh.

### Reading order

Every desk page exposes a polite live region, the task record is a labelled region, and
the activity disclosure reports its expanded state with `aria-expanded`. Keyboard focus
order follows the document order: the task header, the activity disclosure, then the task
record.

## Command line

`./bin/ariadnebuddy chat` opens the lightweight REPL. It exits when you type `quit` or
`exit` at the prompt, on `Ctrl` + `C`, or on end of input. `Ctrl` + `C` closes the active
harness first and exits with status 130.

The full terminal TUI is launched by running `./bin/ariadnebuddy` with no arguments. That
path does not install the `Ctrl` + `C` wrapper, because the TUI child handles signals
itself.

### TUI not built

If the TUI bundle has not been built, the launcher prints:

```text
TUI bundle not built yet — run `npm run build:tui` in the AriadneBuddy repo once. Falling back to plain REPL chat.
```

and then opens the plain REPL instead. Build it once with `npm run build:tui`.

## Related

- [Quick start](./QUICKSTART.md) · [Glossary](./GLOSSARY.md) · [Design](./DESIGN.md)
- 简体中文入口：[快速上手](./zh-CN/QUICKSTART.md)
