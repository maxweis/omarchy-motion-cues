// Accelerated real QML deadlines. Shutdown can only unload this private harness.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const dgram = require('node:dgram');
const {spawn, execFile} = require('node:child_process');
const exec = require('node:util').promisify(execFile);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeout = 2000;

async function main() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'motion-cues-inactivity-'));
    const harness = path.join(directory, 'shell.qml');
    const config = path.join(directory, 'settings.json');
    await fs.cp(path.resolve(__dirname, '../src'), path.join(directory, 'src'), {recursive:true});
    await fs.copyFile(path.join(__dirname, 'TestHarness.qml'), harness);
    await fs.cp(path.resolve(__dirname, '../bin'), path.join(directory, 'bin'), {recursive:true});
    await fs.writeFile(path.join(directory, 'bin/notify-send'), '#!/bin/sh\nprintf "73\\n"\n', {mode:0o755});
    const reservation = dgram.createSocket('udp4');
    await new Promise(resolve => reservation.bind(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    let httpMode = 'live', clock = 0, requests = 0;
    const server = http.createServer((_req, res) => {
        requests++;
        if (httpMode === 'live') clock += .05;
        const value = {status:{measuring:httpMode !== 'paused', session:'test'}, buffer:{}};
        for (const [key, reading] of Object.entries({accX:0, accY:0, accZ:0, acc_time:clock}))
            value.buffer[key] = {buffer:[reading]};
        res.end(JSON.stringify(value));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    await fs.writeFile(config, JSON.stringify({provider:'gyrosc', gyroscPort:port}));
    let logs = '', sending = 'none';
    const socket = dgram.createSocket('udp4');
    const packet = Buffer.concat([Buffer.from('/gyrosc/accel\0\0\0'), Buffer.from(',fff\0\0\0\0'), Buffer.alloc(12)]);
    const ticker = setInterval(() => {
        if (sending !== 'none') socket.send(sending === 'valid' ? packet : Buffer.from('invalid OSC'), port, '127.0.0.1');
    }, 50);
    const child = spawn('quickshell', ['--no-color', '-p', harness], {
        env:{...process.env, MOTION_CUES_TEST_CONFIG:config, MOTION_CUES_TEST_TIMEOUT_MS:String(timeout),
            PATH:path.join(directory, 'bin') + ':' + process.env.PATH}, stdio:['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', data => logs += data);
    child.stderr.on('data', data => logs += data);
    async function ipc(target, method, ...args) {
        return (await exec('quickshell', ['-p', harness, 'ipc', 'call', target, method, ...args], {timeout:2000})).stdout.trim();
    }
    const lifecycle = (method, ...args) => ipc('motion-cues-lifecycle-test', method, ...args);
    const status = async () => JSON.parse(await ipc('motion-cues-test', 'status'));
    const state = async () => JSON.parse(await lifecycle('state'));
    async function until(predicate, limit = timeout + 2500) {
        const deadline = Date.now() + limit;
        while (Date.now() < deadline) {
            try { if (await predicate()) return; } catch {}
            await delay(40);
        }
        throw new Error('Inactivity check timed out\n' + logs + '\nState: ' + JSON.stringify(await state())
            + '\nService: ' + JSON.stringify(await status().catch(() => null)));
    }
    async function inactive(expected) {
        await until(async () => !(await state()).active);
        assert.equal((await state()).inactivityDisables, expected);
        const probe = dgram.createSocket('udp4');
        try {
            await new Promise((resolve, reject) => {
                probe.once('error', reject);
                probe.bind(port, '0.0.0.0', resolve);
            });
        } finally { probe.close(); }
        const before = requests;
        await delay(180);
        assert.equal(requests, before, 'automatic disable stops HTTP requests');
        assert.equal((await state()).inactivityDisables, expected, 'disable once only');
    }
    async function load(settings) {
        await lifecycle('unload');
        await fs.writeFile(config, typeof settings === 'string' ? settings : JSON.stringify(settings));
        await lifecycle('load');
        await until(async () => (await status()).inactivityRemainingMs > 0);
    }
    try {
        await until(async () => (await status()).gyroscListening);
        const initial = await status();
        assert.equal(initial.inactivityTimeoutMs, timeout);
        assert.equal((await state()).launcherPath, path.join(directory, 'bin/omarchy-motion-cues'));
        assert.ok(initial.inactivityRemainingMs > timeout / 2);
        await inactive(1);
        console.log('PASS never-connected startup disables once and releases its UDP socket');

        sending = 'valid';
        await load({provider:'gyrosc', gyroscPort:port});
        await until(async () => (await status()).connected);
        await delay(timeout + 350);
        assert.equal((await state()).active, true, 'stationary readings keep the plugin enabled');
        assert.equal((await status()).flowVelocityX, 0);
        sending = 'none';
        await delay(1100);
        assert.equal((await state()).active, true, 'brief disconnect does not disable');
        sending = 'valid';
        await until(async () => (await status()).connected);
        await delay(200);
        sending = 'none';
        await delay(1200);
        assert.equal((await state()).active, true, 'fresh readings reset the earlier deadline');
        await inactive(2);
        console.log('PASS stationary data, short interruption, recovery and deadline reset');

        sending = 'invalid';
        await load({provider:'gyrosc', gyroscPort:port});
        await delay(850);
        const beforeSettings = (await status()).inactivityRemainingMs;
        assert.equal(await ipc('motion-cues-test', 'reconnect'), 'ok');
        assert.equal(await ipc('motion-cues-test', 'configure', '{"sensitivity":0.5}'), 'ok');
        assert.ok((await status()).inactivityRemainingMs <= beforeSettings + 50);
        await inactive(3);
        console.log('PASS invalid OSC, reconnect and configuration changes do not extend inactivity');

        sending = 'none';
        await load('malformed settings');
        await inactive(4);
        console.log('PASS invalid settings still time out without opening a receiver');

        httpMode = 'live';
        await load({provider:'phyphox', url});
        await until(async () => (await status()).connected);
        await delay(timeout + 200);
        assert.equal((await state()).active, true);
        httpMode = 'stale';
        await inactive(5);
        console.log('PASS fresh stationary HTTP keeps alive; repeated timestamps do not');

        httpMode = 'live';
        await load({provider:'phyphox', url});
        await until(async () => (await status()).connected);
        httpMode = 'paused';
        await inactive(6);
        console.log('PASS paused phyphox disables fully and stops polling');

        sending = 'valid';
        await delay(300);
        assert.equal((await state()).active, false, 'new data cannot re-enable a disabled plugin');
        await load({provider:'gyrosc', gyroscPort:port});
        await until(async () => (await status()).connected);
        await lifecycle('unload');
        await delay(timeout + 200);
        assert.equal((await state()).inactivityDisables, 6, 'manual unload cancels its deadline');
        assert.ok(!/TypeError|ReferenceError|Cannot assign|failed to load|Binding loop/i.test(logs), logs);
        console.log('PASS explicit re-enable works and manual disable cancels the pending timer');
    } finally {
        clearInterval(ticker);
        socket.close();
        child.kill('SIGTERM');
        if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await fs.writeFile(path.join(directory, 'runtime.log'), logs);
        console.log('Diagnostics: ' + directory);
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
