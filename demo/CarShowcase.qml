import QtQuick
import "DriveSequence.js" as Drive
import "../src/MotionModel.js" as Motion
import "../src" as MotionCues

// An authored passenger-seat illustration, never a desktop/camera capture.
Rectangle {
    id: scene
    width: 1280
    height: 800
    color: "#0f1c29"
    readonly property real duration: Drive.duration
    property real seconds: 0
    property var drive: Drive.sample(0)
    property var motion: Motion.initial()
    property real bend: 0
    readonly property color mint: "#9ee6d6"
    readonly property color cream: "#f0dba9"

    function advance(value) {
        seconds = value;
        drive = Drive.sample(value);
        motion = Motion.step(motion, {
            x: drive.x,
            y: drive.y,
            z: 0,
            t: value,
            session: "car-showcase"
        }, {
            mount: "flat",
            sensitivity: 1
        });
        bend += (drive.x / 2.6 - bend) * (1 - Math.exp(-1 / 30 / 0.25));
        field.advance(1 / 30);
        road.requestPaint();
        signal.requestPaint();
        phoneGraph.requestPaint();
    }

    function signed(value) {
        return (value > 0 ? "+" : "") + value.toFixed(1);
    }

    // The car cabin stays fixed to the passenger's point of view. Road markings
    // and roadside objects move with integrated speed, not with acceleration.
    Canvas {
        id: road
        x: 0
        y: 100
        width: 1280
        height: 355
        onPaint: {
            var c = getContext("2d");
            c.reset();
            c.fillStyle = "#b4d0d2";
            c.fillRect(0, 0, width, height);
            c.fillStyle = "#f0e5c4";
            c.beginPath();
            c.arc(1055 - scene.bend * 35, 66, 30, 0, Math.PI * 2);
            c.fill();
            function polygon(points, fill) {
                c.fillStyle = fill;
                c.beginPath();
                c.moveTo(points[0][0], points[0][1]);
                for (var i = 1; i < points.length; i++)
                    c.lineTo(points[i][0], points[i][1]);
                c.closePath();
                c.fill();
            }
            var shift = -scene.bend * 55;
            polygon([[0, 130], [0, 108], [150 + shift, 55], [325 + shift, 126], [570 + shift, 70], [800 + shift, 118], [1040 + shift, 68], [1280, 120], [1280, 240]], "#89a9a4");
            polygon([[0, 160], [0, 142], [180 + shift, 110], [405 + shift, 159], [700 + shift, 115], [960 + shift, 142], [1170 + shift, 116], [1280, 143], [1280, 355], [0, 355]], "#698d7c");
            function point(p, side) {
                var depth = p * p;
                return [340 + scene.bend * 130 * Math.pow(1 - p, 2) + side * (14 + 350 * depth), 131 + 210 * depth];
            }
            function strip(left, right, color, low, high) {
                var ps = [];
                for (var j = 0; j <= 32; j++)
                    ps.push(point(low + (high - low) * j / 32, left));
                for (var k = 32; k >= 0; k--)
                    ps.push(point(low + (high - low) * k / 32, right));
                polygon(ps, color);
            }
            strip(-1.16, 1.16, "#a9af93", 0, 1);
            strip(-1, 1, "#49585d", 0, 1);
            strip(-0.96, -0.943, "#e4e2cd", 0, 1);
            strip(0.943, 0.96, "#e4e2cd", 0, 1);
            var offset = scene.drive.distance / 65;
            for (var n = 0; n < 12; n++) {
                var p = (n / 12 + offset) % 1;
                strip(-0.012, 0.012, "#eddda8", p, Math.min(1, p + 0.027));
            }
            // Perspective scaling makes acceleration and braking visible outside.
            for (var row = 0; row < 9; row++) {
                var d = (row / 9 + offset) % 1;
                for (var side = -1; side <= 1; side += 2) {
                    var pos = point(d, side * 1.23), size = 3 + 18 * d * d;
                    c.fillStyle = "#edf0dd";
                    c.fillRect(pos[0], pos[1] - size, size * 0.22, size);
                    c.fillStyle = "#cf9770";
                    c.fillRect(pos[0], pos[1] - size, size * 0.22, size * 0.25);
                }
            }
            for (var tree = 0; tree < 7; tree++) {
                var td = (tree / 7 + offset) % 1;
                for (var edge = -1; edge <= 1; edge += 2) {
                    var tp = point(td, edge * (1.55 + (tree % 3) * 0.20)), s = 9 + 46 * td * td;
                    c.fillStyle = "#4c6358";
                    c.fillRect(tp[0] - s * 0.07, tp[1] - s * 0.75, s * 0.14, s * 0.75);
                    c.fillStyle = tree % 2 ? "#456f60" : "#527e68";
                    c.beginPath();
                    c.ellipse(tp[0] - s * 0.42, tp[1] - s * 1.6, s * 0.84, s * 1.12);
                    c.fill();
                }
            }
        }
    }

    // Windshield pillars, dashboard, center console, and passenger's lap.
    Canvas {
        anchors.fill: parent
        onPaint: {
            var c = getContext("2d");
            c.reset();
            function shape(points, fill) {
                c.fillStyle = fill;
                c.beginPath();
                c.moveTo(points[0][0], points[0][1]);
                for (var i = 1; i < points.length; i++)
                    c.lineTo(points[i][0], points[i][1]);
                c.closePath();
                c.fill();
            }
            shape([[0, 100], [52, 100], [147, 350], [80, 391], [0, 244]], "#263a47");
            shape([[1280, 100], [1242, 100], [1171, 347], [1216, 428], [1280, 338]], "#263a47");
            shape([[0, 378], [146, 326], [418, 328], [574, 361], [1143, 346], [1280, 400], [1280, 800], [0, 800]], "#1d2e3c");
            shape([[0, 385], [152, 338], [420, 340], [575, 372], [1139, 358], [1280, 411], [1280, 426], [569, 387], [418, 355], [157, 353], [0, 402]], "#3c5260");
            shape([[320, 414], [432, 405], [502, 800], [201, 800]], "#14232f");
            shape([[368, 466], [426, 467], [471, 800], [320, 800]], "#263c49");
            // Two trouser-clad knees place the computer on the passenger's lap.
            c.fillStyle = "#354e64";
            c.beginPath();
            c.ellipse(459, 617, 309, 337);
            c.fill();
            c.beginPath();
            c.ellipse(842, 607, 323, 359);
            c.fill();
            c.strokeStyle = "#526d83";
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(551, 800);
            c.lineTo(603, 706);
            c.stroke();
            c.beginPath();
            c.moveTo(1047, 800);
            c.lineTo(1003, 704);
            c.stroke();
            c.fillStyle = "#304651";
            c.fillRect(46, 573, 142, 9);
            c.fillStyle = "#617983";
            c.fillRect(72, 568, 83, 7);
        }
    }

    // Rear-view mirror and left-hand driver's wheel keep the setting legible.
    Rectangle {
        x: 511
        y: 101
        width: 12
        height: 34
        color: "#293c48"
    }
    Rectangle {
        x: 420
        y: 125
        width: 203
        height: 45
        radius: 14
        color: "#253945"
        border.color: "#49616b"
        border.width: 3
        Rectangle {
            anchors.fill: parent
            anchors.margins: 7
            radius: 8
            color: "#8ba6a6"
        }
        Rectangle {
            x: 81
            y: 16
            width: 44
            height: 22
            radius: 7
            color: "#506b72"
        }
    }
    Rectangle {
        x: 111
        y: 339
        width: 186
        height: 62
        radius: 22
        color: "#0f202b"
        border.color: "#435a68"
        Text {
            x: 44
            y: 5
            width: 60
            horizontalAlignment: Text.AlignRight
            text: Math.round(scene.drive.speed * 3.6)
            color: "#eff4e8"
            font.pixelSize: 32
            font.weight: Font.Medium
        }
        Text {
            x: 114
            y: 21
            text: "km/h"
            color: "#a6bec7"
            font.pixelSize: 14
        }
    }
    Item {
        x: 58
        y: 382
        width: 273
        height: 235
        rotation: scene.bend * 28
        Rectangle {
            anchors.fill: parent
            radius: 118
            color: "transparent"
            border.color: "#0d1b25"
            border.width: 23
        }
        Rectangle {
            x: 104
            y: 85
            width: 65
            height: 62
            radius: 18
            color: "#3b5160"
            border.color: "#667c88"
        }
        Rectangle {
            x: 21
            y: 112
            width: 85
            height: 21
            rotation: 8
            color: "#0e1d29"
        }
        Rectangle {
            x: 168
            y: 112
            width: 85
            height: 21
            rotation: -8
            color: "#0e1d29"
        }
        Rectangle {
            x: 123
            y: 142
            width: 26
            height: 75
            color: "#0e1d29"
        }
    }

    // Laptop screen. The full-size example desktop is scaled inside the bezel;
    // real bubble components are rendered at the inset screen's dimensions.
    Rectangle {
        x: 474
        y: 237
        width: 754
        height: 481
        radius: 19
        color: "#0b151f"
        border.color: "#647781"
        border.width: 3
    }
    Rectangle {
        x: 845
        y: 244
        width: 7
        height: 7
        radius: 4
        color: "#3b5264"
    }
    Item {
        id: screen
        x: 490
        y: 258
        width: 720
        height: 450
        clip: true
        ExampleDesktop {
            width: 1280
            height: 800
            scale: screen.width / 1280
            transformOrigin: Item.TopLeft
            phaseTitle: scene.drive.name
            phaseDescription: scene.drive.cue + ". Your work stays in the center."
        }
        MotionCues.BubbleField {
            id: field
            anchors.fill: parent
            active: false
            randomSeed: 72519
            bubbleSize: 27
            velocityX: scene.motion.velocityX
            velocityY: scene.motion.velocityY
            intensity: scene.motion.intensity
            reflectionX: scene.motion.reflectionX
            reflectionY: scene.motion.reflectionY
            reflectionDepth: scene.motion.reflectionDepth
        }
    }
    // Perspective keyboard deck, hinge, trackpad, and front lip.
    Canvas {
        x: 451
        y: 713
        width: 798
        height: 72
        onPaint: {
            var c = getContext("2d");
            c.reset();
            c.fillStyle = "#899ba3";
            c.beginPath();
            c.moveTo(25, 0);
            c.lineTo(774, 0);
            c.lineTo(798, 54);
            c.lineTo(0, 54);
            c.closePath();
            c.fill();
            c.fillStyle = "#3b4e5d";
            for (var row = 0; row < 3; row++)
                for (var col = 0; col < 19; col++)
                    c.fillRect(49 + col * 37 - row * 2, 5 + row * 9, 31, 6);
            c.fillStyle = "#aebec2";
            c.fillRect(306, 34, 186, 15);
            c.fillStyle = "#516874";
            c.fillRect(0, 54, 798, 7);
            c.fillStyle = "#1c2e3a";
            c.fillRect(349, 54, 100, 3);
        }
    }

    // Phone on the center console, separate from the driver's controls.
    Rectangle {
        x: 222
        y: 445
        width: 199
        height: 318
        radius: 29
        color: "#08141d"
        border.color: "#8599a3"
        border.width: 3
        Rectangle {
            x: 9
            y: 10
            width: 181
            height: 297
            radius: 22
            color: "#142b36"
        }
        Rectangle {
            x: 73
            y: 11
            width: 54
            height: 7
            radius: 4
            color: "#08141d"
        }
        Column {
            x: 23
            y: 34
            spacing: 8
            Text {
                text: "PHONE SENSOR"
                color: scene.cream
                font.pixelSize: 16
                font.weight: Font.DemiBold
            }
            Text {
                text: "Accelerometer"
                color: "#f1f3e9"
                font.pixelSize: 19
            }
            Text {
                text: "●  Streaming at 30 Hz"
                color: scene.mint
                font.pixelSize: 13
            }
        }
        Canvas {
            id: phoneGraph
            x: 23
            y: 116
            width: 153
            height: 71
            onPaint: {
                var c = getContext("2d");
                c.reset();
                c.strokeStyle = "#36505b";
                c.lineWidth = 1;
                c.beginPath();
                c.moveTo(0, 35);
                c.lineTo(width, 35);
                c.stroke();
                for (var axis = 0; axis < 2; axis++) {
                    c.strokeStyle = axis === 0 ? "#9ee6d6" : "#f0dba9";
                    c.lineWidth = 2;
                    c.beginPath();
                    for (var i = 0; i <= width; i++) {
                        var sample = Drive.sample(Math.max(0, scene.seconds - 2 + i / width * 2));
                        var v = axis === 0 ? sample.x : sample.y;
                        var y = 35 - v * 9;
                        if (i === 0)
                            c.moveTo(i, y);
                        else
                            c.lineTo(i, y);
                    }
                    c.stroke();
                }
            }
        }
        Text {
            x: 23
            y: 202
            text: "Sideways"
            color: scene.mint
            font.pixelSize: 15
        }
        Text {
            x: 119
            y: 202
            text: scene.signed(scene.drive.x)
            color: scene.mint
            font.pixelSize: 17
            font.family: "monospace"
        }
        Text {
            x: 23
            y: 233
            text: "Forward"
            color: scene.cream
            font.pixelSize: 15
        }
        Text {
            x: 119
            y: 233
            text: scene.signed(scene.drive.y)
            color: scene.cream
            font.pixelSize: 17
            font.family: "monospace"
        }
        Text {
            x: 23
            y: 266
            text: "m/s²  ·  local Wi-Fi"
            color: "#a8c1ca"
            font.pixelSize: 14
        }
        Rectangle {
            x: 74
            y: 295
            width: 51
            height: 4
            radius: 2
            color: "#76909b"
        }
    }

    // Explicit, animated phone -> laptop data path; it stays live while stopped.
    Canvas {
        id: signal
        x: 322
        y: 362
        width: 228
        height: 116
        onPaint: {
            var c = getContext("2d");
            c.reset();
            c.lineWidth = 2;
            c.strokeStyle = "#436b73";
            c.beginPath();
            c.moveTo(0, 101);
            c.bezierCurveTo(19, 19, 131, 21, 210, 38);
            c.stroke();
            var t = (scene.seconds * 1.05) % 1;
            for (var i = 0; i < 3; i++) {
                var p = (t + i / 3) % 1;
                var q = 1 - p;
                var x = 3 * q * q * p * 19 + 3 * q * p * p * 131 + p * p * p * 210;
                var y = q * q * q * 101 + 3 * q * q * p * 19 + 3 * q * p * p * 21 + p * p * p * 38;
                c.fillStyle = "#a8f0df";
                c.beginPath();
                c.arc(x, y, 3.5, 0, Math.PI * 2);
                c.fill();
            }
            c.strokeStyle = "#a8f0df";
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(199, 30);
            c.lineTo(210, 38);
            c.lineTo(198, 42);
            c.stroke();
        }
    }
    Rectangle {
        x: 315
        y: 353
        width: 159
        height: 55
        radius: 11
        color: "#152a36"
        border.color: "#45636b"
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            y: 8
            text: "WIRELESS"
            color: scene.mint
            font.pixelSize: 15
            font.weight: Font.DemiBold
            font.letterSpacing: 1
        }
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            y: 30
            text: "acceleration data"
            color: "#c3d8df"
            font.pixelSize: 14
        }
    }

    // A caption belongs to the demonstration, not to the runtime overlay.
    Rectangle {
        width: parent.width
        height: 100
        color: "#0f1c29"
        Text {
            x: 32
            y: 16
            text: "MOTION CUES"
            color: scene.cream
            font.pixelSize: 16
            font.letterSpacing: 3
        }
        Text {
            x: 32
            y: 46
            text: "Car: " + scene.drive.name.toLowerCase()
            color: "#f0f4ec"
            font.pixelSize: 30
            font.weight: Font.DemiBold
        }
        Text {
            x: 540
            y: 49
            text: scene.drive.cue
            color: scene.mint
            font.pixelSize: 29
            font.weight: Font.Medium
        }
        Text {
            x: 1051
            y: 40
            width: 54
            horizontalAlignment: Text.AlignHCenter
            text: ({
                    down: "↓",
                    up: "↑",
                    left: "←",
                    right: "→"
                })[scene.drive.direction] || "·"
            color: scene.mint
            font.pixelSize: 42
        }
        Text {
            anchors.right: parent.right
            anchors.rightMargin: 32
            y: 17
            text: "PASSENGER VIEW  /  SIMULATED MOTION"
            color: "#adbfca"
            font.pixelSize: 13
            font.letterSpacing: 1
        }
        Rectangle {
            y: 96
            width: parent.width
            height: 4
            color: "#2a414d"
        }
        Rectangle {
            y: 96
            width: parent.width * scene.seconds / scene.duration
            height: 4
            color: scene.mint
        }
    }
    Text {
        x: 28
        y: 753
        width: 180
        wrapMode: Text.WordWrap
        text: "Phone senses.\nBubbles respond."
        color: "#aac4d0"
        font.pixelSize: 16
        lineHeight: 1.2
    }
}
