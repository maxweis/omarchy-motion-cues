const test = require('node:test');
const assert = require('node:assert/strict');
const Drive = require('../../DriveSequence.js');
const Vehicle = require('./VehicleMotion.js');
const journey = Vehicle.build(Drive.sample, Drive.duration);

test('steering and road yaw follow the phone acceleration, without independent animation', () => {
  for (const frame of journey.frames) {
    assert.equal(Math.sign(frame.steeringDegrees), Math.sign(frame.x));
    assert.equal(Math.sign(frame.yawRate), Math.sign(frame.x));
    assert.ok(Math.abs(frame.x - frame.speed * frame.yawRate) < 1e-10);
    assert.ok(Math.abs(Math.tan(frame.steeringDegrees * Math.PI / 180 / Vehicle.steeringRatio)
      - Vehicle.wheelbase * frame.curvature) < 1e-10);
  }
  assert.ok(Vehicle.sample(journey, 8).steeringDegrees > 60);
  assert.ok(Vehicle.sample(journey, 13).steeringDegrees < -60);
  assert.equal(Vehicle.sample(journey, 11).steeringDegrees, 0);
});

test('forward motion accelerates, cruises, brakes and stops with the common drive sequence', () => {
  for (let i = 1; i < journey.frames.length; i++) {
    const a = journey.frames[i - 1], b = journey.frames[i];
    assert.equal(b.distance, Drive.sample(b.seconds).distance);
    assert.equal(b.speed, Drive.sample(b.seconds).speed);
    assert.ok(Math.abs(Math.hypot(b.worldX - a.worldX, b.worldZ - a.worldZ)
      - (b.distance - a.distance)) < 1e-10);
  }
  assert.equal(Vehicle.sample(journey, 18).speed, 0);
  assert.equal(Vehicle.sample(journey, 18).distance, Vehicle.sample(journey, 20).distance);
  assert.equal(Vehicle.sample(journey, 18).worldX, Vehicle.sample(journey, 20).worldX);
  assert.equal(Vehicle.sample(journey, 18).heading, Vehicle.sample(journey, 20).heading);
  assert.ok(Math.abs(Vehicle.sample(journey, 20).heading) < 1e-10);
});

test('road remains on the vehicle trajectory and its perspective has no discontinuous pan', () => {
  for (let t = 0; t <= 20; t += 0.25) {
    const car = Vehicle.sample(journey, t);
    const center = Vehicle.relative(journey, car, car.distance);
    assert.ok(Math.abs(center.x) < 1e-9 && Math.abs(center.z) < 1e-9);
    for (const depth of [7, 15, 40, 100, 500]) {
      const point = Vehicle.roadAtDepth(journey, car, depth);
      assert.ok(Number.isFinite(point.x));
      assert.ok(Math.abs(point.z - depth) < 0.01);
    }
  }
});
