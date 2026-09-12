import QtQuick
import Quickshell
import Quickshell.Io
import "src" as MotionCues
// Copied with a runtime snapshot that preserves the installed source layout.

ShellRoot {
    id: harness
    property int inactivityDisables: 0
    Loader {
        id: loader
        active: true
        sourceComponent: MotionCues.Service {
            ipcTarget: "motion-cues-test"
            settingsPath: Quickshell.env("MOTION_CUES_TEST_CONFIG")
            renderEnabled: Quickshell.env("MOTION_CUES_TEST_RENDER") === "1"
            layerNamespace: "omarchy-motion-cues-test"
            inactivityTimeoutMs: Number(Quickshell.env("MOTION_CUES_TEST_TIMEOUT_MS")) || 300000
            // Never let a test's inactivity timer disable the user's live plugin.
            inactivityDisableCommand: ["quickshell", "-p", Quickshell.shellDir + "/shell.qml",
                "ipc", "call", "motion-cues-lifecycle-test", "disableForInactivity"]
        }
    }
    IpcHandler {
        target: "motion-cues-lifecycle-test"
        function unload(): string { loader.active = false; return "ok"; }
        function load(): string { loader.active = true; return "ok"; }
        function state(): string {
            return JSON.stringify({active: loader.active, inactivityDisables: harness.inactivityDisables,
                disableCommand: loader.item ? loader.item.inactivityDisableCommand : null,
                launcherPath: loader.item ? loader.item.inactivityLauncherPath : null});
        }
        function disableForInactivity(): string {
            harness.inactivityDisables++;
            loader.active = false;
            return "ok";
        }
    }
}
