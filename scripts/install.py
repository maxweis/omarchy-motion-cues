#!/usr/bin/env python3
"""Per-user install/removal. Only the plugin namespace and owned launcher change."""

import argparse
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile

PLUGIN_ID = "max.motion-cues"
SOURCE = Path(__file__).resolve().parent.parent
RUNTIME_FILES = (
    "manifest.json", "README.md", "LICENSE", "scripts/install.py",
    "src/Service.qml", "src/MotionModel.js", "src/Settings.js", "src/Phyphox.js",
    "src/GyrOSC.qml", "src/gyrosc_receiver.py", "src/BubbleFlow.js", "src/Bubble.qml",
    "src/BubbleField.qml", "src/Endpoint.jq", "src/setup_window.py",
    "docs/SETUP.txt", "config/menu.jsonc", "bin/omarchy-motion-cues",
)
# Owned files from releases before the source-directory layout. The complete
# installed plugin is backed up before these obsolete copies are removed.
LEGACY_RUNTIME_FILES = (
    "Service.qml", "MotionModel.js", "Settings.js", "Phyphox.js", "GyrOSC.qml",
    "gyrosc_receiver.py", "BubbleFlow.js", "Bubble.qml", "BubbleField.qml",
    "Endpoint.jq", "setup_window.py", "SETUP.txt", "menu.jsonc", "omarchy-motion-cues",
)


def checked_file(root, name):
    """Reject symlinks in nested paths before a deployment can follow them."""
    path = root / name
    for component in (path, *path.parents):
        if component == root:
            break
        if component.is_symlink():
            raise ValueError(f"Refusing symlink in release path: {component}")
        if component != path and component.exists() and not component.is_dir():
            raise ValueError(f"Expected a release directory: {component}")
    if path.exists() and not path.is_file():
        raise ValueError(f"Expected a regular release file: {path}")
    return path


def jsonc_text(raw, keep_trailing_commas=False):
    """Blank comments/trailing commas without changing offsets or quoted strings."""
    out = list(raw)
    index = 0
    while index < len(raw):
        if raw[index] == '"':
            _, end = json.JSONDecoder().raw_decode(raw, index)
            index = end
        elif raw.startswith("//", index) or raw.startswith("/*", index):
            if raw.startswith("//", index):
                end = raw.find("\n", index)
                if end < 0:
                    end = len(raw)
            else:
                end = raw.find("*/", index + 2)
                if end < 0:
                    raise ValueError("Unclosed JSONC comment")
                end += 2
            out[index:end] = ["\n" if c == "\n" else " " for c in raw[index:end]]
            index = end
        else:
            index += 1
    clean = "".join(out)
    if keep_trailing_commas:
        return clean
    index = 0
    while index < len(clean):
        if clean[index] == '"':
            _, index = json.JSONDecoder().raw_decode(clean, index)
        else:
            if clean[index] == "," and clean[index + 1:].lstrip().startswith(("}", "]")):
                out[index] = " "
            index += 1
    return "".join(out)


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"Duplicate menu key: {key}")
        value[key] = item
    return value


def menu_entries(raw):
    clean = jsonc_text(raw)
    document = json.loads(clean, object_pairs_hook=unique_object)
    if not isinstance(document, dict):
        raise ValueError("Menu must be a JSONC object")
    decoder = json.JSONDecoder()

    def scan(start):
        index = start + 1
        entries = []
        while True:
            while clean[index].isspace() or clean[index] == ",":
                index += 1
            if clean[index] == "}":
                return entries, index
            key_start = index
            key, index = decoder.raw_decode(clean, index)
            while clean[index].isspace() or clean[index] == ":":
                index += 1
            value_start = index
            value, index = decoder.raw_decode(clean, index)
            entries.append((key, key_start, value_start, index, value))

    entries, end = scan(clean.index("{"))
    if "items" in document:
        if not isinstance(document["items"], dict):
            raise ValueError("Menu items must be an object")
        item = next(row for row in entries if row[0] == "items")
        entries, end = scan(item[2])
    return entries, end


def update_menu(raw, definitions, remove=False):
    """Replace only owned values; preserve other entries and their comments verbatim."""
    entries, end = menu_entries(raw)
    edits = []
    present = set()
    for key, start, value_start, value_end, value in entries:
        if key not in definitions:
            continue
        present.add(key)
        if remove:
            # Refuse to erase user-edited plugin rows on uninstall.
            if value != definitions[key]:
                raise ValueError(f"Menu row {key} was customized; remove it manually first")
            # Keep the separator as a harmless empty region, then normalize commas below.
            edits.append((start, value_end, ""))
        else:
            edits.append((value_start, value_end, json.dumps(definitions[key], ensure_ascii=False, indent=2)))
    if remove:
        # Remove entries with adjacent separators one by one so comments stay intact.
        result = raw
        for start, stop, _ in sorted(edits, reverse=True):
            clean = jsonc_text(result)
            right = stop
            while right < len(clean) and clean[right].isspace():
                right += 1
            if right < len(clean) and clean[right] == ",":
                result = result[:right] + result[right + 1:]
            else:
                left = start - 1
                while left >= 0 and clean[left].isspace():
                    left -= 1
                if left >= 0 and clean[left] == ",":
                    result = result[:left] + " " + result[left + 1:]
            result = result[:start] + result[stop:]
        menu_entries(result)
        return result
    additions = {key: value for key, value in definitions.items() if key not in present}
    if additions:
        last = entries[-1][3] if entries else None
        # Existing trailing commas (allowed by Omarchy) must not become double commas.
        suffix = jsonc_text(raw[last:end], keep_trailing_commas=True) if last is not None else ""
        separator = "," if entries and not suffix.lstrip().startswith(",") else ""
        body = json.dumps(additions, ensure_ascii=False, indent=2)[1:-1]
        edits.append((end, end, separator + body + "\n"))
    for start, stop, text in sorted(edits, reverse=True):
        raw = raw[:start] + text + raw[stop:]
    menu_entries(raw)
    return raw


