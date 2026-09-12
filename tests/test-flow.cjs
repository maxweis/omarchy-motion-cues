const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./model.cjs');
const config = M.settings({});
const reading = (t, x=0, y=0, z=0) => ({t,x,y,z,session:'test'});

test('sustained turns keep a bounded cue speed, reversing changes direction, rest stops it', () => {
    let s = M.step(M.initial(), reading(0), config);
    for (let i = 1; i <= 200; i++) s = M.step(s, reading(i/20, 1), config);
    assert.ok(s.velocityX < -74 && s.velocityX > -76);
    assert.equal(s.velocityY, 0);
    for (let i = 201; i <= 240; i++) s = M.step(s, reading(i/20, -1), config);
    assert.ok(s.velocityX > 74);
    for (let i = 241; i <= 300; i++) s = M.step(s, reading(i/20, .02, -.02), config);
    assert.equal(s.velocityX, 0);
    assert.equal(s.velocityY, 0);
    assert.equal(M.step(s, reading(0, 5), config).velocityX, 0);
});

test('flow direction respects mounting and sensitivity, without vertical-bump lateral motion', () => {
    const seed = M.step(M.initial(), reading(0), config);
    const a = M.step(seed, reading(.05, 1, 2, -3), config);
    const b = M.step(seed, reading(.05, 1, 2, -3), {...config,mount:'upright'});
    assert.ok(a.velocityX < 0 && a.velocityY > 0 && b.velocityY > 0);
    const gentle = M.step(seed, reading(.05, 1), {...config,sensitivity:.5});
    assert.ok(Math.abs(gentle.velocityX - a.velocityX/2) < 1e-8);
    const bump = M.step(seed, reading(.05, 0, 4, 0), {...config,mount:'upright'});
    assert.equal(bump.velocityX, 0); assert.equal(bump.velocityY, 0);
    assert.ok(bump.intensity > 0);
    const extreme = M.step(seed, reading(.15, 190, -190), config);
    assert.ok(Math.abs(extreme.velocityX) <= 180 && Math.abs(extreme.velocityY) <= 180);
});

test('bubbles keep travelling during a constant turn, fade at exits, and new generations enter', () => {
    const layout = M.flowLayout(1800, 1125, 26);
    let particles = M.flowInitial(layout), renewals = 0, faded = 0;
    for (let frame = 0; frame < 900; frame++) {
        const next = M.flowStep(particles, layout, -90, 0, 1/60);
        for (let i=0; i<12; i++) {
            if (next[i].generation > particles[i].generation) {
                renewals++;
                assert.equal(next[i].opacity, 0, 'recycling must be invisible');
                assert.ok(particles[i].opacity < .02, 'old bubble must fade before recycling');
                assert.ok(next[i].x > layout[i].bounds.maxX-2, 'new bubble enters on the incoming side');
            } else assert.ok(next[i].x < particles[i].x, 'sustained turn must never stop or move backwards');
            if (next[i].opacity > 0 && next[i].opacity < .9) faded++;
        }
        particles = next;
    }
    assert.ok(renewals > 60 && faded > 100);
    assert.equal(particles.length, 32);
});

test('reverse turns and longitudinal motion recycle correctly without teleporting visible dots', () => {
    const layout = M.flowLayout(1800,1125,26);
    for (const [vx,vy] of [[100,0], [0,-180], [0,180], [130,-170], [-150,160]]) {
        let p = M.flowInitial(layout), renewals=0;
        for (let frame=0; frame<600; frame++) {
            const n = M.flowStep(p,layout,vx,vy,1/60);
            n.forEach((dot,i) => {
                if (dot.generation !== p[i].generation) { renewals++; assert.equal(dot.opacity,0); }
                else {
                    const dx=dot.x-p[i].x, dy=dot.y-p[i].y;
                    assert.ok(dx*vx+dy*vy>0, 'varied paths must keep moving in the cue direction');
                    assert.ok(Math.hypot(dx,dy)<=Math.hypot(vx,vy)/60*1.36, 'variation must stay bounded');
                    assert.ok(Math.hypot(dx,dy)>=Math.hypot(vx,vy)/60*.69);
                    assert.equal(dot.scale,p[i].scale,'size must not pop while visible');
                }
            });
            p=n;
        }
        assert.ok(renewals>0);
    }
});

test('flow stays peripheral, bounded and finite across sizes and stalls', () => {
    for (const [w,h] of [[320,240],[800,600],[1800,1125],[3840,2160],[1080,1920]]) {
        for (const size of [12,18,26]) {
            const layout=M.flowLayout(w,h,size);
            let p=M.flowInitial(layout);
            for (let frame=0; frame<180; frame++) {
                p=M.flowStep(p,layout,180,-180,frame===100?100:1/60);
                p.forEach((dot,i) => {
                    const b=layout[i].bounds;
                    assert.ok(dot.x>=b.minX && dot.x<=b.maxX && dot.y>=b.minY && dot.y<=b.maxY);
                    assert.ok(dot.opacity>=0 && dot.opacity<=1);
                    assert.ok(dot.x < w*.2 || dot.x > w*.8 || dot.y < h*.2 || dot.y > h*.8);
                    const radius=size*dot.scale/2;
                    assert.ok(dot.x-radius>=2 && dot.x+radius<=w-2);
                    assert.ok(dot.y-radius>=2 && dot.y+radius<=h-2);
                });
            }
        }
    }
});

test('rest does not drift, respawn, or leave half-hidden bubbles', () => {
    const layout=M.flowLayout(1800,1125,26);
    let p=M.flowInitial(layout);
    for(let i=0;i<57;i++) p=M.flowStep(p,layout,-160,75,1/60);
    const parked=p.map(d=>({x:d.x,y:d.y,generation:d.generation}));
    for(let i=0;i<30;i++) p=M.flowStep(p,layout,0,0,1/60);
    const stopped=p;
    assert.ok(stopped.every(d=>d.opacity===1));
    assert.deepEqual(stopped.map(d=>({x:d.x,y:d.y,generation:d.generation})),parked);
    for(let i=0;i<120;i++) p=M.flowStep(stopped,layout,0,0,1/60);
    assert.deepEqual(p,stopped);
});

test('very slow crossings still fade fully before recycling', () => {
    const layout=M.flowLayout(1800,1125,26);
    for(const velocity of [-.6,-2,-8,.6,2,8]) {
        let p=M.flowInitial(layout);
        p[0].x=velocity<0?layout[0].bounds.minX+.15:layout[0].bounds.maxX-.15;
        let recycled=false;
        for(let i=0;i<30;i++) {
            const next=M.flowStep(p,layout,velocity,0,1/60);
            if(next[0].generation>p[0].generation) {
                assert.ok(p[0].opacity<.05);
                assert.equal(next[0].opacity,0);
                recycled=true; break;
            }
            p=next;
        }
        assert.equal(recycled,true);
    }
});

test('flow is frame-rate independent at 30, 60 and 120 Hz', () => {
    const layout=M.flowLayout(1800,1125,26);
    const results=[30,60,120].map(fps=>{
        let p=M.flowInitial(layout);
        for(let i=0;i<fps*5;i++) p=M.flowStep(p,layout,-80,45,1/fps);
        return p;
    });
    for(const p of results.slice(1)) p.forEach((dot,i)=>{
        assert.ok(Math.abs(dot.x-results[0][i].x)<1e-7);
        assert.ok(Math.abs(dot.y-results[0][i].y)<1e-7);
        assert.equal(dot.generation,results[0][i].generation);
    });
});
