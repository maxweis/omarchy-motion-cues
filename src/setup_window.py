#!/usr/bin/python3
"""Read-only, on-demand GTK setup guide. No sensor or settings writes."""

import argparse
from pathlib import Path
import sys

TAB_TITLES = ("Overview", "phyphox setup", "GyrOSC setup")
GUIDE = Path(__file__).resolve().parent.parent / "docs/SETUP.txt"


def load_pages(destination, guide=GUIDE):
    """Keep all authored text in one plain-text guide, grouped by tab/heading."""
    pages = []
    section = None
    for line in guide.read_text(encoding="utf-8").splitlines():
        if line.startswith("[") and line.endswith("]"):
            pages.append({"title": line[1:-1], "sections": []})
            section = None
        elif line.startswith("## "):
            if not pages:
                raise ValueError("Setup heading appears before a tab")
            section = {"title": line[3:], "body": ""}
            pages[-1]["sections"].append(section)
        elif section is not None:
            section["body"] += line + "\n"
        elif line.strip():
            raise ValueError("Setup text appears before a heading")
    if tuple(page["title"] for page in pages) != TAB_TITLES:
        raise ValueError("Setup guide must contain Overview, phyphox setup and GyrOSC setup")
    for page in pages:
        if not page["sections"]:
            raise ValueError("Setup tab has no sections")
        for section in page["sections"]:
            section["body"] = section["body"].strip()
    pages[2]["sections"].insert(0, {
        "title": "Enter in GyrOSC",
        "body": destination.strip() or "No network address found. Connect to Wi-Fi or your phone hotspot.",
    })
    return pages


def load_gtk():
    try:
        import gi
        gi.require_version("Gtk", "4.0")
        from gi.repository import Gio, Gtk, Pango
    except (ImportError, ValueError) as error:
        raise RuntimeError(
            "The Setup window needs GTK 4 and Python GObject. "
            "On Omarchy, install them with: omarchy pkg add python-gobject gtk4"
        ) from error
    return Gio, Gtk, Pango


def build_window(application, pages):
    """Build a standalone guide; each tab keeps its own scroll position."""
    _, Gtk, Pango = load_gtk()
    window = Gtk.ApplicationWindow(application=application, title="Motion Cues Setup")
    window.set_default_size(860, 800)
    window.set_titlebar(Gtk.HeaderBar())
    layout = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
    window.set_child(layout)
    notebook = Gtk.Notebook(hexpand=True, vexpand=True)
    layout.append(notebook)

    for page in pages:
        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=22,
                          margin_top=24, margin_bottom=24, margin_start=24, margin_end=24)
        for section in page["sections"]:
            group = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
            heading = Gtk.Label(label=section["title"], xalign=0, wrap=True)
            heading.add_css_class("heading")
            group.append(heading)
            body = Gtk.Label(label=section["body"], xalign=0, selectable=True,
                             wrap=True, hexpand=True)
            body.set_wrap_mode(Pango.WrapMode.WORD_CHAR)
            body.set_width_chars(1)
            group.append(body)
            content.append(group)
        scroll = Gtk.ScrolledWindow(hexpand=True, vexpand=True)
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scroll.set_child(content)
        index = notebook.append_page(scroll, Gtk.Label(label=page["title"]))
        notebook.get_page(notebook.get_nth_page(index)).set_property("tab-expand", True)

    footer = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12,
                     margin_start=18, margin_end=18, margin_bottom=12)
    note = Gtk.Label(label="Change settings in the Motion Cues menu.",
                     xalign=0, wrap=True, hexpand=True)
    note.add_css_class("dim-label")
    footer.append(note)
    close = Gtk.Button(label="Close")
    close.connect("clicked", lambda _button: window.close())
    footer.append(close)
    layout.append(footer)
    notebook.set_current_page(0)
    return window, notebook


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="check GTK dependencies without opening a window")
    args = parser.parse_args()
    Gio, Gtk, _ = load_gtk()
    if args.check:
        return 0
    pages = load_pages(sys.stdin.read())
    app = Gtk.Application(application_id="org.omarchy.MotionCuesSetup",
                          flags=Gio.ApplicationFlags.NON_UNIQUE)

    def activate(application):
        window, _ = build_window(application, pages)
        window.present()

    app.connect("activate", activate)
    return app.run([])


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError) as error:
        raise SystemExit(str(error)) from error
