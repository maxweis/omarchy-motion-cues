const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const temporary = require('./temporary.cjs');
const root = path.resolve(__dirname, '..');

test('public archive is reproducible, complete, and excludes local state', () => {
    const directory = temporary('motion-cues-release-');
    const run = () => spawnSync('python3', [path.join(root,'scripts/release.py'), '--output-dir', directory], {encoding:'utf8'});
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const archive = first.stdout.trim();
    const before = fs.readFileSync(archive);
    assert.equal(run().status, 0);
    assert.deepEqual(fs.readFileSync(archive), before);
    const list = spawnSync('tar', ['-tzf', archive], {encoding:'utf8'});
    assert.equal(list.status, 0, list.stderr);
    assert.match(list.stdout, /scripts\/install.py/);
    assert.match(list.stdout, /tests\/test-integration.cjs/);
    assert.match(list.stdout, /LICENSE/);
    assert.match(list.stdout, /docs\/media\/motion-cues.gif/);
    assert.match(list.stdout, /docs\/media\/showcase.png/);
    assert.doesNotMatch(list.stdout, /backups|\.env|VERIFICATION|motion-cues\.json/);
    assert.equal(list.stdout.split('\n').filter(line => /\.(png|gif)$/.test(line)).length, 2);
});

test('new installations have no default phone; malformed settings cannot silently use defaults', () => {
    const S = require('../Settings.js');
    assert.equal(S.settings({}).url, '');
    assert.equal(S.settings({}).provider, 'auto');
    assert.equal(S.settings({}).gyroscPort, 9999);
    for (const provider of ['auto', 'phyphox', 'gyrosc']) assert.equal(S.settings({provider}).provider, provider);
    for (const provider of ['', null, 'GyrOSC', 1]) assert.throws(() => S.settings({provider}));
    for (const gyroscPort of [0, 1023, 65536, '9999', 9.5, null]) assert.throws(() => S.settings({gyroscPort}));
    for (const value of [null, 1, [], 'settings', true]) assert.throws(() => S.settings(value));
    for (const url of [null, false, 3]) assert.throws(() => S.settings({url}));
    assert.equal(S.settings({url:'192.168.1.100:8080'}).url, 'http://192.168.1.100:8080');
});

test('CLI rejects extra arguments and safely compares JSON setting values', () => {
    const directory = temporary('motion-cues-cli-');
    fs.mkdirSync(path.join(directory, 'omarchy'));
    fs.writeFileSync(path.join(directory, 'omarchy/motion-cues.json'), '{"mount":"flat","sensitivity":0.5}');
    const run = args => spawnSync('bash',[path.join(root,'omarchy-motion-cues'),...args],
        {encoding:'utf8', env:{...process.env,XDG_CONFIG_HOME:directory}});
    assert.equal(run(['--help']).status, 0);
    assert.equal(run(['enable','unexpected']).status, 2);
    assert.equal(run(['configure']).status, 2);
    assert.equal(run(['is-setting','mount','"flat"']).status, 0);
    assert.notEqual(run(['is-setting','mount','"upright"']).status, 0);
    assert.equal(run(['is-setting','sensitivity','0.5']).status, 0);
    assert.notEqual(run(['is-setting','mount','bad JSON']).status, 0);
});
