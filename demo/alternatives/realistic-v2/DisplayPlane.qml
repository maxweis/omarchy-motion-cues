import QtQuick
import "Projection.js" as Projection

Item {
    id: plane
    required property var corners
    readonly property var m: Projection.transform(width, height, corners)
    transform: Matrix4x4 {
        matrix: Qt.matrix4x4(plane.m[0], plane.m[1], plane.m[2], plane.m[3], plane.m[4], plane.m[5], plane.m[6], plane.m[7], plane.m[8], plane.m[9], plane.m[10], plane.m[11], plane.m[12], plane.m[13], plane.m[14], plane.m[15])
    }
}
