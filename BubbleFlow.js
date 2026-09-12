// Pure, seeded particle layout and frame-rate-independent peripheral flow.
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

function regularAnchor(index) {
  if (index < 12) return { edge: index < 6 ? "left" : "right", position: ((index % 6) + 1) / 7 };
  // Interleave the existing side bubbles, then fill top and bottom. These are
  // initial positions; each bubble later travels within its peripheral strip.
  var extras = [
    ["left", 3.5 / 7], ["right", 3.5 / 7], ["top", 0.5], ["bottom", 0.5],
    ["left", 1.5 / 7], ["right", 1.5 / 7], ["left", 5.5 / 7], ["right", 5.5 / 7],
    ["top", 0.25], ["bottom", 0.25], ["top", 0.75], ["bottom", 0.75],
    ["left", 0.5 / 7], ["right", 0.5 / 7], ["left", 6.5 / 7], ["right", 6.5 / 7],
    ["left", 2.5 / 7], ["right", 2.5 / 7], ["left", 4.5 / 7], ["right", 4.5 / 7]
  ];
  var anchor = extras[index - 12];
  return { edge: anchor[0], position: anchor[1] };
}

function variation(index, salt) {
  // Fixed per-bubble seed: gently irregular initial spacing without random
  // frame-to-frame jitter. Reconnecting starts from the same arrangement.
  var value = (((index + 1) * 2654435761) ^ salt) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967295 * 2 - 1;
}

function bubbleAnchor(index) {
  var base = regularAnchor(index);
  return { edge: base.edge,
           position: base.position + variation(index, 1973) * 0.014,
           inset: 70 + variation(index, 8675309) * 9 };
}

