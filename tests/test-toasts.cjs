const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const temporary = require('./temporary.cjs');
const {spawnSync} = require('node:child_process');

test('Disable sends one transient toast, repeated Disable stays quiet', () => {
    const directory = temporary('motion-cues-disable-test-');
    const state = path.join(directory, 'state');
    const log = path.join(directory, 'notifications');
    fs.writeFileSync(state, '{"enabled":true,"toastId":73}');
    fs.writeFileSync(path.join(directory, 'omarchy'), '#!/bin/bash\n' +
        'if [[ "$*" == "shell motion-cues status" ]]; then cat "$MOTION_TEST_STATE";\n' +
        'elif [[ "$*" == "plugin disable max.motion-cues" ]]; then printf \'{"enabled":false}\\n\' > "$MOTION_TEST_STATE";\n' +
        'else exit 1; fi\n', {mode:0o755});
    fs.writeFileSync(path.join(directory, 'notify-send'), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$MOTION_TEST_NOTIFICATIONS"\n', {mode:0o755});
    const env = {...process.env, PATH:directory + ':' + process.env.PATH,
        MOTION_TEST_STATE:state, MOTION_TEST_NOTIFICATIONS:log};
    const run = () => spawnSync('bash', [path.join(__dirname, '..', 'omarchy-motion-cues'), 'disable'], {env, encoding:'utf8'});
    assert.equal(run().status, 0);
    const initial = fs.readFileSync(log, 'utf8');
    assert.match(initial, /--transient --expire-time=3000 --replace-id=73 Motion Cues disconnected/);
    assert.equal(run().status, 0);
    assert.equal(fs.readFileSync(log, 'utf8'), initial);
});
