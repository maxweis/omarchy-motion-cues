// Provider-independent motion filtering. Acceleration: m/s^2; time: seconds; display: logical pixels.
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

function initial() {
  return { time: null, session: "", x: 0, y: 0, intensity: 0,
           velocityX: 0, velocityY: 0,
           reflectionX: 0, reflectionY: 0, reflectionDepth: 0, fresh: false };
}

function step(previous, value, config) {
  // Seed the clock first. A cached sample alone must never make the overlay live.
  if (previous.time === null || value.session !== previous.session || value.t < previous.time)
    return Object.assign(initial(), { time: value.t, session: value.session });
  if (value.t === previous.time)
    return Object.assign({}, previous, { fresh: false });
  var dt = clamp(value.t - previous.time, 0.001, 0.15);
  var alpha = 1 - Math.exp(-dt / 0.13);
  var speedAlpha = 1 - Math.exp(-dt / 0.22);
  function quiet(a) { return Math.abs(a) < 0.045 ? 0 : a; }
  // Flat: screen up, top edge forward. Upright: screen toward passenger, top up.
  // Sideways acceleration shifts dots oppositely; forward acceleration shifts down.
  var forward = config.mount === "upright" ? -value.z : value.y;
  // Acceleration controls cue speed, not an ever-growing velocity estimate.
  // A sustained turn keeps flowing; stopping the acceleration stops the flow.
  function speed(a, previousSpeed) {
    var target = Math.abs(a) < 0.12 ? 0 : clamp(a * 75 * config.sensitivity, -180, 180);
    var result = previousSpeed + speedAlpha * (target - previousSpeed);
    return target === 0 && Math.abs(result) < 0.5 ? 0 : result;
  }
  var targetX = clamp(-quiet(value.x) * 30 * config.sensitivity, -46, 46);
  var targetY = clamp(quiet(forward) * 30 * config.sensitivity, -46, 46);
  // All three axes contribute to density, including vertical bumps. Cap the
  // envelope so a single spike cannot keep extra bubbles on screen for ages.
  var magnitude = Math.sqrt(value.x * value.x + value.y * value.y + value.z * value.z);
  var strength = clamp(magnitude * config.sensitivity, 0, 6);
  var envelopeAlpha = 1 - Math.exp(-dt / (strength > previous.intensity ? 0.18 : 0.55));
  var lightX = -quiet(value.x) * config.sensitivity / 3;
  var lightY = quiet(forward) * config.sensitivity / 3;
  var length = Math.max(1, Math.sqrt(lightX * lightX + lightY * lightY));
  var depth = config.mount === "upright" ? value.y : value.z;
  return { time: value.t, session: value.session,
           x: previous.x + alpha * (targetX - previous.x),
           y: previous.y + alpha * (targetY - previous.y),
           velocityX: speed(-value.x, previous.velocityX),
           velocityY: speed(forward, previous.velocityY),
           intensity: previous.intensity + envelopeAlpha * (strength - previous.intensity),
           reflectionX: previous.reflectionX + alpha * (lightX / length - previous.reflectionX),
           reflectionY: previous.reflectionY + alpha * (lightY / length - previous.reflectionY),
           reflectionDepth: previous.reflectionDepth + alpha * (clamp(depth / 3, -1, 1) - previous.reflectionDepth),
           fresh: true };
}

// Five balanced groups of four appear progressively. Soft thresholds plus the
// slower envelope release avoid rapid popping around an acceleration threshold.
var densityThresholds = [0.8, 1.3, 1.9, 2.6, 3.4];
function extraOpacity(intensity, index) {
  if (index < 0 || index >= 20) return 0;
  var threshold = densityThresholds[Math.floor(index / 4)];
  var t = clamp((intensity - threshold) / 0.45, 0, 1);
  return Math.round(t * t * (3 - 2 * t) * 100) / 100;
}

function extraCount(intensity) {
  var count = 0;
  for (var i = 0; i < 20; i++) if (extraOpacity(intensity, i) > 0.05) count++;
  return count;
}

function isFresh(lastAdvance, now) { return lastAdvance > 0 && now - lastAdvance < 900; }


if (typeof module !== "undefined") module.exports = { initial, step, isFresh, extraOpacity, extraCount };
