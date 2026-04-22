import os from "os";
import { spawn } from "child_process";

function isPrivateIpv4(ip) {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

function resolveLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(interfaces)) {
    for (const item of entries || []) {
      if (!item || item.family !== "IPv4" || item.internal) continue;
      candidates.push(item.address);
    }
  }

  return candidates.find(isPrivateIpv4) || candidates[0] || null;
}

const ip = resolveLanIp();
const cliArgs = process.argv.slice(2);
const portArgIndex = cliArgs.findIndex((arg) => arg === "--port");
const selectedPort =
  portArgIndex >= 0 && cliArgs[portArgIndex + 1]
    ? cliArgs[portArgIndex + 1]
    : "8082";
const env = {
  ...process.env,
  EXPO_NO_DEPENDENCY_VALIDATION:
    process.env.EXPO_NO_DEPENDENCY_VALIDATION || "1",
};

if (ip) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
  console.log(`[expo] LAN IP detectado: ${ip}`);
  console.log(`[expo] URL do Expo Go deverá usar exp://${ip}:${selectedPort}`);
} else {
  console.warn(
    "[expo] Não foi possível detectar IPv4 local. Iniciando sem REACT_NATIVE_PACKAGER_HOSTNAME."
  );
}

const child = spawn(
  "npx",
  ["expo", "start", "--port", "8082", "--host", "lan", ...cliArgs],
  {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  }
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code || 0);
});
