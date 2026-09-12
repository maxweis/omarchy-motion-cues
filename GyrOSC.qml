import QtQuick
import Quickshell
import Quickshell.Io

Item {
    id: root
    property bool active: false
    property int port: 9999
    property bool alive: true
    property bool listening: false
    property string error: ""
    property int processPort: 0
    readonly property var processId: receiver.processId
    signal sample(var value)

    function sync() {
        if (!alive) return;
        if (!active || (receiver.running && processPort !== port)) {
            listening = false;
            if (!active) error = "";
            receiver.running = false;
            return;
        }
        if (receiver.running) return;
        error = "";
        processPort = port;
        receiver.command = ["python3", "-u", decodeURIComponent(Qt.resolvedUrl("gyrosc_receiver.py").toString().replace(/^file:\/\//, "")),
            "--port", String(port), "--watch-stdin"];
        receiver.running = true;
    }

    function restart() {
        processPort = 0;
        retry.stop();
        sync();
    }

    onActiveChanged: { retry.stop(); sync(); }
    onPortChanged: sync()
    Component.onCompleted: sync()
    Component.onDestruction: {
        alive = false;
        retry.stop();
        receiver.running = false;
    }

    Process {
        id: receiver
        stdinEnabled: true
        stdout: SplitParser {
            onRead: function(data) {
                if (!root.alive || !root.active || root.processPort !== root.port) return;
                try {
                    var value = JSON.parse(data);
                    if (value.type === "listening") root.listening = true;
                    else if (value.type === "error") root.error = value.message;
                    else if (value.type === "sample") root.sample(value);
                } catch (error) { root.error = "Invalid GyrOSC receiver output"; }
            }
        }
        onRunningChanged: {
            if (!running && root.alive) {
                root.listening = false;
                if (root.active) {
                    if (!root.error && root.processPort === root.port)
                        root.error = "GyrOSC receiver stopped; retrying automatically";
                    retry.interval = root.processPort === root.port ? 3000 : 50;
                    retry.restart();
                }
            }
        }
    }
    Timer { id: retry; onTriggered: root.sync() }
}
