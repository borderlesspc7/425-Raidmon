import { spawn } from "child_process";
import {
  findFreePort,
  stripPortArgs,
  parseDesiredPort,
} from "./expo-dev-utils.mjs";

/**
 * Tunnel via ngrok (útil quando LAN/firewall bloqueia). Não use --lan ao mesmo tempo.
 */
const raw = process.argv.slice(2);
const desiredPort = parseDesiredPort(raw, 8081);
const forwardedArgs = stripPortArgs(raw);

async function main() {
  const port = await findFreePort(desiredPort);

  console.log(`[expo] Modo tunnel — Metro na porta local ${port}`);
  console.log(
    "[expo] A primeira conexão pode demorar (ngrok). É preciso internet; antivírus/firewall podem bloquear."
  );
  if (port !== desiredPort) {
    console.log(
      `[expo] Porta ${desiredPort} em uso; usando ${port}.`
    );
  }

  const env = {
    ...process.env,
    EXPO_NO_DEPENDENCY_VALIDATION:
      process.env.EXPO_NO_DEPENDENCY_VALIDATION || "1",
    RCT_METRO_PORT: String(port),
    METRO_PORT: String(port),
  };

  const child = spawn(
    "npx",
    ["expo", "start", "--port", String(port), "--tunnel", ...forwardedArgs],
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
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