function smoothUnit(value) {
  var t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function flowLayout(width, height, size) {
  // Reserve space for the largest randomly sized bubble, including its rim.
  var margin = size * 1.18 / 2 + 3;
  var side = Math.max(margin + 1, Math.min(200, width * 0.14));
  var cap = Math.max(margin + 1, Math.min(160, height * 0.14));
  var result = [];
  for (var i = 0; i < 32; i++) {
    var a = bubbleAnchor(i);
    var left = a.edge === "left", right = a.edge === "right";
    var top = a.edge === "top", bottom = a.edge === "bottom";
    var bounds = { minX: right ? width - side : margin,
                   maxX: left ? side : width - margin,
                   minY: bottom ? height - cap : margin,
                   maxY: top ? cap : height - margin };
    result.push({ edge: a.edge, bounds: bounds,
      x: clamp(left ? a.inset : right ? width - a.inset : width * a.position, bounds.minX, bounds.maxX),
      y: clamp(top ? a.inset : bottom ? height - a.inset : height * a.position, bounds.minY, bounds.maxY) });
  }
  return result;
}

function flowRandom(index, generation, salt, seed) {
  return (variation(index, salt ^ (seed | 0) ^ (((generation + 1) * 2246822519) | 0)) + 1) / 2;
}

function flowAppearance(index, generation, seed) {
  return { scale: 0.82 + flowRandom(index, generation, 719, seed) * 0.36,
           fadeSeconds: 0.26 + flowRandom(index, generation, 13427, seed) * 0.22 };
}

function flowInitial(layout, seed) {
  seed = seed === undefined ? 15485863 : seed;
  return layout.map(function(a, index) {
    var b = a.bounds;
    var side = a.edge === "left" || a.edge === "right";
    var across = 0.12 + flowRandom(index, 0, 937, seed) * 0.76;
    var jitter = (flowRandom(index, 0, 31253, seed) - 0.5) * 28;
    return Object.assign({
      x: side ? b.minX + (b.maxX - b.minX) * across : clamp(a.x + jitter, b.minX, b.maxX - .001),
      y: side ? clamp(a.y + jitter, b.minY, b.maxY - .001) : b.minY + (b.maxY - b.minY) * across,
      opacity: 1, generation: 0, seed: seed, age: 0,
      speed: 0.76 + flowRandom(index, 0, 53759, seed) * 0.48,
      sway: 0.08 + flowRandom(index, 0, 8191, seed) * 0.09,
      frequency: 0.8 + flowRandom(index, 0, 104729, seed),
      phase: flowRandom(index, 0, 65537, seed) * 2 * Math.PI
    }, flowAppearance(index, 0, seed));
  });
}

function flowDisplacement(p, velocityX, velocityY, dt) {
  // Integrate smooth curves analytically instead of adding random noise each
  // frame. The forward component is always positive; sway is perpendicular.
  function sineIntegral(frequency, phase) {
    return (Math.cos(p.age * frequency + phase) - Math.cos((p.age + dt) * frequency + phase)) / frequency;
  }
  var forward = p.speed * (dt + 0.08 * sineIntegral(p.frequency, p.phase));
  var sideways = p.sway * sineIntegral(p.frequency * 0.73, p.phase + 1.7);
  return { x: velocityX * forward - velocityY * sideways,
           y: velocityY * forward + velocityX * sideways };
}

function flowStep(previous, layout, velocityX, velocityY, seconds) {
  // Never catch up a long compositor stall with a visible teleport.
  var dt = clamp(seconds, 0, 0.05);
  if (velocityX === 0 && velocityY === 0)
    return previous.map(function(p) { return Object.assign({}, p, {
      opacity: Math.min(1, p.opacity + dt / 0.25) }); });
  function wrap(value, low, high) {
    var length = high - low;
    return low + ((value - low) % length + length) % length;
  }
  function fade(value, low, high, velocity, fadeSeconds) {
    if (velocity === 0) return 1;
    var distance = Math.min(value - low, high - value);
    // Even very slow crossings must fade all the way out, not teleport a
    // mostly opaque bubble. Scale the fade width with speed instead of alpha.
    var feather = Math.min(48, (high - low) * 0.28, Math.max(1, Math.abs(velocity) * fadeSeconds));
    return smoothUnit(distance / feather);
  }
  return previous.map(function(p, index) {
    var b = layout[index].bounds;
    var delta = flowDisplacement(p, velocityX, velocityY, dt);
    var x = p.x + delta.x, y = p.y + delta.y;
    var crossedX = x < b.minX || x >= b.maxX;
    var crossedY = y < b.minY || y >= b.maxY;
    var recycled = crossedX || crossedY;
    var generation = p.generation + (recycled ? 1 : 0);
    // The outgoing bubble fades to zero at the strip edge. Reuse its slot at
    // the opposite edge, invisible on the wrap frame, then fade the new one in.
    // Change the entry lane only while invisible, never by jittering a live
    // bubble. Keep the original clock/speed so turns and frame rates agree.
    if (crossedX && !crossedY)
      y += (flowRandom(index, generation, 15401, p.seed) - 0.5) * Math.min(36, (b.maxY - b.minY) * .025);
    if (crossedY && !crossedX)
      x += (flowRandom(index, generation, 32771, p.seed) - 0.5) * Math.min(36, (b.maxX - b.minX) * .025);
    x = wrap(x, b.minX, b.maxX);
    y = wrap(y, b.minY, b.maxY);
    var appearance = recycled ? flowAppearance(index, generation, p.seed) : p;
    return Object.assign({}, p, { x: x, y: y, generation: generation, age: p.age + dt,
      scale: appearance.scale, fadeSeconds: appearance.fadeSeconds,
      opacity: recycled ? 0 : fade(x, b.minX, b.maxX, dt ? delta.x / dt : 0, p.fadeSeconds)
        * fade(y, b.minY, b.maxY, dt ? delta.y / dt : 0, p.fadeSeconds) });
  });
}


if (typeof module !== "undefined") module.exports = { bubbleAnchor, flowLayout, flowInitial, flowStep, flowDisplacement };
