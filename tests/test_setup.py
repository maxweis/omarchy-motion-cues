"""Headless guide-content checks: GTK is only imported when opening the UI."""

from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from setup_window import load_pages


class SetupTests(unittest.TestCase):
    def test_tabs_and_provider_content(self):
        destination = "Destination IP: 192.168.40.8 (wlan0)\nUDP port: 10001"
        pages = load_pages(destination)
        self.assertEqual([p["title"] for p in pages],
                         ["Overview", "phyphox setup", "GyrOSC setup"])
        text = ["\n".join(s["title"] + "\n" + s["body"] for s in p["sections"]) for p in pages]
        self.assertIn("Choose an app", text[0])
        self.assertIn("iPhone or Android", text[0])
        self.assertIn("Auto-detect", text[0])
        self.assertIn("recommended for iPhone because it offers background mode", text[0])
        for page in (text[0], text[2]):
            self.assertIn("run in background", page)
            self.assertIn("30 Hz (30 updates per second)", page)
        self.assertIn("Acceleration (without g)", text[1])
        self.assertIn("Phone address…", text[1])
        self.assertIn("/gyrosc/accel", text[2])
        self.assertIn("30 Hz", text[2])
        self.assertIn("sudo ufw allow", text[2])
        self.assertEqual(pages[2]["sections"][0]["body"], destination)
        self.assertIn("Required:", pages[2]["sections"][1]["title"])
        for other in text[:2]:
            self.assertNotIn(destination, other)
            self.assertNotIn("sudo ufw allow", other)
        self.assertNotIn("Acceleration (without g)", text[2])

    def test_destination_is_plain_text_and_refreshed_per_open(self):
        for destination in ["UDP port: 9999", "UDP port: 10001", "<b>not markup</b>"]:
            self.assertEqual(load_pages(destination)[2]["sections"][0]["body"], destination)
        self.assertIn("No network address found", load_pages("")[2]["sections"][0]["body"])

    def test_invalid_tab_structure_fails_clearly(self):
        with tempfile.TemporaryDirectory() as directory:
            guide = Path(directory) / "SETUP.txt"
            for text in ["missing tabs", "## orphan heading", "[Overview]\n## Only tab\nText"]:
                guide.write_text(text)
                with self.assertRaises(ValueError):
                    load_pages("", guide)


if __name__ == "__main__":
    unittest.main()
