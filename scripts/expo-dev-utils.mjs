import net from "net";

/**
 * Encontra uma porta TCP livre começando em `startPort` (incrementa se EADDRINUSE).
 */
export function findFreePort(startPort, maxRange = 40) {
  return new Promise((resolve, reject) => {
    const tryListen = (port, host) =>
      new Promise((res, rej) => {
        const server = net.createServer();
        server.unref();
        server.once("error", (err) => {
          server.close(() => {
            rej(err);
          });
        });
        server.listen(port, host, () => {
          server.close(() => res(true));
        });
      });

    const isPortFree = async (port) => {
      // Expo costuma validar disponibilidade em stacks diferentes (IPv4/IPv6).
      // Se qualquer stack já estiver ocupada, consideramos a porta indisponível.
      try {
        await tryListen(port, "0.0.0.0");
        try {
          await tryListen(port, "::");
        } catch (ipv6Err) {
          if (ipv6Err?.code !== "EAFNOSUPPORT") {
            return false;
          }
        }
        return true;
      } catch (err) {
        if (err?.code === "EADDRINUSE") {
          return false;
        }
        throw err;
      }
    };

    const attempt = async (port) => {
      if (port > startPort + maxRange) {
        reject(
          new Error(
            `[expo] Nenhuma porta livre entre ${startPort} e ${startPort + maxRange}. Feche outros "npm start" ou processsos Metro.`
          )
        );
        return;
      }

      try {
        const free = await isPortFree(port);
        if (free) {
          resolve(port);
          return;
        }
        attempt(port + 1);
      } catch (err) {
        reject(err);
      }
    };
    void attempt(startPort);
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
