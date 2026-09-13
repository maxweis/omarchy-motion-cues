const test = require('node:test');
const assert = require('node:assert/strict');
const Drive = require('../demo/DriveSequence.js');
const Motion = require('../src/MotionModel.js');

test('car demonstration covers acceleration, coasting, both turns, braking, and a stop', () => {
    assert.equal(Drive.duration, 20);
    for (const [time, name, direction] of [
        [0, 'Stopped', ''], [3, 'Speeding up', 'down'], [6, 'Steady speed', ''],
        [8, 'Turning right', 'left'], [11, 'Steady speed', ''],
        [13, 'Turning left', 'right'], [16, 'Braking', 'up'], [19, 'Stopped', ''],
    ]) {
        const value = Drive.sample(time);
        assert.equal(value.name, name);
        assert.equal(value.direction, direction);
    }
    assert.equal(Drive.sample(-1).seconds, 0);
    assert.equal(Drive.sample(25).seconds, Drive.duration);
});

test('road distance and speed agree with the acceleration shown on the phone', () => {
    const dt = 0.0001;
    let previousDistance = 0;
    for (let t = 0.05; t < Drive.duration; t += 0.1) {
        const now = Drive.sample(t), next = Drive.sample(t + dt);
        assert.ok(now.speed >= 0);
        assert.ok(now.distance >= previousDistance);
        assert.ok(Math.abs((next.speed - now.speed)/dt - now.y) < 0.001);
        assert.ok(Math.abs((next.distance - now.distance)/dt - now.speed) < 0.001);
        previousDistance = now.distance;
    }
    assert.equal(Drive.sample(19).speed, 0);
    assert.ok(Drive.sample(6).speed > 0, 'scenery keeps moving while cues settle');
    assert.equal(Drive.sample(6).y, 0);
});

test('caption directions match the actual plugin response to simulated phone readings', () => {
    let motion = Motion.initial();
    for (let frame = 0; frame < Drive.duration*30; frame++) {
        const seconds = frame/30;
        const drive = Drive.sample(seconds);
        motion = Motion.step(motion, {...drive, z: 0, t: seconds, session: 'test'}, {mount: 'flat', sensitivity: 1});
        if ([120, 255, 405, 510].includes(frame)) {
            if (drive.direction === 'down') assert.ok(motion.velocityY > 100);
            if (drive.direction === 'up') assert.ok(motion.velocityY < -100);
            if (drive.direction === 'left') assert.ok(motion.velocityX < -100);
            if (drive.direction === 'right') assert.ok(motion.velocityX > 100);
            assert.ok(motion.intensity > 2, 'stronger movement adds bubbles');
        }
    }
    assert.equal(motion.velocityX, 0);
    assert.equal(motion.velocityY, 0);
    assert.ok(motion.fresh, 'stationary readings still stream wirelessly');
});
