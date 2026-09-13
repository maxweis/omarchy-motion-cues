// Demonstration kinematics only. Positive lateral acceleration turns right.
// The phone, steering wheel, camera heading and road all use this same state.
var rate = 120;
var wheelbase = 2.7;
var steeringRatio = 15;

function lateral(base) {
    var start = base.x > 0 ? 7 : 12;
    var end = start + 3;
    var edge = Math.max(0, Math.min(1, (base.seconds - start) / 0.45,
                                  (end - base.seconds) / 0.45));
    return base.x * (0.5 - 0.5 * Math.cos(Math.PI * edge));
}

function build(source, duration) {
    var frames = [], road = [{ distance: 0, worldX: 0, worldZ: 0, heading: 0 }];
    var heading = 0, worldX = 0, worldZ = 0, previousDistance = 0, previousYaw = 0;
    for (var i = 0; i <= duration * rate; i++) {
        var base = source(i / rate);
        var acceleration = lateral(base);
        var curvature = base.speed > 0.1 ? acceleration / (base.speed * base.speed) : 0;
        var yawRate = curvature * base.speed;
        var nextHeading = heading + (i ? (yawRate + previousYaw) / (2 * rate) : 0);
        var delta = base.distance - previousDistance;
        worldX += Math.sin((heading + nextHeading) / 2) * delta;
        worldZ += Math.cos((heading + nextHeading) / 2) * delta;
        heading = nextHeading;
        base.x = acceleration;
        base.curvature = curvature;
        base.yawRate = yawRate;
        base.steeringDegrees = Math.atan(wheelbase * curvature) * steeringRatio * 180 / Math.PI;
        base.heading = heading;
        base.worldX = worldX;
        base.worldZ = worldZ;
        frames.push(base);
        if (delta > 0) road.push(base);
        previousDistance = base.distance;
        previousYaw = yawRate;
    }
    return { frames: frames, road: road, duration: duration };
}

function sample(journey, seconds) {
    var index = Math.max(0, Math.min(journey.frames.length - 1, Math.round(seconds * rate)));
    return journey.frames[index];
}

function roadAt(journey, distance) {
    var points = journey.road;
    var last = points[points.length - 1];
    if (distance >= last.distance) {
        var beyond = distance - last.distance;
        return { worldX: last.worldX + Math.sin(last.heading) * beyond,
                 worldZ: last.worldZ + Math.cos(last.heading) * beyond, heading: last.heading };
    }
    if (distance <= 0) return { worldX: 0, worldZ: distance, heading: 0 };
    var lo = 0, hi = points.length - 1;
    while (hi - lo > 1) {
        var mid = Math.floor((lo + hi) / 2);
        if (points[mid].distance <= distance) lo = mid;
        else hi = mid;
    }
    var a = points[lo], b = points[hi];
    var fraction = (distance - a.distance) / (b.distance - a.distance);
    return { worldX: a.worldX + (b.worldX - a.worldX) * fraction,
             worldZ: a.worldZ + (b.worldZ - a.worldZ) * fraction,
             heading: a.heading + (b.heading - a.heading) * fraction };
}

function relative(journey, car, distance) {
    var point = roadAt(journey, distance);
    var dx = point.worldX - car.worldX, dz = point.worldZ - car.worldZ;
    return { x: dx * Math.cos(car.heading) - dz * Math.sin(car.heading),
             z: dx * Math.sin(car.heading) + dz * Math.cos(car.heading),
             heading: point.heading - car.heading };
}

function roadAtDepth(journey, car, depth) {
    var distance = car.distance + depth;
    var point;
    for (var i = 0; i < 5; i++) {
        point = relative(journey, car, distance);
        distance += (depth - point.z) / Math.max(0.3, Math.cos(point.heading));
    }
    point = relative(journey, car, distance);
    point.distance = distance;
    return point;
}

if (typeof module !== "undefined") module.exports = { build, sample, roadAt, relative, roadAtDepth,
    rate, wheelbase, steeringRatio };
