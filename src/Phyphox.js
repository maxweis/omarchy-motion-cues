// phyphox adapter. Other providers should produce the same normalized sample shape.
var requestPath = "/get?accX&accY&accZ&acc_time";

function sample(payload) {
  if (!payload || !payload.status || payload.status.measuring !== true)
    throw new Error("Paused: press Play in phyphox");
  function last(key) {
    var entry = payload.buffer && payload.buffer[key];
    var values = entry && entry.buffer;
    var value = Array.isArray(values) && values.length ? values[values.length - 1] : null;
    if (typeof value !== "number" || !isFinite(value)) throw new Error("Invalid sensor data");
    return value;
  }
  var result = { x: last("accX"), y: last("accY"), z: last("accZ"),
                 t: last("acc_time"), session: String(payload.status.session || "") };
  if (result.t < 0 || Math.max(Math.abs(result.x), Math.abs(result.y), Math.abs(result.z)) > 200)
    throw new Error("Sensor reading out of range");
  return result;
}


if (typeof module !== "undefined") module.exports = { sample, requestPath };
