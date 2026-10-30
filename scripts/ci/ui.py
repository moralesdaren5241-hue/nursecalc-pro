#!/usr/bin/env python3
"""Minimal UI driver for the Android emulator smoke test.

Reads the on-screen accessibility tree with `uiautomator dump` (the WebView exposes
its content there) and finds elements by visible text or content description.

  ui.py has  TEXT            exit 0 if an element whose text/desc contains TEXT is visible
  ui.py tap  TEXT [--last]   tap the centre of the first (or last) matching element
  ui.py dump FILE            save the raw hierarchy XML
  ui.py focus PACKAGE        exit 0 if PACKAGE is the resumed/focused app (1 = not, 3 = unknown)
  ui.py unfocused PACKAGE    exit 0 only if PACKAGE is definitely NOT in the foreground
"""
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

DEVICE_XML = "/sdcard/nc-ui.xml"


def adb(*args: str) -> str:
    return subprocess.run(["adb", *args], capture_output=True, text=True, timeout=60).stdout


def hierarchy() -> ET.Element:
    last_err = ""
    for _ in range(4):
        out = adb("shell", "uiautomator", "dump", DEVICE_XML)
        xml = adb("exec-out", "cat", DEVICE_XML)
        if xml.strip().startswith("<?xml"):
            return ET.fromstring(xml)
        last_err = out
        time.sleep(1.5)
    raise SystemExit(f"uiautomator dump failed: {last_err.strip()}")


def label(node: ET.Element) -> str:
    return f"{node.get('text', '')} {node.get('content-desc', '')}".strip()


def matches(text: str) -> list:
    root = hierarchy()
    exact, partial = [], []
    for node in root.iter("node"):
        t, d = node.get("text", ""), node.get("content-desc", "")
        if text in (t, d):
            exact.append(node)
        elif text in t or text in d:
            partial.append(node)
    return exact or partial


def centre(node: ET.Element) -> tuple:
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.get("bounds", "[0,0][0,0]")))
    return (x1 + x2) // 2, (y1 + y2) // 2


def main() -> int:
    cmd = sys.argv[1]
    if cmd == "has":
        return 0 if matches(sys.argv[2]) else 1
    if cmd == "tap":
        found = matches(sys.argv[2])
        if not found:
            print(f"not found: {sys.argv[2]}", file=sys.stderr)
            return 1
        node = found[-1] if "--last" in sys.argv else found[0]
        x, y = centre(node)
        adb("shell", "input", "tap", str(x), str(y))
        print(f"tapped '{label(node)}' at {x},{y}")
        return 0
    if cmd == "dump":
        root = hierarchy()
        with open(sys.argv[2], "w", encoding="utf-8") as fh:
            fh.write(ET.tostring(root, encoding="unicode"))
        return 0
    if cmd in ("focus", "unfocused"):
        # Android 14+ no longer prints mCurrentFocus under `dumpsys window windows`,
        # which made every "in foreground" check fail and every negated check pass
        # vacuously. Read the resumed activity and the focused window from both
        # services, and report "unknown" (exit 3) instead of guessing when neither
        # is printed, so a negated check can't pass by accident.
        lines = adb("shell", "dumpsys", "activity", "activities").splitlines()
        lines += adb("shell", "dumpsys", "window").splitlines()
        keys = ("topResumedActivity", "mResumedActivity", "ResumedActivity:", "mCurrentFocus", "mFocusedApp")
        focus = [l.strip() for l in lines if any(k in l for k in keys)]
        print("\n".join(focus))
        if not focus:
            print("could not determine the foreground app", file=sys.stderr)
            return 3
        resumed = [l for l in focus if "Resumed" in l]
        decisive = resumed or focus
        mine = any(sys.argv[2] in l for l in decisive)
        if cmd == "focus":
            return 0 if mine else 1
        return 1 if mine else 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
