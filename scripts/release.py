#!/usr/bin/env python3
"""Validate and package an explicit set of public files, never a working-directory glob."""

import argparse
import gzip
import io
import json
from pathlib import Path
import re
import tarfile
from install import RUNTIME_FILES, SOURCE, checked_file

PUBLIC_FILES = RUNTIME_FILES + (
    ".gitignore", ".editorconfig", ".github/workflows/test.yml", "package.json",
    ".github/CONTRIBUTING.md", "docs/CHANGELOG.md", "docs/ARCHITECTURE.md", "docs/TESTING.md",
    "scripts/release.py", "tests/model.cjs",
    "tests/TestHarness.qml", "tests/test-model.cjs", "tests/test-flow.cjs",
    "tests/test-dynamic.cjs", "tests/test-endpoint.cjs", "tests/test-toasts.cjs",
    "tests/test-interface.cjs", "tests/test-setup.cjs", "tests/test-install.cjs",
    "tests/test-release.cjs", "tests/test-integration.cjs", "tests/temporary.cjs",
    "tests/test_gyrosc.py", "tests/test-gyrosc-integration.cjs", "tests/test_setup.py",
    "docs/SHOWCASE.md", "docs/media/motion-cues.gif", "docs/media/showcase.png",
    "demo/Showcase.qml", "demo/ExampleDesktop.qml", "demo/render.cpp", "scripts/render-demo.sh",
    "docs/media/desktop.gif", "docs/media/desktop.png",
)


def validate():
    manifest = json.loads((SOURCE / "manifest.json").read_text())
    version = manifest["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Version must use major.minor.patch")
    if json.loads((SOURCE / "package.json").read_text())["version"] != version:
        raise ValueError("Package and manifest versions differ")
    entry_point = manifest["entryPoints"]["service"]
    if entry_point not in RUNTIME_FILES or not entry_point.endswith(".qml"):
        raise ValueError("Service entry point must be a shipped QML file")
    if f'version: "{version}"' not in checked_file(SOURCE, entry_point).read_text():
        raise ValueError("Running service and manifest versions differ")
    if len(set(PUBLIC_FILES)) != len(PUBLIC_FILES):
        raise ValueError("Public file list contains duplicates")
    for name in PUBLIC_FILES:
        file = checked_file(SOURCE, name)
        if not file.is_file() or file.is_symlink() or not file.resolve().is_relative_to(SOURCE):
            raise ValueError(f"Missing or unsafe public file: {name}")
        if name.startswith("docs/media/"):
            data = file.read_bytes()
            signature = b"GIF89a" if name.endswith(".gif") else b"\x89PNG\r\n\x1a\n"
            if not data.startswith(signature) or len(data) > 5 * 1024 * 1024:
                raise ValueError(f"Invalid or oversized public demo media: {name}")
            continue
        text = file.read_text()
        if not name.startswith("tests/") and name != "scripts/release.py":
            if re.search(r"/home/(?:max|[A-Za-z][A-Za-z0-9_-]*)/|172\.20\.10\.1", text):
                raise ValueError(f"Machine-specific data in {name}")
    return version


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate without making an archive")
    parser.add_argument("--output-dir", type=Path, default=SOURCE / "dist")
    args = parser.parse_args()
    version = validate()
    if args.check:
        print(f"Public file and version checks passed: {version}")
        return
    # Canonical metadata and gzip timestamps make repeated builds byte-identical.
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode="wb", filename="", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w") as archive:
            for name in sorted(PUBLIC_FILES):
                data = (SOURCE / name).read_bytes()
                info = tarfile.TarInfo(f"omarchy-motion-cues-{version}/{name}")
                info.size = len(data)
                info.mode = 0o755 if name == "bin/omarchy-motion-cues" else 0o644
                archive.addfile(info, io.BytesIO(data))
    from install import atomic_write
    destination = args.output_dir / f"omarchy-motion-cues-{version}.tar.gz"
    atomic_write(destination, output.getvalue())
    print(destination)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        raise SystemExit(str(error)) from error
