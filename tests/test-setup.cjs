const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const temporary = require('./temporary.cjs');
const {spawnSync} = require('node:child_process');

const source = path.resolve(__dirname, '..');
const temporaryRoot = temporary('motion-cues-setup-');
const bin = path.join(temporaryRoot, 'bin');
const config = path.join(temporaryRoot, 'config');
const log = path.join(temporaryRoot, 'setup.json');
const calls = path.join(temporaryRoot, 'unexpected-calls');
fs.mkdirSync(bin);
fs.mkdirSync(path.join(config, 'omarchy'), {recursive:true});
const settings = path.join(config, 'omarchy', 'motion-cues.json');
fs.writeFileSync(settings, '{"url":"http://10.0.0.1","mount":"upright","custom":"preserve"}\n');
const before = fs.readFileSync(settings, 'utf8');
fs.writeFileSync(path.join(bin, 'ip'), `#!${process.execPath}
process.stdout.write(process.env.MOTION_SETUP_ADDRESSES || JSON.stringify([
    {ifname:'wlan0',addr_info:[{scope:'global',local:'192.168.40.8'}]},
    {ifname:'lo',addr_info:[{scope:'host',local:'127.0.0.1'}]}
]));
`, {mode:0o755});
// Exercise the real launcher with a harmless guide stand-in, not a live GTK window.
const windowStub = `import json, os, sys
from pathlib import Path
Path(os.environ['MOTION_SETUP_LOG']).write_text(json.dumps(sys.argv))
Path(os.environ['MOTION_SETUP_LOG'] + '.guide').write_text(sys.stdin.read())
sys.exit(int(os.environ.get('MOTION_SETUP_EXIT', '0')))
`;
const checkout = path.join(temporaryRoot, 'checkout');
fs.mkdirSync(checkout);
for (const name of ['omarchy-motion-cues', 'Endpoint.jq', 'SETUP.txt'])
    fs.copyFileSync(path.join(source, name), path.join(checkout, name));
fs.writeFileSync(path.join(checkout, 'setup_window.py'), windowStub);
for (const name of ['omarchy', 'notify-send', 'curl']) {
    fs.writeFileSync(path.join(bin, name), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$MOTION_SETUP_CALLS"\nexit 99\n', {mode:0o755});
}
const env = {...process.env, PATH:bin + ':' + process.env.PATH,
    HOME:temporaryRoot, XDG_CONFIG_HOME:config, MOTION_SETUP_LOG:log, MOTION_SETUP_CALLS:calls};
function run(cli, exit = '0') {
    return spawnSync('bash', [cli, 'setup'], {encoding:'utf8', env:{...env, MOTION_SETUP_EXIT:exit}});
}

test('Setup is always available and opens a read-only guide without changing settings', () => {
    const menu = JSON.parse(fs.readFileSync(path.join(source, 'menu.jsonc'), 'utf8'));
    const setup = menu['motion-cues.setup'];
    assert.equal(setup.label, 'Setup');
    assert.equal(setup.when, undefined);
    assert.equal(setup.action, '"$HOME/.local/bin/omarchy-motion-cues" setup');
    assert.match(fs.readFileSync(path.join(source, 'omarchy-motion-cues'), 'utf8'),
        /connection_details compact \| \/usr\/bin\/python3 -B "\$plugin_dir\/setup_window.py"/);
    {
        const result = run(path.join(checkout, 'omarchy-motion-cues'));
        assert.equal(result.status, 0, result.stderr);
        const args = JSON.parse(fs.readFileSync(log, 'utf8'));
        assert.equal(args[0], path.join(checkout, 'setup_window.py'));
        const guide = fs.readFileSync(log + '.guide', 'utf8');
        assert.ok(guide.includes('GyrOSC destination, UDP port: 9999'));
        assert.ok(guide.includes('UDP port: 9999'));
        assert.ok(guide.includes('Destination IP: 192.168.40.8 (wlan0)'));
        assert.equal(guide.trim().split('\n').length, 2);
        assert.ok(!guide.includes('127.0.0.1'));
        assert.equal(fs.readFileSync(settings, 'utf8'), before);
        assert.equal(fs.existsSync(calls), false);
    }
    const failure = run(path.join(checkout, 'omarchy-motion-cues'), '2');
    assert.equal(failure.status, 2, 'do not hide a guide startup error');
});

test('installed launcher finds the shipped guide without requiring enabled service or settings', () => {
    const plugin = path.join(temporaryRoot, '.config', 'omarchy', 'plugins', 'max.motion-cues');
    fs.mkdirSync(plugin, {recursive:true});
    fs.copyFileSync(path.join(source, 'SETUP.txt'), path.join(plugin, 'SETUP.txt'));
    fs.writeFileSync(path.join(plugin, 'setup_window.py'), windowStub);
    const cli = path.join(bin, 'omarchy-motion-cues');
    fs.copyFileSync(path.join(source, 'omarchy-motion-cues'), cli);
    // Simulate first use before any settings have been saved.
    fs.renameSync(settings, settings + '.saved');
    assert.equal(run(cli).status, 0);
    assert.ok(fs.readFileSync(log + '.guide', 'utf8').includes('UDP port: 9999'));
    assert.equal(fs.existsSync(settings), false);
    assert.equal(fs.existsSync(calls), false);
    fs.renameSync(path.join(plugin, 'SETUP.txt'), path.join(plugin, 'SETUP.txt.saved'));
    const missing = run(cli);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /guide is missing/);
});

