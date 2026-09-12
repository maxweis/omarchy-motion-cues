const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const temporary = require('./temporary.cjs');
const {spawnSync} = require('node:child_process');
const M = require('./model.cjs');
const cli = path.join(__dirname, '..', 'omarchy-motion-cues');
const directory = temporary('motion-cues-endpoint-');
const config = path.join(directory, 'config');
const file = path.join(config, 'omarchy', 'motion-cues.json');
const bin = path.join(directory, 'bin');
const log = path.join(directory, 'calls.log');
fs.mkdirSync(bin);
fs.writeFileSync(path.join(bin, 'omarchy'), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$MOTION_TEST_CALLS"\nif [[ "$MOTION_TEST_INPUT" == CANCEL ]]; then exit 1; fi\nprintf "%s\\n" "$MOTION_TEST_INPUT"\n', {mode:0o755});
fs.writeFileSync(path.join(bin, 'notify-send'), '#!/bin/bash\nexit 0\n', {mode:0o755});
const env = {...process.env, XDG_CONFIG_HOME:config, PATH:bin + ':' + process.env.PATH, MOTION_TEST_CALLS:log};
function run(args, extra = {}) { return spawnSync('bash', [cli, ...args], {env:{...env, ...extra}, encoding:'utf8'}); }
function read() { return JSON.parse(fs.readFileSync(file, 'utf8')); }

test('QML and menu helper agree on valid and invalid phone addresses', () => {
    for (const value of ['172.20.10.1', '192.168.2.42:8080', ' http://10.0.0.8:1234/ ', '127.0.0.1:3000',
                         'http://192.168.001.003:00080/']) {
        const r = run(['endpoint', value]);
        assert.equal(r.status, 0, r.stderr);
        assert.equal(r.stdout.trim(), M.localUrl(value));
        assert.equal(read().url, M.localUrl(value));
    }
    const before = fs.readFileSync(file, 'utf8');
    for (const value of ['', 'abc', 'http://example.com', 'https://192.168.1.1', '8.8.8.8', '172.32.0.1',
                         '10.999.0.1', '10.0.0.1:0', '10.0.0.1:65536', 'http://user@10.0.0.1',
                         'http://10.0.0.1/path', '10.0.0.1;touch /tmp/should-not-exist']) {
        assert.throws(() => M.localUrl(value));
        const r = run(['endpoint', value]);
        assert.notEqual(r.status, 0, value);
        assert.equal(fs.readFileSync(file, 'utf8'), before, 'invalid input must not alter settings');
    }
});
test('saving works without loading the service and preserves other settings and permissions', () => {
    const custom = {...read(), mount:'upright', sensitivity:.5, bubbleSize:26, custom:'preserve'};
    fs.writeFileSync(file, JSON.stringify(custom));
    fs.chmodSync(file, 0o640);
    assert.equal(run(['endpoint', '10.0.0.5:8080']).status, 0);
    assert.deepEqual(read(), {...custom, url:'http://10.0.0.5:8080'});
    assert.equal(fs.statSync(file).mode & 0o777, 0o640);
    assert.equal(fs.existsSync(log), false, 'saving must not invoke shell or enable plugin');
});
test('native prompt saves, cancel preserves, and invalid entries are rejected', () => {
    assert.equal(run(['edit-endpoint'], {MOTION_TEST_INPUT:'192.168.1.222:8080'}).status, 0);
    assert.equal(read().url, 'http://192.168.1.222:8080');
    const before = fs.readFileSync(file, 'utf8');
    assert.equal(run(['edit-endpoint'], {MOTION_TEST_INPUT:'CANCEL'}).status, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.notEqual(run(['edit-endpoint'], {MOTION_TEST_INPUT:'bad address'}).status, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.ok(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).every(s => s.startsWith('menu input Phone address')));
});
test('malformed settings are not overwritten and no temp files remain', () => {
    fs.writeFileSync(file, 'broken JSON');
    assert.notEqual(run(['endpoint', '10.0.0.9']).status, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), 'broken JSON');
    assert.deepEqual(fs.readdirSync(path.dirname(file)), ['motion-cues.json']);
});
