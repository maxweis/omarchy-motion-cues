import QtQuick

// An illustrative desktop, authored entirely for the public demo. No real user
// windows, files, accounts, wallpaper or notifications are captured.
Rectangle {
    id: desktop
    color: "#17212b"
    property int stage: 0
    readonly property var phases: ["At rest", "Turning", "Changing direction", "Braking", "Settling"]

    Rectangle {
        x: 50
        y: 84
        width: 1180
        height: 650
        radius: 36
        color: "#1a2935"
        rotation: -5
    }
    Rectangle {
        x: 335
        y: 245
        width: 770
        height: 425
        radius: 32
        color: "#1d303d"
        rotation: 13
    }

    // Example bar, with no clock, account or network information from the host.
    Rectangle {
        width: parent.width
        height: 36
        color: "#10181f"
        Row {
            x: 20
            anchors.verticalCenter: parent.verticalCenter
            spacing: 24
            Text {
                text: "◈"
                color: "#e4c58b"
                font.pixelSize: 21
            }
            Repeater {
                model: ["1", "2", "3", "4"]
                Text {
                    required property int index
                    required property string modelData
                    text: modelData
                    color: index === 0 ? "#e4c58b" : "#778b99"
                    font.pixelSize: 15
                }
            }
            Text {
                text: "Notes"
                color: "#adc0cc"
                font.pixelSize: 14
            }
        }
        Text {
            anchors.centerIn: parent
            text: "Example desktop"
            color: "#99afbe"
            font.pixelSize: 13
        }
        Text {
            anchors.right: parent.right
            anchors.rightMargin: 24
            anchors.verticalCenter: parent.verticalCenter
            text: "Wi-Fi     Balanced     84%"
            color: "#b5c8d4"
            font.pixelSize: 13
        }
    }

    // A reading window provides a realistic, uninterrupted central work area.
    Rectangle {
        id: notes
        x: 55
        y: 76
        width: 728
        height: 642
        radius: 12
        color: "#121c24"
        border.color: "#809caa"
        border.width: 1
        Rectangle {
            x: 1
            y: 1
            width: parent.width - 2
            height: 42
            radius: 11
            color: "#253644"
            Text {
                x: 18
                anchors.verticalCenter: parent.verticalCenter
                text: "Notes  /  A quieter journey"
                color: "#d5e0e7"
                font.pixelSize: 14
            }
            Text {
                anchors.right: parent.right
                anchors.rightMargin: 17
                anchors.verticalCenter: parent.verticalCenter
                text: "−   □   ×"
                color: "#9cb0be"
                font.pixelSize: 15
            }
        }
        Rectangle {
            x: 1
            y: 44
            width: 146
            height: parent.height - 45
            color: "#182630"
            Column {
                x: 17
                y: 24
                spacing: 25
                Text {
                    text: "NOTEBOOK"
                    font.pixelSize: 11
                    font.letterSpacing: 2
                    color: "#728d9e"
                }
                Text {
                    text: "Overview"
                    font.pixelSize: 14
                    color: "#d9bd87"
                }
                Text {
                    text: "Ideas"
                    font.pixelSize: 14
                    color: "#9bafbc"
                }
                Text {
                    text: "Reading list"
                    font.pixelSize: 14
                    color: "#9bafbc"
                }
                Text {
                    text: "Travel notes"
                    font.pixelSize: 14
                    color: "#9bafbc"
                }
            }
        }
        Column {
            x: 179
            y: 79
            width: 510
            spacing: 23
            Text {
                text: "ON THE MOVE"
                color: "#d9bd87"
                font.pixelSize: 12
                font.letterSpacing: 3
            }
            Text {
                text: "A quieter journey"
                color: "#edf0ec"
                font.pixelSize: 33
                font.weight: Font.DemiBold
            }
            Text {
                width: parent.width
                wrapMode: Text.WordWrap
                lineHeight: 1.35
                text: "A few notes, a little reading, and room to think. The center of the screen stays yours."
                color: "#b1c2ce"
                font.pixelSize: 18
            }
            Rectangle {
                width: parent.width
                height: 1
                color: "#2e4351"
            }
            Text {
                text: "For the ride"
                color: "#dbe5eb"
                font.pixelSize: 21
                font.weight: Font.Medium
            }
            Repeater {
                model: ["Read the next chapter", "Sketch a small idea", "Save a note for later"]
                Row {
                    required property string modelData
                    spacing: 13
                    Rectangle {
                        width: 15
                        height: 15
                        y: 2
                        radius: 3
                        color: "transparent"
                        border.color: "#718c9d"
                    }
                    Text {
                        text: modelData
                        color: "#a7bccb"
                        font.pixelSize: 17
                    }
                }
            }
            Rectangle {
                width: parent.width
                height: 69
                radius: 8
                color: "#203441"
                Text {
                    anchors.fill: parent
                    anchors.margins: 15
                    wrapMode: Text.WordWrap
                    text: "Motion cues live at the edges, without blocking clicks or taking keyboard focus."
                    color: "#bdd3df"
                    font.pixelSize: 15
                }
            }
        }
    }

    Rectangle {
        x: 803
        y: 76
        width: 422
        height: 287
        radius: 12
        color: "#0e1820"
        border.color: "#3e5768"
        Rectangle {
            x: 1
            y: 1
            width: parent.width - 2
            height: 42
            radius: 11
            color: "#243540"
            Text {
                x: 18
                anchors.verticalCenter: parent.verticalCenter
                text: "Terminal"
                color: "#d5e0e7"
                font.pixelSize: 14
            }
            Text {
                anchors.right: parent.right
                anchors.rightMargin: 17
                anchors.verticalCenter: parent.verticalCenter
                text: "−   □   ×"
                color: "#9cb0be"
                font.pixelSize: 15
            }
        }
        Column {
            x: 24
            y: 66
            spacing: 13
            Text {
                text: "$ cat demo-session.txt"
                color: "#d9bd87"
                font.family: "monospace"
                font.pixelSize: 15
            }
            Text {
                text: "●  Receiving motion"
                color: "#9bc9a4"
                font.family: "monospace"
                font.pixelSize: 15
            }
            Text {
                text: "App         GyrOSC"
                color: "#b7c9d4"
                font.family: "monospace"
                font.pixelSize: 15
            }
            Text {
                text: "Phone rate  30 Hz"
                color: "#b7c9d4"
                font.family: "monospace"
                font.pixelSize: 15
            }
            Text {
                text: "Background  enabled on phone"
                color: "#b7c9d4"
                font.family: "monospace"
                font.pixelSize: 15
            }
            Text {
                text: "$ ▌"
                color: "#d9bd87"
                font.family: "monospace"
                font.pixelSize: 15
            }
        }
    }

    Rectangle {
        x: 803
        y: 383
        width: 422
        height: 335
        radius: 12
        color: "#152630"
        border.color: "#3e5768"
        Column {
            x: 28
            y: 28
            width: 360
            spacing: 19
            Text {
                text: "MOTION CUES"
                color: "#d9bd87"
                font.pixelSize: 13
                font.letterSpacing: 3
            }
            Text {
                text: desktop.phases[desktop.stage]
                color: "#e2ecf0"
                font.pixelSize: 33
                font.weight: Font.DemiBold
            }
            Text {
                text: ["Twelve quiet bubbles. No animation at rest.", "Bubbles flow through a sustained turn, fading as they leave.", "Movement reverses, and the highlights follow.", "More bubbles appear during stronger acceleration.", "Extra bubbles fade. The movement comes to rest."][desktop.stage]
                width: parent.width
                wrapMode: Text.WordWrap
                lineHeight: 1.25
                color: "#a7bfcd"
                font.pixelSize: 18
            }
            Text {
                text: "Click-through  ·  No keyboard capture"
                color: "#c8dce7"
                font.pixelSize: 15
            }
            Text {
                text: "Illustrative apps / actual bubble renderer"
                color: "#7e9baa"
                font.pixelSize: 13
            }
        }
    }
    Text {
        anchors.horizontalCenter: parent.horizontalCenter
        y: 752
        text: "EXAMPLE DESKTOP     /     SIMULATED MOTION     /     PASSENGER USE ONLY"
        color: "#9db2c0"
        font.pixelSize: 12
        font.letterSpacing: 1.5
    }
}