test('brief guide retains essential steps, limits, firewall and safety', () => {
    const guide = fs.readFileSync(path.join(source, 'SETUP.txt'), 'utf8');
    for (const phrase of ['iPhone or Android', 'phyphox', 'hotspot', 'Acceleration (without g)',
        'Tap Play', 'Allow remote access', 'Phone address…', 'including its port', 'Enable',
        'Flat:', 'Upright:', 'phone unlocked', 'No bubbles?', 'Connection status',
        'Passenger', 'private Wi-Fi', 'GyrOSC', 'Auto-detect',
        '/gyrosc/accel', '30 Hz', '30 updates per second', 'run in background', 'reliability varies',
        'recommended for iPhone because it offers background mode',
        'sudo ufw allow in on INTERFACE proto udp from PHONE_IP to LAPTOP_IP port PORT',
        'Keep the firewall enabled', 'remove it when no longer needed',
        'Not added automatically', 'not the phone IP']) {
        assert.ok(guide.includes(phrase), phrase);
    }
    assert.doesNotMatch(guide, /—/);
    assert.ok(guide.trim().split(/\s+/).length <= 350, 'keep the entire guide brief');
});

test('Connection status shows current laptop destination while enabled or disabled without changing settings', () => {
    fs.writeFileSync(path.join(bin, 'omarchy'), `#!${process.execPath}
if (process.argv.slice(2).join(' ') !== 'shell motion-cues status') process.exit(99);
process.stdout.write(process.env.MOTION_SETUP_STATUS);
`, {mode:0o755});
    fs.writeFileSync(path.join(bin, 'notify-send'), `#!${process.execPath}
require('node:fs').writeFileSync(process.env.MOTION_SETUP_LOG + '.notification', JSON.stringify(process.argv.slice(2)));
`, {mode:0o755});
    const saved = '{"url":"http://10.0.0.1","provider":"gyrosc","gyroscPort":10001,"custom":"keep"}\n';
    fs.writeFileSync(settings, saved);
    for (const enabled of [true,false]) {
        const result = spawnSync('bash', [path.join(source,'omarchy-motion-cues'),'info'], {
            encoding:'utf8',env:{...env,MOTION_SETUP_STATUS:JSON.stringify({enabled,
                message:'Waiting for GyrOSC',provider:'gyrosc',url:'http://10.0.0.1',mount:'flat'})}
        });
        assert.equal(result.status,0,result.stderr);
        const body = JSON.parse(fs.readFileSync(log + '.notification','utf8')).at(-1);
        assert.ok(body.includes('Destination IP: 192.168.40.8 (wlan0)'));
        assert.ok(body.includes('UDP port: 10001'));
        assert.ok(body.split('\n').slice(0,2).join('\n').includes('UDP port: 10001'));
        assert.ok(body.split('\n').slice(0,2).join('\n').includes('Destination IP: 192.168.40.8'));
        assert.ok(!body.includes('http://10.0.0.1'), 'do not confuse GyrOSC destination with phone IP');
        assert.equal(fs.readFileSync(settings,'utf8'),saved);
    }
    const invoke = addresses => spawnSync('bash',[path.join(source,'omarchy-motion-cues'),'destination'],{
        encoding:'utf8',env:{...env,MOTION_SETUP_ADDRESSES:JSON.stringify(addresses)}
    });
    const changed = invoke([{ifname:'wlan0',addr_info:[{scope:'global',local:'10.4.3.2'}]}]);
    assert.equal(changed.status,0,changed.stderr);
    assert.match(changed.stdout,/Destination IP: 10\.4\.3\.2/);
    assert.doesNotMatch(changed.stdout,/192\.168\.40\.8/);
    const offline = invoke([]);
    assert.equal(offline.status,0,offline.stderr);
    assert.match(offline.stdout,/No network address found/);
});
