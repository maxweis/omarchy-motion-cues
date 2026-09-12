import QtQuick

Rectangle {
    id: bubble
    property real reflectionX: 0
    property real reflectionY: 0
    property real reflectionDepth: 0

    // Move an elliptical specular highlight around the inside of the bubble.
    // Bound its center radially so even extreme acceleration cannot detach it.
    readonly property real lightX: -0.18 + reflectionX * 0.36
    readonly property real lightY: -0.20 + reflectionY * 0.36
    readonly property real lightScale: Math.max(1, Math.sqrt(lightX * lightX + lightY * lightY) / 0.32)
    readonly property real glintX: 0.5 + lightX / lightScale
    readonly property real glintY: 0.5 + lightY / lightScale
    readonly property real glintAngle: Math.atan2(lightY, lightX) * 180 / Math.PI + 90

    height: width
    radius: width / 2
    color: "#70d9ecf4"
    border.color: "#c0f0faff"
    border.width: 1.4

    Rectangle {
        anchors.fill: parent
        anchors.margins: -1
        radius: width / 2
        color: "transparent"
        border.width: 1
        border.color: "#80304450"
    }

    Rectangle {
        x: bubble.width * bubble.glintX - width / 2
        y: bubble.height * bubble.glintY - height / 2
        width: bubble.width * 0.29
        height: bubble.height * 0.17
        radius: height / 2
        rotation: bubble.glintAngle
        color: "white"
        opacity: 0.76 + bubble.reflectionDepth * 0.16
    }

    // A dimmer counter-reflection makes the changing direction easier to see.
    Rectangle {
        x: bubble.width * (1 - bubble.glintX) - width / 2
        y: bubble.height * (1 - bubble.glintY) - height / 2
        width: bubble.width * 0.20
        height: bubble.height * 0.07
        radius: height / 2
        rotation: bubble.glintAngle
        color: "#bcecff"
        opacity: 0.38 - bubble.reflectionDepth * 0.10
    }
}
