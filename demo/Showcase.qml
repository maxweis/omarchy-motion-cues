import QtQuick
import "../src/MotionModel.js" as Motion
import "../src" as MotionCues

// Public demo backdrop, not an additional plugin interface. The bubble components
// and motion model are copied unchanged from the runtime by render-demo.sh.
Rectangle {
    id: root
    width: 1280
    height: 800
    color: "#111b24"
    property bool desktopExample: false
    property real seconds: 0
    property var motion: Motion.initial()
    readonly property int stage: seconds < 1.5 ? 0 : seconds < 5 ? 1 : seconds < 8.5 ? 2 : seconds < 10.5 ? 3 : 4
    readonly property var titles: ["Room to focus.", "Follow the turn.", "A change of direction.", "Feel the slowdown.", "Back to stillness."]
    readonly property var notes: ["Quiet bubbles at the edge. Your work stays in the center.", "Continuous flow, soft fades, and fresh bubbles entering.", "The flow reverses. Highlights respond to motion, too.", "Stronger motion brings more bubbles into view.", "Extra bubbles fade away. Animation stops at rest."]

    function advance(value) {
        seconds = value;
        var x = stage === 1 ? 2.8 : stage === 2 ? -2.8 : 0;
        var y = stage === 3 ? -4.5 : 0;
        motion = Motion.step(motion, {
            x: x,
            y: y,
            z: 0,
            t: value,
            session: "showcase"
        }, {
            mount: "flat",
            sensitivity: 1
        });
        field.advance(1 / 30);
    }

    Item {
        anchors.fill: parent
        visible: !root.desktopExample
        Rectangle {
            x: 160
            y: 96
            width: 960
            height: 1
            color: "#35424c"
        }
        Text {
            x: 160
            y: 52
            text: "MOTION CUES"
            color: "#d8bc87"
            font.family: "sans-serif"
            font.pixelSize: 18
            font.letterSpacing: 4
        }
        Text {
            anchors.right: parent.right
            anchors.rightMargin: 160
            y: 54
            text: "AN OMARCHY PLUGIN"
            color: "#8a9ba9"
            font.pixelSize: 13
            font.letterSpacing: 2
        }

        Column {
            x: 180
            y: 236
            width: 920
            spacing: 24
            Text {
                text: ["01 / AT REST", "02 / CORNERING", "03 / REVERSING", "04 / BRAKING", "05 / SETTLING"][root.stage]
                color: "#d8bc87"
                font.pixelSize: 15
                font.letterSpacing: 3
            }
            Text {
                text: root.titles[root.stage]
                color: "#f1eee6"
                font.pixelSize: 54
                font.weight: Font.DemiBold
            }
            Text {
                text: root.notes[root.stage]
                color: "#a8bac7"
                font.pixelSize: 22
                width: parent.width
                wrapMode: Text.WordWrap
            }
            Row {
                spacing: 12
                Repeater {
                    model: ["Phone-driven", "Click-through", "Center stays clear"]
                    Rectangle {
                        required property string modelData
                        width: tag.implicitWidth + 30
                        height: 38
                        radius: 19
                        color: "#1b2c38"
                        border.color: "#334956"
                        Text {
                            id: tag
                            anchors.centerIn: parent
                            text: modelData
                            color: "#c5d8e3"
                            font.pixelSize: 15
                        }
                    }
                }
            }
        }

        Rectangle {
            x: 180
            y: 606
            width: 920
            height: 76
            radius: 12
            color: "#172631"
            Text {
                x: 24
                y: 17
                text: "GyrOSC on iPhone"
                color: "#dce8ec"
                font.pixelSize: 17
            }
            Text {
                x: 24
                y: 43
                text: "Background mode on  /  30 Hz updates"
                color: "#8fa6b5"
                font.pixelSize: 14
            }
            Text {
                anchors.right: parent.right
                anchors.rightMargin: 24
                anchors.verticalCenter: parent.verticalCenter
                text: "phyphox supported on iPhone + Android"
                color: "#a8bac7"
                font.pixelSize: 15
            }
        }
        Text {
            x: 180
            y: 717
            text: "Actual plugin renderer  /  Simulated motion  /  Passenger use only"
            color: "#7f95a3"
            font.pixelSize: 14
        }
        Rectangle {
            x: 180
            y: 751
            width: 920
            height: 2
            color: "#2c3e4a"
        }
        Rectangle {
            x: 180
            y: 751
            width: 920 * Math.min(1, root.seconds / 14)
            height: 2
            color: "#d8bc87"
        }
    }

    ExampleDesktop {
        anchors.fill: parent
        visible: root.desktopExample
        stage: root.stage
    }

    MotionCues.BubbleField {
        id: field
        anchors.fill: parent
        // The export timer advances the actual flow model at a fixed cadence.
        active: false
        randomSeed: 72519
        bubbleSize: 26
        velocityX: root.motion.velocityX
        velocityY: root.motion.velocityY
        intensity: root.motion.intensity
        reflectionX: root.motion.reflectionX
        reflectionY: root.motion.reflectionY
        reflectionDepth: root.motion.reflectionDepth
    }
}
