import net from "net";

/**
 * Encontra uma porta TCP livre começando em `startPort` (incrementa se EADDRINUSE).
 */
export function findFreePort(startPort, maxRange = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (port) => {
      if (port > startPort + maxRange) {
        reject(
          new Error(
            `[expo] Nenhuma porta livre entre ${startPort} e ${startPort + maxRange}. Feche outros "npm start" ou processsos Metro.`
          )
        );
        return;
      }
      const server = net.createServer();
      server.unref();
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          attempt(port + 1);
        } else {
          reject(err);
        }
      });
      server.listen(port, "0.0.0.0", () => {
        const p = server.address().port;
        server.close(() => resolve(p));
      });
    };
    attempt(startPort);
  });
}

/** Remove --port / -p e o valor seguinte para podermos injetar a porta resolvida. */
export function stripPortArgs(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" || args[i] === "-p") {
      i += 1;
      continue;
    }
    out.push(args[i]);
  }
  return out;
}

export function parseDesiredPort(args, defaultPort = 8081) {
  const i = args.findIndex((a) => a === "--port" || a === "-p");
  if (i >= 0 && args[i + 1] && /^\d+$/.test(args[i + 1])) {
    return parseInt(args[i + 1], 10);
  }
  return defaultPort;
}
