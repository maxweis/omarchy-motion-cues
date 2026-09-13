// One simulation clock drives the road, speedometer, phone, and real cue model.
// Distances are metres; speed is m/s; acceleration is m/s^2.
var duration = 20;
var phases = [
    { end: 2, name: "Stopped", cue: "Bubbles stay still", direction: "", x: 0, y: 0 },
    { end: 5, name: "Speeding up", cue: "Bubbles drift down", direction: "down", x: 0, y: 3 },
    { end: 7, name: "Steady speed", cue: "Bubbles settle", direction: "", x: 0, y: 0 },
    { end: 10, name: "Turning right", cue: "Bubbles drift left", direction: "left", x: 2.6, y: 0 },
    { end: 12, name: "Steady speed", cue: "Bubbles settle", direction: "", x: 0, y: 0 },
    { end: 15, name: "Turning left", cue: "Bubbles drift right", direction: "right", x: -2.6, y: 0 },
    { end: 18, name: "Braking", cue: "Bubbles drift up", direction: "up", x: 0, y: -3 },
    { end: duration, name: "Stopped", cue: "Bubbles settle", direction: "", x: 0, y: 0 }
];

function sample(seconds) {
    var t = Math.max(0, Math.min(duration, seconds));
    var start = 0, speed = 0, distance = 0;
    for (var i = 0; i < phases.length; i++) {
        var phase = phases[i];
        var elapsed = Math.max(0, Math.min(t, phase.end) - start);
        distance += speed * elapsed + phase.y * elapsed * elapsed / 2;
        speed += phase.y * elapsed;
        if (t < phase.end || i === phases.length - 1) {
            return { phase: i, name: phase.name, cue: phase.cue,
                direction: phase.direction, x: phase.x, y: phase.y,
                speed: speed, distance: distance, seconds: t };
        }
        start = phase.end;
    }
}

if (typeof module !== "undefined") module.exports = { duration, phases, sample };