def atomic_write(path, data, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        raise ValueError(f"Refusing to replace symlink: {path}")
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uninstall", action="store_true", help="back up and remove plugin; retain settings")
    parser.add_argument("--no-reload", action="store_true", help="stage files only; do not call the desktop")
    args = parser.parse_args()
    home = Path.home()
    # Installed Omarchy's plugin registry and menu explicitly use ~/.config.
    config = home / ".config/omarchy"
    plugin = config / "plugins" / PLUGIN_ID
    menu = config / "extensions/omarchy-menu.jsonc"
    launcher = home / ".local/bin/omarchy-motion-cues"
    definitions = json.loads(checked_file(SOURCE, "config/menu.jsonc").read_text())
    before = menu.read_text() if menu.exists() else "{\n}\n"
    after = update_menu(before, definitions, args.uninstall)
    for target in (plugin, menu, launcher):
        if target.is_symlink():
            raise ValueError(f"Refusing to replace symlink: {target}")
    if plugin.exists() and json.loads((plugin / "manifest.json").read_text()).get("id") != PLUGIN_ID:
        raise ValueError("Installed directory belongs to a different plugin")
    if launcher.exists() and "max.motion-cues" not in launcher.read_text():
        raise ValueError("Existing launcher does not belong to Motion Cues")
    if not args.uninstall:
        for name in RUNTIME_FILES:
            if not checked_file(SOURCE, name).is_file():
                raise ValueError(f"Missing or unsafe release file: {name}")
            checked_file(plugin, name)
        for name in LEGACY_RUNTIME_FILES:
            checked_file(plugin, name)
        if not args.no_reload:
            for command in ("omarchy", "quickshell", "bash", "jq", "notify-send", "python3"):
                if shutil.which(command) is None:
                    raise ValueError(f"Required command is missing: {command}")
            subprocess.run(["/usr/bin/python3", "-B", str(SOURCE / "src/setup_window.py"), "--check"], check=True)
            subprocess.run(["omarchy", "plugin", "validate", str(SOURCE)], check=True)
    state = Path(os.environ.get("XDG_STATE_HOME", home / ".local/state")) / "motion-cues/backups"
    state.mkdir(parents=True, exist_ok=True)
    backup = Path(tempfile.mkdtemp(prefix="remove-" if args.uninstall else "install-", dir=state))
    if plugin.exists():
        shutil.copytree(plugin, backup / "plugin", symlinks=True)
    if menu.exists():
        shutil.copy2(menu, backup / "menu.jsonc")
    if launcher.exists():
        shutil.copy2(launcher, backup / "launcher")
    print(f"Backup: {backup}")
    # Do not overwrite a menu edited by another process while the backup ran.
    if (menu.read_text() if menu.exists() else "{\n}\n") != before:
        raise ValueError("Menu changed during installation; no files replaced. Please retry")
    if args.uninstall and not args.no_reload and plugin.exists():
        subprocess.run(["omarchy", "plugin", "disable", PLUGIN_ID], check=True)
    if args.uninstall:
        if plugin.exists():
            # Recoverable move of this exact validated plugin directory only.
            shutil.move(str(plugin), str(backup / "removed-plugin"))
        if launcher.exists():
            shutil.move(str(launcher), str(backup / "removed-launcher"))
    else:
        plugin.mkdir(parents=True, exist_ok=True)
        for name in RUNTIME_FILES:
            atomic_write(plugin / name, (SOURCE / name).read_bytes(), 0o755 if name == "bin/omarchy-motion-cues" else 0o644)
        atomic_write(launcher, (SOURCE / "bin/omarchy-motion-cues").read_bytes(), 0o755)
        for name in LEGACY_RUNTIME_FILES:
            legacy = checked_file(plugin, name)
            if legacy.exists():
                legacy.unlink()
    menu_mode = stat.S_IMODE(menu.stat().st_mode) if menu.exists() else 0o644
    atomic_write(menu, after.encode(), menu_mode)
    if not args.no_reload:
        subprocess.run(["omarchy", "shell", "shell", "rescanPlugins"], check=True)
        subprocess.run(["omarchy", "menu", "refresh"], check=True)
    print("Removed Motion Cues; settings retained." if args.uninstall else
          "Installed Motion Cues. Open Omarchy > Motion Cues > Setup. Enable state is unchanged.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Motion Cues: {error}") from error
