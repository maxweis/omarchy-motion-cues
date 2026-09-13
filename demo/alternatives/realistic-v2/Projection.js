// Rectangle-to-quadrilateral transform, so the live interfaces fit photographed
// displays without repainting the device bezels or changing the runtime cues.
function transform(width, height, points) {
    var p0=points[0], p1=points[1], p2=points[2], p3=points[3];
    var dx1=p1[0]-p2[0], dx2=p3[0]-p2[0], dx3=p0[0]-p1[0]+p2[0]-p3[0];
    var dy1=p1[1]-p2[1], dy2=p3[1]-p2[1], dy3=p0[1]-p1[1]+p2[1]-p3[1];
    var determinant=dx1*dy2-dx2*dy1;
    var g=(dx3*dy2-dx2*dy3)/determinant;
    var h=(dx1*dy3-dx3*dy1)/determinant;
    return [
        (p1[0]-p0[0]+g*p1[0])/width, (p3[0]-p0[0]+h*p3[0])/height, 0, p0[0],
        (p1[1]-p0[1]+g*p1[1])/width, (p3[1]-p0[1]+h*p3[1])/height, 0, p0[1],
        0, 0, 1, 0,
        g/width, h/height, 0, 1
    ];
}
if (typeof module !== "undefined") module.exports = { transform };
