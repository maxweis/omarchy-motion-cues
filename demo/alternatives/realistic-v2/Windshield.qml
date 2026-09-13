import QtQuick
import "VehicleMotion.js" as Vehicle

// Perspective ground flow, road curvature and panorama yaw are generated from
// one integrated vehicle trajectory. No independent zoom or side-to-side loop.
Canvas {
    id: outside
    property bool ready: false
    required property var journey
    required property var car
    readonly property string ground: Qt.resolvedUrl("ground.png").toString()
    readonly property string panorama: Qt.resolvedUrl("panorama.png").toString()
    readonly property real horizon: 241
    readonly property real focal: 500
    readonly property real cameraHeight: 1.3
    readonly property real cameraOffset: 0.9
    readonly property real vanishingX: 430

    Component.onCompleted: {
        loadImage(panorama);
        loadImage(ground);
    }
    onImageLoaded: requestPaint()
    onCarChanged: requestPaint()

    onPaint: {
        var c = getContext("2d");
        c.reset();
        if (!isImageLoaded(panorama) || !isImageLoaded(ground))
            return;
        c.save();
        c.beginPath();
        c.moveTo(0, 90);
        c.lineTo(1253, 90);
        c.lineTo(1176, 249);
        c.lineTo(508, 249);
        c.lineTo(508, 326);
        c.lineTo(164, 328);
        c.lineTo(0, 317);
        c.closePath();
        // Counter-wound hole keeps the actual mirror fixed above the road.
        c.moveTo(458, 90);
        c.lineTo(462, 111);
        c.lineTo(474, 118);
        c.lineTo(640, 118);
        c.lineTo(654, 111);
        c.lineTo(660, 90);
        c.closePath();
        c.clip();

        // Distant scenery rotates opposite the car's integrated heading.
        // The panorama contains no cabin trim, so no pillar or mirror can
        // accidentally move with the landscape. Overscan covers the full turn.
        var pan = -car.heading * 300;
        c.drawImage(panorama, -180 + pan, -8, 1800, 300);

        var textureSize = 1254;
        for (var y = horizon + 1; y < 335; y++) {
            var depth = cameraHeight * focal / (y - horizon);
            var point = Vehicle.roadAtDepth(journey, car, depth);
            var scale = focal / depth;
            var center = vanishingX + (point.x - cameraOffset) * scale;
            var span = 31.5 * scale;
            var sourceY = ((point.distance / 35 % 1) + 1) % 1 * (textureSize - 8);
            var band = Math.min(8, Math.max(1, textureSize / 35 * depth / (y - horizon)));
            // Flat meadow continues past the texture's edges without repeating
            // the central road. Only the center tile contains asphalt.
            for (var grass = -2; grass <= 2; grass++)
                c.drawImage(ground, 0, sourceY, 400, band, grass * 640, y, 641, 1.2);
            c.drawImage(ground, 0, sourceY, textureSize, band, center - span / 2, y, span, 1.2);
            // Match the texture's contrast to the hazier distant photograph.
            c.fillStyle = "rgba(184,184,164,0.23)";
            c.fillRect(0, y, width, 1.2);
            c.fillStyle = "#d4d4c9";
            var edgeWidth = Math.max(0.4, scale * 0.10);
            c.fillRect(center - 3.35 * scale, y, edgeWidth, 1.2);
            c.fillRect(center + 3.35 * scale, y, edgeWidth, 1.2);
            if (point.distance % 9 < 3.5)
                c.fillRect(center - edgeWidth / 2, y, edgeWidth, 1.2);
            // Atmospheric blending hides texture detail at the horizon.
            c.fillStyle = "rgba(194,199,180," + Math.max(0, (16 - (y - horizon)) / 20) + ")";
            c.fillRect(0, y, width, 1.2);
        }

        // Physical roadside markers approach according to travelled distance.
        var first = Math.ceil((car.distance + 5) / 14) * 14;
        for (var distance = first + 140; distance >= first; distance -= 14) {
            var post = Vehicle.relative(journey, car, distance);
            if (post.z < 5)
                continue;
            var postScale = focal / post.z;
            var bottom = horizon + cameraHeight * postScale;
            for (var side = -1; side <= 1; side += 2) {
                var postX = vanishingX + (post.x - cameraOffset + side * 4.5) * postScale;
                var postWidth = Math.max(0.7, 0.10 * postScale);
                c.fillStyle = "#ccc8b4";
                c.fillRect(postX, bottom - 0.75 * postScale, postWidth, 0.75 * postScale);
                c.fillStyle = "#333c32";
                c.fillRect(postX, bottom - 0.66 * postScale, postWidth, 0.15 * postScale);
            }
        }
        c.restore();
        ready = true;
    }
}
