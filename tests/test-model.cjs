const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./model.cjs');
const config = M.settings({});
function reading(t, x = 0, y = 0, z = 0) { return {t, x, y, z, session: 'one'}; }
function packet(t = 1) {
    return { status: { measuring: true, session: 'one' }, buffer: Object.fromEntries(
        Object.entries({accX: 1, accY: 2, accZ: 3, acc_time: t}).map(([k, v]) => [k, {buffer: [v]}])) };
}
test('private phone addresses, optional port and loopback test address', () => {
    for (const url of ['http://172.20.10.1', 'http://192.168.1.3:8080', 'http://10.1.2.3', 'http://127.0.0.1:8765'])
        assert.equal(M.localUrl(url), url);
    for (const url of ['https://example.com', 'http://8.8.8.8', 'http://172.32.0.1', 'http://10.999.0.1',
                       'http://10.0.0.1:65536', 'http://10.0.0.1:0', 'http://user@10.0.0.1', 'http://10.0.0.1/path'])
        assert.throws(() => M.localUrl(url));
});
test('settings are bounded and malformed values rejected', () => {
    assert.deepEqual(config, {url:'', mount:'flat', sensitivity:1, bubbleSize:26, provider:'auto', gyroscPort:9999});
    for (const value of [{sensitivity:1e10}, {mount:'sideways'}, {bubbleSize:1000}]) assert.throws(() => M.settings(value));
});
test('samples require measuring and finite numeric values on every axis', () => {
    assert.deepEqual(M.sample(packet()), reading(1, 1, 2, 3));
    for (const v of [null, NaN, Infinity, '3']) {
        const p = packet(); p.buffer.accX.buffer = [v]; assert.throws(() => M.sample(p));
    }
    const paused = packet(); paused.status.measuring = false; assert.throws(() => M.sample(paused));
    const missing = packet(); delete missing.buffer.accZ; assert.throws(() => M.sample(missing));
    const huge = packet(); huge.buffer.accY.buffer = [500]; assert.throws(() => M.sample(huge));
});
test('first or repeated cached sample cannot establish a live stream', () => {
    const seed = M.step(M.initial(), reading(1, 4), config);
    assert.equal(seed.fresh, false); assert.equal(seed.x, 0);
    assert.equal(M.step(seed, reading(1, 4), config).fresh, false);
    assert.equal(M.step(seed, reading(1.05, 4), config).fresh, true);
});
test('inertial cue directions for flat and upright phone positions', () => {
    const seed = M.step(M.initial(), reading(1), config);
    const flat = M.step(seed, reading(1.05, 1, 2, -3), config);
    assert.ok(flat.x < 0); assert.ok(flat.y > 0);
    const upright = M.step(seed, reading(1.05, 1, 0, -3), {...config, mount:'upright'});
    assert.ok(upright.x < 0); assert.ok(upright.y > 0);
    assert.ok(M.step(seed, reading(1.05, -1, -2), config).x > 0);
});
test('offsets saturate, remain finite and settle instead of drifting', () => {
    let s = M.step(M.initial(), reading(0), config);
    for (let i = 1; i <= 500; i++) {
        s = M.step(s, reading(i / 20, 150, -150), config);
        assert.ok(Number.isFinite(s.x)); assert.ok(Math.abs(s.x) <= 46); assert.ok(Math.abs(s.y) <= 46);
    }
    for (let i = 501; i <= 700; i++) s = M.step(s, reading(i / 20, .02, -.02), config);
    assert.ok(Math.abs(s.x) < .001); assert.ok(Math.abs(s.y) < .001);
});
test('clock reset and new sessions discard old motion', () => {
    let s = M.step(M.initial(), reading(5), config);
    s = M.step(s, reading(5.05, 3, 3), config);
    assert.equal(M.step(s, reading(1, 3, 3), config).fresh, false);
    assert.equal(M.step(s, {...reading(6), session:'two'}, config).x, 0);
});
test('stale data expires within 900ms', () => {
    assert.equal(M.isFresh(1000, 1899), true);
    assert.equal(M.isFresh(1000, 1900), false);
    assert.equal(M.isFresh(0, 100), false);
});
test('stronger acceleration progressively adds bubbles, capped at twenty extras', () => {
    assert.equal(M.extraCount(0), 0);
    assert.equal(M.extraCount(.8), 0);
    assert.equal(M.extraCount(1.26), 4);
    assert.equal(M.extraCount(1.76), 8);
    assert.equal(M.extraCount(2.36), 12);
    assert.equal(M.extraCount(3.06), 16);
    assert.equal(M.extraCount(3.86), 20);
    assert.equal(M.extraCount(1000), 20);
    for (let i = 0; i < 20; i++) {
        let previous = 0;
        for (let strength = 0; strength < 8; strength += .01) {
            const opacity = M.extraOpacity(strength, i);
            assert.ok(opacity >= previous && opacity <= 1);
            previous = opacity;
        }
    }
});
test('density reacts to all three axes, fades after acceleration and ignores tiny jitter', () => {
    for (const axis of ['x', 'y', 'z']) {
        let s = M.step(M.initial(), reading(0), config);
        for (let i = 1; i <= 25; i++) s = M.step(s, {...reading(i / 20), [axis]: 5}, config);
        assert.equal(M.extraCount(s.intensity), 20);
        const high = s.intensity;
        s = M.step(s, reading(1.3), config);
        assert.ok(s.intensity < high && s.intensity > high * .8, 'release must fade, not snap');
        for (let i = 27; i < 100; i++) s = M.step(s, reading(i / 20, .02, -.02, .02), config);
        assert.equal(M.extraCount(s.intensity), 0);
    }
});
test('reflection follows direction, respects mount, and remains bounded under extreme inputs', () => {
    const seed = M.step(M.initial(), reading(0), config);
    const a = M.step(seed, reading(.05, 2, 2, 1), config);
    const b = M.step(seed, reading(.05, -2, -2, -1), config);
    assert.ok(a.reflectionX < 0 && a.reflectionY > 0 && a.reflectionDepth > 0);
    assert.ok(b.reflectionX > 0 && b.reflectionY < 0 && b.reflectionDepth < 0);
    const upright = M.step(seed, reading(.05, 0, 1, -2), {...config, mount:'upright'});
    assert.ok(upright.reflectionY > 0 && upright.reflectionDepth > 0);
    let s = seed;
    for (let i = 1; i < 100; i++) {
        s = M.step(s, reading(i / 20, 190, -190, 190), config);
        assert.ok(Math.hypot(s.reflectionX, s.reflectionY) <= 1.000001);
        assert.ok(Math.abs(s.reflectionDepth) <= 1);
        assert.ok(s.intensity <= 6);
    }
    const repeated = M.step(s, reading(s.time, -1, 1, 1), config);
    assert.equal(repeated.intensity, s.intensity);
    assert.equal(repeated.reflectionX, s.reflectionX);
    const reset = M.step(s, reading(0), config);
    assert.equal(reset.intensity, 0);
    assert.equal(reset.reflectionX, 0);
});
test('thirty-two unique anchors stay on the perimeter', () => {
    const anchors = Array.from({length:32}, (_, i) => M.bubbleAnchor(i));
    assert.equal(new Set(anchors.map(a => JSON.stringify(a))).size, 32);
    for (const a of anchors) {
        assert.ok(['left','right','top','bottom'].includes(a.edge));
        assert.ok(a.position > 0 && a.position < 1);
    }
});
test('spacing is gently irregular, stable and not mirrored between edges', () => {
    const anchors = Array.from({length:32}, (_, i) => M.bubbleAnchor(i));
    assert.deepEqual(anchors, Array.from({length:32}, (_, i) => M.bubbleAnchor(i)));
    for (let i = 0; i < 12; i++) {
        const original = (i % 6 + 1) / 7;
        assert.ok(Math.abs(anchors[i].position - original) <= .014);
        assert.notEqual(anchors[i].position, original);
    }
    for (const a of anchors) assert.ok(a.inset >= 61 && a.inset <= 79);
    for (let i = 0; i < 6; i++) assert.notEqual(anchors[i].position, anchors[i + 6].position);
    for (const edge of ['left','right','top','bottom']) {
        const positions = anchors.filter(a => a.edge === edge).map(a => a.position).sort((a,b) => a-b);
        for (let i = 1; i < positions.length; i++)
            assert.ok(positions[i] - positions[i - 1] > .042, 'jitter must leave separation between neighbors');
    }
});
