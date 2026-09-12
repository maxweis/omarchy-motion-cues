import QtQuick
import "MotionModel.js" as Motion
import "BubbleFlow.js" as Flow

Item {
    id: field
    property bool active: false
    property real bubbleSize: 26
    property real velocityX: 0
    property real velocityY: 0
    property real intensity: 0
    property real reflectionX: 0
    property real reflectionY: 0
    property real reflectionDepth: 0
    // One random seed per field, not a new random value per animation frame.
    property int randomSeed: Math.floor(Math.random() * 2147483647)
    readonly property var layout: Flow.flowLayout(Math.max(width, 64), Math.max(height, 64), bubbleSize)
    property var particles: []
    readonly property bool moving: velocityX !== 0 || velocityY !== 0
    readonly property bool settled: particles.every(function(p) { return p.opacity === 1; })

    function reset() { particles = Flow.flowInitial(layout, randomSeed); }
    function advance(seconds) {
        if (particles.length !== layout.length) reset();
        particles = Flow.flowStep(particles, layout, velocityX, velocityY, seconds);
    }
    function snapshot() {
        var result = [];
        for (var i = 0; i < bubbles.count; i++) {
            var bubble = bubbles.itemAt(i);
            if (bubble) result.push({ index: i, x: bubble.x, y: bubble.y,
                width: bubble.width, opacity: bubble.opacity, visible: bubble.visible,
                generation: particles[i] ? particles[i].generation : 0,
                speed: particles[i] ? particles[i].speed : 0 });
        }
        return { width: width, height: height, running: frames.running, bubbles: result };
    }
    onLayoutChanged: reset()
    onActiveChanged: { if (!active) reset(); }
    onMovingChanged: { if (!moving) advance(0); }
    Component.onCompleted: reset()

    // Render-paced motion between 20 Hz sensor updates. No animation loop at
    // rest, while disconnected, or when the plugin has no visible surface.
    FrameAnimation {
        id: frames
        running: field.active && (field.moving || !field.settled)
        onTriggered: field.advance(frameTime)
    }

    Repeater {
        id: bubbles
        model: 32
        Bubble {
            required property int index
            readonly property var particle: field.particles[index] || { x: 0, y: 0, opacity: 0, scale: 1 }
            property real densityOpacity: index < 12 ? 1 : Motion.extraOpacity(field.intensity, index - 12)
            width: field.bubbleSize * particle.scale
            x: particle.x - width / 2
            y: particle.y - height / 2
            opacity: densityOpacity * particle.opacity
            visible: opacity > 0.01
            reflectionX: field.reflectionX
            reflectionY: field.reflectionY
            reflectionDepth: field.reflectionDepth
            Behavior on densityOpacity { NumberAnimation { duration: 350; easing.type: Easing.InOutQuad } }
            // No x/y Behavior: recycling must never animate backwards across
            // the strip. FrameAnimation already supplies smooth positions.
        }
    }
}
