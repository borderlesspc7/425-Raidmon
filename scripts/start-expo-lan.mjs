import os from "os";
import { spawn } from "child_process";
import {
  findFreePort,
  stripPortArgs,
  parseDesiredPort,
} from "./expo-dev-utils.mjs";

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

const raw = process.argv.slice(2);
const useOffline = raw.includes("--offline");
const desiredPort = parseDesiredPort(raw, 8081);
let forwardedArgs = stripPortArgs(raw);
if (useOffline) {
  forwardedArgs = forwardedArgs.filter((a) => a !== "--offline");
}

const expoHostArgs = useOffline ? ["--offline"] : ["--lan"];

const buildEnv = (metroPort) => ({
  ...process.env,
  EXPO_NO_DEPENDENCY_VALIDATION:
    process.env.EXPO_NO_DEPENDENCY_VALIDATION || "1",
  // Não definir CI=true: o Expo omite o QR no terminal quando CI está ativo.
  RCT_METRO_PORT: String(metroPort),
  METRO_PORT: String(metroPort),
});

const ip = resolveLanIp();

async function main() {
  const port = await findFreePort(desiredPort);
  const env = buildEnv(port);

  if (ip) {
    env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
    console.log(`[expo] LAN IP detectado: ${ip}`);
    console.log(
      `[expo] Use esta URL no Expo Go (o QR do terminal deve bater com a mesma porta): exp://${ip}:${port}`
    );
  } else {
    console.warn(
      "[expo] Não foi possível detectar IPv4 local. Iniciando sem REACT_NATIVE_PACKAGER_HOSTNAME."
    );
  }

  if (port !== desiredPort) {
    console.log(
      `[expo] Porta ${desiredPort} estava em uso; Metro subiu em ${port} (evita URL errada no QR).`
    );
  }

  console.log(
    [
      "",
      "[expo] No celular: abra o app Expo Go e escaneie o QR pelo leitor DENTRO do app.",
      "     A câmera do sistema abre exp:// no navegador e normalmente NÃO abre o projeto no Expo Go.",
      "[expo] Firewall: libere a porta do Metro (acima) para Node.js na rede privada.",
      "     Se falhar: desative VPN / isolamento de AP no roteador; tente: npm run start:tunnel",
      "[expo] Tela azul no Expo Go: agite o celular (ou vol.) e leia o erro; atualize o app Expo Go (SDK 54).",
      "     Limpe o cache: npm run start:clear  |  Feche outros terminais com Metro (porta 8081/8082).",
      "",
    ].join("\n")
  );

  const child = spawn(
    "npx",
    [
      "expo",
      "start",
      "--port",
      String(port),
      ...expoHostArgs,
      ...forwardedArgs,
    ],
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
