import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "MotionModel.js" as Motion
import "Settings.js" as Settings
import "Phyphox.js" as Phyphox

Item {
    id: root
    // Separate IPC/config names make the same component testable without the live shell.
    property string ipcTarget: "motion-cues"
    property string settingsPath: (Quickshell.env("XDG_CONFIG_HOME") || Quickshell.env("HOME") + "/.config") + "/omarchy/motion-cues.json"
    property string layerNamespace: "omarchy-motion-cues"
    property bool renderEnabled: true
    property bool alive: true
    property bool ready: false
    property bool connected: false
    property string activeProvider: ""
    property var providerSamples: ({})
    property string connectionPhase: ""
    property int toastId: 0
    property var pendingToast: null
    property int toastCount: 0
    property string message: "Connecting to phone"
    property var config: Settings.settings({})
    property var savedConfig: ({})
    property var motion: Motion.initial()
    property var latest: null
    property var request: null
    property double requestStarted: 0
    property double lastAdvance: 0
    readonly property int pollIntervalMs: 50
    readonly property int requestTimeoutMs: 800
    readonly property int retryIntervalMs: 1000
    readonly property int staleIntervalMs: 900
    property int timerWakeups: 0
    property int requestCount: 0
    property int sampleCount: 0
    property real latencyMs: 0
    property real offsetX: 0
    property real offsetY: 0
    property real reflectionX: 0
    property real reflectionY: 0
    property real reflectionDepth: 0
    Behavior on reflectionX { NumberAnimation { duration: 85; easing.type: Easing.OutQuad } }
    Behavior on reflectionY { NumberAnimation { duration: 85; easing.type: Easing.OutQuad } }
    Behavior on reflectionDepth { NumberAnimation { duration: 85; easing.type: Easing.OutQuad } }

    function connectionToast(phase, title, body) {
        if (connectionPhase === phase) return;
        connectionPhase = phase;
        // Replace one short-lived toast instead of stacking notifications.
        // Only transitions enter this path; regular samples/retries stay quiet.
        pendingToast = { title: title, body: body };
        sendPendingToast();
    }

    function sendPendingToast() {
        if (!alive || !pendingToast || toastProcess.running) return;
        var next = pendingToast;
        pendingToast = null;
        toastProcess.command = ["notify-send", "-a", "Motion Cues", "--transient",
            "--expire-time=3000", "--print-id", "--replace-id=" + toastId,
            next.title, next.body];
        toastCount++;
        toastProcess.running = true;
    }

    function resetFeed(reason, announce) {
        connected = false;
        activeProvider = "";
        providerSamples = ({});
        message = reason;
        motion = Motion.initial();
        lastAdvance = 0;
        latest = null;
        staleTimer.stop();
        offsetX = 0;
        offsetY = 0;
        reflectionX = 0;
        reflectionY = 0;
        reflectionDepth = 0;
        if (announce !== false)
            connectionToast("disconnected", "Motion Cues disconnected", reason + "\nRetrying automatically.");
    }

    function cancelRequest() {
        requestTimer.stop();
        var old = request;
        request = null;
        if (old) {
            old.onreadystatechange = function() {};
            old.abort();
        }
    }

    function loadConfig(raw) {
        try {
            var parsed = JSON.parse(raw);
            var next = Settings.settings(parsed);
            var starting = !ready;
            var endpointChanged = next.url !== config.url || next.provider !== config.provider
                || next.gyroscPort !== config.gyroscPort;
            savedConfig = parsed;
            if (endpointChanged) {
                cancelRequest();
                providerSamples = ({});
                resetFeed("Connecting to phone", false);
            }
            config = next;
            ready = next.provider !== "phyphox" || next.url !== "";
            if (!ready) {
                pollTimer.stop();
                resetFeed("Set Phone address in the Motion Cues menu", false);
                return;
            }
            if (starting || endpointChanged)
                connectionToast("connecting", "Motion Cues connecting", connectionHint());
            if (!connected) message = connectionHint();
            if (!request && !pollTimer.running) schedulePoll(pollIntervalMs);
        } catch (error) {
            ready = false;
            pollTimer.stop();
            cancelRequest();
            resetFeed("Settings error: " + error.message);
        }
    }

    function configure(raw) {
        try {
            var changes = JSON.parse(raw);
            if (!changes || typeof changes !== "object" || Array.isArray(changes))
                throw new Error("Settings must be an object");
            var next = Object.assign({}, savedConfig, config, changes);
            next = Object.assign({}, next, Settings.settings(next));
            settingsFile.setText(JSON.stringify(next, null, 2) + "\n");
            loadConfig(JSON.stringify(next));
            return "ok";
        } catch (error) { return "error: " + error.message; }
    }

    function connectionHint() {
        if (config.provider === "phyphox") return "Connecting to " + config.url;
        return "Waiting for GyrOSC on UDP " + config.gyroscPort
            + (config.provider === "auto" && config.url ? "; checking phyphox at " + config.url : "");
    }

    function acceptSample(value, provider) {
        if (!alive || !ready || (config.provider !== "auto" && config.provider !== provider)) return;
        var previous = providerSamples[provider];
        providerSamples[provider] = value;
        // A stalled first candidate cannot block an advancing second provider.
        if (activeProvider && activeProvider !== provider && (connected || !previous
                || previous.session !== value.session || value.t <= previous.t)) return;
        if (activeProvider !== provider) {
            motion = Motion.initial();
            activeProvider = provider;
            if (previous && previous.session === value.session && value.t > previous.t)
                motion = Motion.step(motion, previous, config);
        }
        if (provider === "gyrosc") { cancelRequest(); pollTimer.stop(); }
        var next = Motion.step(motion, value, config);
        latest = value;
        motion = next;
        // A first packet must expire too, even if a second one never arrives.
        if (!staleTimer.running) staleTimer.restart();
        if (!next.fresh) return;
        sampleCount++;
        lastAdvance = Date.now();
        staleTimer.restart();
        connected = true;
        message = "Live phone motion";
        connectionToast("connected", "Motion Cues connected", "Receiving motion from "
            + (provider === "gyrosc" ? "GyrOSC at " + value.peer : "phyphox at " + config.url));
        offsetX = Math.round(next.x * 4) / 4;
        offsetY = Math.round(next.y * 4) / 4;
        reflectionX = Math.round(next.reflectionX * 1000) / 1000;
        reflectionY = Math.round(next.reflectionY * 1000) / 1000;
        reflectionDepth = Math.round(next.reflectionDepth * 1000) / 1000;
    }

    function poll() {
        if (!alive || !ready || request || !config.url || config.provider === "gyrosc"
                || activeProvider === "gyrosc") return;
        var xhr = new XMLHttpRequest();
        request = xhr;
        requestStarted = Date.now();
        requestCount++;
        requestTimer.restart();
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== XMLHttpRequest.DONE || !root.alive || root.request !== xhr) return;
            root.request = null;
            requestTimer.stop();
            root.latencyMs = Date.now() - root.requestStarted;
            try {
                if (xhr.status !== 200) throw new Error("Cannot reach phone");
                var value = Phyphox.sample(JSON.parse(xhr.responseText));
                root.acceptSample(value, "phyphox");
                root.schedulePoll(Math.max(1, root.pollIntervalMs - root.latencyMs));
            } catch (error) {
                root.resetFeed(error.message);
                root.schedulePoll(root.retryIntervalMs);
            }
        };
        xhr.open("GET", config.url + Phyphox.requestPath);
        xhr.send();
    }

    function schedulePoll(delayMs) {
        if (!alive || !ready || !config.url || config.provider === "gyrosc" || activeProvider === "gyrosc") return;
        pollTimer.interval = delayMs;
        pollTimer.restart();
    }

    function status() {
        return JSON.stringify({ enabled: true, connected: connected, message: message,
            version: "1.7.2", connectionPhase: connectionPhase, toasts: toastCount, toastId: toastId,
            provider: config.provider, detectedApp: activeProvider, gyroscPort: config.gyroscPort,
            gyroscListening: gyrosc.listening, gyroscError: gyrosc.error, gyroscProcessId: gyrosc.processId,
            url: config.url, mount: config.mount, sensitivity: config.sensitivity,
            bubbleSize: config.bubbleSize, offsetX: offsetX, offsetY: offsetY,
            accelerationIntensity: motion.intensity,
            flowVelocityX: motion.velocityX, flowVelocityY: motion.velocityY,
            extraBubbles: connected ? Motion.extraCount(motion.intensity) : 0,
            reflectionX: reflectionX, reflectionY: reflectionY, reflectionDepth: reflectionDepth,
            sample: latest, requests: requestCount, samples: sampleCount,
            timerWakeups: timerWakeups,
            latencyMs: latencyMs, clickThrough: true,
            screenCount: Quickshell.screens.length,
            ageMs: lastAdvance ? Date.now() - lastAdvance : null });
    }

    GyrOSC {
        id: gyrosc
        active: root.alive && root.ready && root.config.provider !== "phyphox"
        port: root.config.gyroscPort
        onSample: function(value) { root.acceptSample(value, "gyrosc"); }
        onListeningChanged: {
            if (!listening && root.alive && root.activeProvider === "gyrosc") {
                root.resetFeed("GyrOSC receiver stopped; retrying automatically");
                root.schedulePoll(1);
            }
        }
        onErrorChanged: {
            if (error && !root.connected && (root.config.provider === "gyrosc" || !root.config.url))
                root.message = error;
        }
    }

    FileView {
        id: settingsFile
        path: root.settingsPath
        watchChanges: true
        atomicWrites: true
        printErrors: false
        onFileChanged: reload()
        onLoaded: root.loadConfig(text())
        onLoadFailed: root.loadConfig("{}")
    }

    Process {
        id: toastProcess
        stdout: StdioCollector { id: toastOutput; waitForEnd: true }
        onExited: function(exitCode) {
            var nextId = Number(toastOutput.text.trim());
            if (exitCode === 0 && isFinite(nextId) && nextId > 0) root.toastId = nextId;
            Qt.callLater(root.sendPendingToast);
        }
    }

    // One-shot deadlines: no 20 Hz polling or repeating watchdog during backoff.
    Timer {
        id: pollTimer
        onTriggered: { root.timerWakeups++; root.poll(); }
    }
    Timer {
        id: requestTimer
        interval: root.requestTimeoutMs
        onTriggered: {
            root.timerWakeups++;
            root.cancelRequest();
            root.resetFeed("Phone connection timed out");
            root.schedulePoll(root.retryIntervalMs);
        }
    }
    Timer {
        id: staleTimer
        interval: root.staleIntervalMs
        onTriggered: {
            root.timerWakeups++;
            var provider = root.activeProvider;
            root.resetFeed(provider === "gyrosc" ? "Waiting for fresh motion from GyrOSC"
                : "Waiting for fresh motion: keep phyphox open and press Play");
            root.schedulePoll(1);
        }
    }

    Component.onDestruction: {
        alive = false;
        cancelRequest();
    }

    IpcHandler {
        target: root.ipcTarget
        function status(): string { return root.status(); }
        function visuals(): string {
            var result = [];
            for (var i = 0; i < panels.instances.length; i++)
                result.push(panels.instances[i].visualState());
            return JSON.stringify(result);
        }
        function configure(json: string): string { return root.configure(json); }
        function reconnect(): string {
            if (!root.ready) return "error: Set a valid Phone address first";
            root.cancelRequest();
            root.resetFeed("Connecting to phone", false);
            if (root.config.provider !== "phyphox") gyrosc.restart();
            root.connectionToast("connecting", "Motion Cues connecting", root.connectionHint());
            root.schedulePoll(1);
            return "ok";
        }
    }

    Variants {
        id: panels
        model: Quickshell.screens
        PanelWindow {
            id: panel
            required property var modelData
            screen: modelData
            visible: root.renderEnabled && root.connected
            anchors { top: true; bottom: true; left: true; right: true }
            color: "transparent"
            exclusionMode: ExclusionMode.Ignore
            WlrLayershell.namespace: root.layerNamespace
            WlrLayershell.layer: WlrLayer.Overlay
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
            mask: Region {}
            function visualState() { return field.snapshot(); }

            BubbleField {
                id: field
                anchors.fill: parent
                active: root.alive && root.renderEnabled && root.connected
                bubbleSize: root.config.bubbleSize
                velocityX: root.motion.velocityX
                velocityY: root.motion.velocityY
                intensity: root.motion.intensity
                reflectionX: root.reflectionX
                reflectionY: root.reflectionY
                reflectionDepth: root.reflectionDepth
            }
        }
    }
}
