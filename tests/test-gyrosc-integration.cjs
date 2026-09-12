// Real UDP -> Python -> QML -> motion model. No installed configuration is changed.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const dgram = require('node:dgram');
const {spawn, execFile} = require('node:child_process');
const exec = require('node:util').promisify(execFile);
const source = path.resolve(__dirname, '..');
const delay = ms => new Promise(r => setTimeout(r, ms));

function packet(values = [.2, .1, -.1]) {
    const address = Buffer.from('/gyrosc/accel\0\0\0');
    const tags = Buffer.from(',fff\0\0\0\0');
    const axes = Buffer.alloc(12);
    values.forEach((v,i) => axes.writeFloatBE(v, i*4));
    return Buffer.concat([address, tags, axes]);
}
async function freePort() {
    const socket = dgram.createSocket('udp4');
    await new Promise(r => socket.bind(0, '127.0.0.1', r));
    const port = socket.address().port;
    await new Promise(r => socket.close(r));
    return port;
}
async function assertReleased(port) {
    const socket = dgram.createSocket('udp4');
    try {
        await new Promise((resolve,reject) => {
            socket.once('error', reject); socket.bind(port, '0.0.0.0', resolve);
        });
    } finally { socket.close(); }
}

async function main() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'motion-cues-osc-'));
    const harness = path.join(directory, 'shell.qml');
    const config = path.join(directory, 'settings.json');
    await fs.cp(path.join(source, 'src'), path.join(directory, 'src'), {recursive:true});
    await fs.copyFile(path.join(__dirname,'TestHarness.qml'), harness);
    await fs.mkdir(path.join(directory,'bin'));
    await fs.writeFile(path.join(directory,'bin/notify-send'), '#!/bin/sh\nprintf "73\\n"\n', {mode:0o755});
    let clock = 0, requests = 0, httpLive = false;
    const server = http.createServer((req,res) => {
        requests++;
        const payload = {status:{measuring:httpLive,session:'http'},buffer:{}};
        for (const [key,value] of Object.entries({accX:-2,accY:1,accZ:0,acc_time:clock+=.05}))
            payload.buffer[key] = {buffer:[value]};
        res.end(JSON.stringify(payload));
    });
    await new Promise(r => server.listen(0,'127.0.0.1',r));
    const url = `http://127.0.0.1:${server.address().port}`;
    let port = await freePort();
    await fs.writeFile(config, JSON.stringify({url,gyroscPort:port}));
    let logs = '';
    const render = process.env.MOTION_CUES_TEST_RENDER === '1';
    const child = spawn('quickshell',['--no-color','-p',harness], {env:{...process.env,
        MOTION_CUES_TEST_CONFIG:config,PATH:path.join(directory,'bin')+':'+process.env.PATH,
        ...(render ? {WAYLAND_DEBUG:'client'} : {})},stdio:['ignore','pipe','pipe']});
    child.stdout.on('data', b => logs += b);
    child.stderr.on('data', b => logs += b);
    const socket = dgram.createSocket('udp4');
    let sending = false;
    const ticker = setInterval(() => { if (sending) socket.send(packet(),port,'127.0.0.1'); }, 12);
    async function ipc(method, ...args) {
        return (await exec('quickshell',['-p',harness,'ipc','call','motion-cues-test',method,...args],{timeout:2000})).stdout.trim();
    }
    async function status() { return JSON.parse(await ipc('status')); }
    async function until(fn, timeout=6000) {
        const end = Date.now()+timeout;
        while (Date.now()<end) {
            try { const s = await status(); if (fn(s)) return s; } catch {}
            await delay(60);
        }
        throw new Error('State timeout\n'+logs+'\n'+await ipc('status').catch(()=>''));
    }
    const configure = value => ipc('configure',JSON.stringify(value));
    let lastPid;
    try {
        await until(s => s.gyroscListening);
        socket.send(Buffer.from('not OSC'),port,'127.0.0.1');
        await delay(100);
        assert.equal((await status()).connected,false);
        sending = true;
        let live = await until(s => s.connected && s.detectedApp==='gyrosc' && s.samples>4);
        assert.ok(Math.abs(live.sample.x-1.96133)<.00001);
        assert.ok(live.offsetX<0 && live.offsetY>0);
        assert.equal(live.provider,'auto');
        if (render) {
            const visual = JSON.parse(await ipc('visuals'))[0];
            assert.equal(visual.running,true);
            assert.equal(visual.bubbles.length,32);
            assert.ok(visual.bubbles.some(b => b.visible));
        }
        lastPid = live.gyroscProcessId;
        const before = requests, samples = live.samples;
        httpLive = true;
        await delay(1100);
        assert.equal(requests,before,'no HTTP polling while GyrOSC owns feed');
        live = await status();
        assert.ok(live.samples-samples<=24,'QML input bounded at 20 Hz');
        console.log('PASS auto-detected real OSC datagrams, units, cue directions, rate limit and HTTP suspension');
        sending = false;
        await until(s => s.connected && s.detectedApp==='phyphox');
        sending = true;
        await delay(350);
        assert.equal((await status()).detectedApp,'phyphox','healthy feed must not flap');
        httpLive = false;
        await until(s => s.connected && s.detectedApp==='gyrosc');
        console.log('PASS stale-source failover in both directions and no mixing');

        const oldPort = port;
        port = await freePort();
        assert.equal(await configure({gyroscPort:port}), 'ok');
        await until(s => s.connected && s.detectedApp==='gyrosc' && s.gyroscProcessId!==lastPid);
        await assertReleased(oldPort);
        assert.match(await configure({gyroscPort:0}),/^error:/);
        console.log('PASS port changes restart receiver, release old socket and reject unsafe configuration');
        lastPid = (await status()).gyroscProcessId;
        assert.equal(await ipc('reconnect'),'ok');
        await until(s => s.connected && s.detectedApp==='gyrosc' && s.gyroscProcessId!==lastPid);
        console.log('PASS explicit reconnect restarts receiver and source selection');

        httpLive = true;
        assert.equal(await configure({provider:'phyphox'}),'ok');
        await until(s => s.connected && s.detectedApp==='phyphox' && !s.gyroscListening);
        await assertReleased(port);
        assert.equal(await configure({provider:'gyrosc'}),'ok');
        await until(s => s.connected && s.detectedApp==='gyrosc');
        let count = requests;
        await delay(200);
        assert.equal(requests,count);
        console.log('PASS explicit providers disable unused transport');

        // No URL is required for GyrOSC, including a migration-safe Auto default.
        assert.equal(await configure({provider:'auto',url:''}),'ok');
        await until(s => s.connected && s.detectedApp==='gyrosc' && s.url==='');
        sending = false;
        await until(s => !s.connected && s.extraBubbles===0);
        assert.equal((await status()).flowVelocityX,0);
        await fs.writeFile(config,'invalid JSON');
        await until(s => !s.connected && !s.gyroscListening);
        await assertReleased(port);
        console.log('PASS URL-free detection, stale hide/reset, malformed config closes listener');

        // A busy port must not interfere with phyphox, and must recover on release.
        const blocker = dgram.createSocket('udp4');
        await new Promise(r => blocker.bind(port,'0.0.0.0',r));
        try {
            await fs.writeFile(config,JSON.stringify({url,gyroscPort:port}));
            await until(s => s.connected && s.detectedApp==='phyphox' && s.gyroscError.includes('Cannot listen'));
        } finally { await new Promise(r => blocker.close(r)); }
        await until(s => s.gyroscListening);
        console.log('PASS busy-port diagnostic, independent phyphox and receiver recovery');

        for (let i=0;i<2;i++) {
            const command = ['-p',harness,'ipc','call','motion-cues-lifecycle-test'];
            await exec('quickshell',[...command,'unload']);
            await delay(200);
            await assertReleased(port);
            await exec('quickshell',[...command,'unload']);
            await exec('quickshell',[...command,'load']);
            await until(s => s.gyroscListening);
        }
        assert.ok(!/TypeError|ReferenceError|Cannot assign|failed to load|Binding loop/i.test(logs),logs);
        console.log('PASS repeated unload/load releases UDP socket with clean QML runtime');
        if (render) {
            const ids = [...logs.matchAll(/set_input_region\(wl_region[#@](\d+)\)/g)].map(m=>m[1]);
            assert.ok(ids.length>0);
            for (const id of ids) assert.ok(!new RegExp(`wl_region[#@]${id}\\.add\\(`).test(logs));
            assert.match(logs,/set_keyboard_interactivity\(0\)/);
            console.log('PASS GyrOSC-driven rendered delegates and click-through Wayland surface');
        }
    } catch (error) {
        console.error('GyrOSC integration failure:',error,logs);
        throw error;
    } finally {
        clearInterval(ticker);
        socket.close();
        child.kill('SIGTERM');
        if (child.exitCode === null) await new Promise(r => child.once('exit',r));
        await delay(200);
        server.closeAllConnections();
        await new Promise(r => server.close(r));
        await fs.writeFile(path.join(directory,'runtime.log'),logs);
        console.log('Diagnostics: '+directory);
        await assertReleased(port);
    }
}
main().catch(e => { console.error(e); process.exitCode=1; });
