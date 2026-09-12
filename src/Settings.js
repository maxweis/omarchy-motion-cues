// Configuration boundary shared by QML and Node tests.
function localUrl(value) {
  var address = String(value).trim();
  if (/^\d/.test(address)) address = "http://" + address;
  var match = /^http:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::(\d{1,5}))?\/?$/.exec(address);
  if (!match) throw new Error("Use a local address such as http://192.168.1.100:8080");
  var a = match.slice(1, 5).map(Number);
  if (a.some(function(n) { return n > 255; }) ||
      !(a[0] === 10 || (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
        (a[0] === 192 && a[1] === 168) || a[0] === 127))
    throw new Error("The phone address must be on a private network");
  if (match[5] && (+match[5] < 1 || +match[5] > 65535)) throw new Error("Invalid port");
  return "http://" + a.join(".") + (match[5] ? ":" + Number(match[5]) : "");
}

function settings(value) {
  var v = value === undefined ? {} : value;
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Settings must be an object");
  var sensitivity = v.sensitivity === undefined ? 1 : v.sensitivity;
  var size = v.bubbleSize === undefined ? 26 : v.bubbleSize;
  if ([0.5, 1, 1.6].indexOf(sensitivity) < 0) throw new Error("Invalid sensitivity");
  if ([12, 18, 26].indexOf(size) < 0) throw new Error("Invalid bubble size");
  var mount = v.mount === undefined ? "flat" : v.mount;
  if (["flat", "upright"].indexOf(mount) < 0) throw new Error("Invalid phone position");
  var provider = v.provider === undefined ? "auto" : v.provider;
  if (["auto", "phyphox", "gyrosc"].indexOf(provider) < 0) throw new Error("Invalid motion app");
  var port = v.gyroscPort === undefined ? 9999 : v.gyroscPort;
  if (typeof port !== "number" || port % 1 !== 0 || port < 1024 || port > 65535)
    throw new Error("GyrOSC port must be an integer from 1024 to 65535");
  return { url: (v.url === undefined || v.url === "" ? "" : localUrl(v.url)), mount: mount,
           sensitivity: sensitivity, bubbleSize: size, provider: provider, gyroscPort: port };
}


if (typeof module !== "undefined") module.exports = { localUrl, settings };
