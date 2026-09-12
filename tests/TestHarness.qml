import QtQuick
import Quickshell
import Quickshell.Io
// Copied alongside a runtime snapshot by test-integration.cjs.

ShellRoot {
    Loader {
        id: loader
        active: true
        sourceComponent: Service {
            ipcTarget: "motion-cues-test"
            settingsPath: Quickshell.env("MOTION_CUES_TEST_CONFIG")
            renderEnabled: Quickshell.env("MOTION_CUES_TEST_RENDER") === "1"
            layerNamespace: "omarchy-motion-cues-test"
        }
    }
    IpcHandler {
        target: "motion-cues-lifecycle-test"
        function unload(): string { loader.active = false; return "ok"; }
        function load(): string { loader.active = true; return "ok"; }
    }
}
