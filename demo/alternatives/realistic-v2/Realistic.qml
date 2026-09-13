import QtQuick
import "../.." as Demo
import "../../DriveSequence.js" as Drive
import "VehicleMotion.js" as Vehicle
import "../../../src/MotionModel.js" as Motion
import "../../../src" as MotionCues

Rectangle {
    id: scene
    width: 1280
    height: 800
    color: "#0c1925"
    readonly property real duration: Drive.duration
    readonly property string plate: Qt.resolvedUrl("cabin-linux.png").toString()
    readonly property var journey: Vehicle.build(Drive.sample, Drive.duration)
    readonly property bool renderReady: exterior.ready && cabinImage.status === Image.Ready && wheelImage.status === Image.Ready
    property real seconds: 0
    property var drive: Vehicle.sample(journey, 0)
    property var motion: Motion.initial()

    function advance(value) {
        seconds = value;
        drive = Vehicle.sample(journey, value);
        motion = Motion.step(motion, {
            x: drive.x,
            y: drive.y,
            z: 0,
            t: value,
            session: "realistic-demo"
        }, {
            mount: "flat",
            sensitivity: 1
        });
        field.advance(1 / 30);
        exterior.requestPaint();
        wave.requestPaint();
        wireless.requestPaint();
    }
    function signed(value) {
        return (value > 0 ? "+" : "") + value.toFixed(1);
    }

    Image {
        id: cabinImage
        anchors.fill: parent
        source: scene.plate
        fillMode: Image.Stretch
    }

    Windshield {
        id: exterior
        anchors.fill: parent
        journey: scene.journey
        car: scene.drive
    }

    DisplayPlane {
        width: 500
        height: 500
        corners: [[-170, 335], [188, 353], [191, 873], [-177, 877]]
        Image {
            id: wheelImage
            anchors.fill: parent
            source: "wheel.png"
            smooth: true
            rotation: scene.drive.steeringDegrees
            transformOrigin: Item.Center
        }
    }

    DisplayPlane {
        id: screen
        width: 720
        height: 400
        corners: [[527, 279], [1166, 279], [1177, 604], [519, 601]]
        clip: true
        Rectangle {
            anchors.fill: parent
            color: "#12212c"
        }
        Demo.ExampleDesktop {
            width: 1280
            height: 800
            transform: Scale {
                xScale: screen.width / 1280
                yScale: screen.height / 800
            }
            phaseTitle: "Motion cues enabled"
            phaseDescription: "Wireless phone readings drive the bubbles. Your work stays in the center."
        }
        MotionCues.BubbleField {
            id: field
            anchors.fill: parent
            active: false
            randomSeed: 72519
            bubbleSize: 26
            velocityX: scene.motion.velocityX
            velocityY: scene.motion.velocityY
            intensity: scene.motion.intensity
            reflectionX: scene.motion.reflectionX
            reflectionY: scene.motion.reflectionY
            reflectionDepth: scene.motion.reflectionDepth
        }
        // A restrained warm glass tint matches the natural cabin light.
        Rectangle {
            anchors.fill: parent
            color: "#06ffeed9"
        }
    }

    DisplayPlane {
        width: 184
        height: 342
        corners: [[258, 446], [409, 446], [399, 732], [242, 732]]
        Rectangle {
            anchors.fill: parent
            color: "#10252f"
            radius: 18
        }
        Rectangle {
            x: 53
            y: 0
            width: 78
            height: 13
            radius: 5
            color: "#050d14"
        }
        Text {
            x: 16
            y: 31
            text: "MOTION SENSOR"
            color: "#ecd1a3"
            font.pixelSize: 16
            font.weight: Font.DemiBold
        }
        Text {
            x: 16
            y: 59
            text: "Accelerometer"
            color: "#f3f4ed"
            font.pixelSize: 20
        }
        Text {
            x: 16
            y: 91
            text: "●  Live · 30 Hz"
            color: "#a4e2d3"
            font.pixelSize: 16
        }
        Canvas {
            id: wave
            x: 16
            y: 129
            width: 150
            height: 66
            onPaint: {
                var c = getContext("2d");
                c.reset();
                c.strokeStyle = "#38535e";
                c.lineWidth = 1;
                c.beginPath();
                c.moveTo(0, 33);
                c.lineTo(width, 33);
                c.stroke();
                for (var axis = 0; axis < 2; axis++) {
                    c.strokeStyle = axis === 0 ? "#a4e2d3" : "#ecd1a3";
                    c.lineWidth = 2;
                    c.beginPath();
                    for (var i = 0; i <= width; i++) {
                        var data = Vehicle.sample(scene.journey, Math.max(0, scene.seconds - 2 + i / width * 2));
                        var y = 33 - (axis === 0 ? data.x : data.y) * 8;
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
            x: 16
            y: 219
            text: "Sideways"
            color: "#a4e2d3"
            font.pixelSize: 16
        }
        Text {
            x: 125
            y: 219
            text: scene.signed(scene.drive.x)
            color: "#a4e2d3"
            font.pixelSize: 17
            font.family: "monospace"
        }
        Text {
            x: 16
            y: 253
            text: "Forward"
            color: "#ecd1a3"
            font.pixelSize: 16
        }
        Text {
            x: 125
            y: 253
            text: scene.signed(scene.drive.y)
            color: "#ecd1a3"
            font.pixelSize: 17
            font.family: "monospace"
        }
        Text {
            x: 16
            y: 296
            text: "m/s² · local Wi-Fi"
            color: "#b7ccd4"
            font.pixelSize: 15
        }
        Rectangle {
            x: 65
            y: 329
            width: 53
            height: 4
            radius: 2
            color: "#879ca6"
        }
    }

    Canvas {
        id: wireless
        x: 328
        y: 362
        width: 220
        height: 107
        onPaint: {
            var c = getContext("2d");
            c.reset();
            c.lineWidth = 2;
            c.strokeStyle = "#91baad";
            c.beginPath();
            c.moveTo(0, 96);
            c.bezierCurveTo(36, 28, 131, 27, 207, 49);
            c.stroke();
            for (var i = 0; i < 3; i++) {
                var p = (scene.seconds * 1.05 + i / 3) % 1, q = 1 - p;
                var x = 3 * q * q * p * 36 + 3 * q * p * p * 131 + p * p * p * 207;
                var y = q * q * q * 96 + 3 * q * q * p * 28 + 3 * q * p * p * 27 + p * p * p * 49;
                c.fillStyle = "#d0f8e8";
                c.beginPath();
                c.arc(x, y, 3.5, 0, Math.PI * 2);
                c.fill();
            }
            c.strokeStyle = "#d0f8e8";
            c.lineWidth = 2.5;
            c.beginPath();
            c.moveTo(197, 40);
            c.lineTo(207, 49);
            c.lineTo(193, 53);
            c.stroke();
        }
    }
    Rectangle {
        x: 365
        y: 345
        width: 159
        height: 54
        radius: 10
        color: "#eb122832"
        border.color: "#779c99"
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            y: 7
            text: "WIRELESS"
            color: "#b9eddb"
            font.pixelSize: 15
            font.weight: Font.DemiBold
            font.letterSpacing: 1
        }
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            y: 29
            text: "acceleration data"
            color: "#e0e9e9"
            font.pixelSize: 14
        }
    }

    // Explanatory labels, intentionally outside the photographed device UIs.
    Rectangle {
        width: parent.width
        height: 90
        color: "#101d29"
        Text {
            x: 30
            y: 13
            text: "MOTION CUES"
            color: "#ecd1a3"
            font.pixelSize: 15
            font.letterSpacing: 3
        }
        Text {
            x: 30
            y: 40
            text: "Car: " + scene.drive.name.toLowerCase()
            color: "#f5f3ec"
            font.pixelSize: 29
            font.weight: Font.DemiBold
        }
        Text {
            x: 544
            y: 42
            text: scene.drive.cue
            color: "#b7edda"
            font.pixelSize: 27
            font.weight: Font.Medium
        }
        Text {
            x: 1049
            y: 33
            text: ({
                    down: "↓",
                    up: "↑",
                    left: "←",
                    right: "→"
                })[scene.drive.direction] || "·"
            color: "#b7edda"
            font.pixelSize: 42
        }
        Text {
            anchors.right: parent.right
            anchors.rightMargin: 30
            y: 14
            text: "AI-GENERATED SETTING · SIMULATED MOTION"
            color: "#b3c0c8"
            font.pixelSize: 12
            font.letterSpacing: 0.6
        }
        Rectangle {
            y: 87
            width: parent.width
            height: 3
            color: "#344c55"
        }
        Rectangle {
            y: 87
            width: parent.width * scene.seconds / scene.duration
            height: 3
            color: "#b7edda"
        }
    }
    Rectangle {
        x: 49
        y: 736
        width: 164
        height: 40
        radius: 9
        color: "#db10212b"
        Text {
            anchors.centerIn: parent
            text: "PASSENGER USE ONLY"
            color: "#ebebe1"
            font.pixelSize: 12
            font.letterSpacing: 0.4
        }
    }
}
