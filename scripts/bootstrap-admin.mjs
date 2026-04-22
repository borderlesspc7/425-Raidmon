/**
 * Cria usuário admin no Firebase Auth + documento em Firestore users/{uid}.
 * Usa a mesma API key do app (pública). Rode: node scripts/bootstrap-admin.mjs
 *
 * Se o e-mail já existir no Auth, tenta login e só cria/atualiza o Firestore.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFromDotEnv(name) {
  try {
    const envPath = join(root, ".env");
    const raw = readFileSync(envPath, "utf8");
    const re = new RegExp(`^${name}\\s*=\\s*(\\S+)`, "m");
    const m = raw.match(re);
    if (m) return m[1].trim();
  } catch {
    /* ignore */
  }
  return null;
}

const API_KEY =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
  loadEnvFromDotEnv("EXPO_PUBLIC_FIREBASE_API_KEY");
const PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
  loadEnvFromDotEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID");

if (!API_KEY) {
  console.error(
    "Defina EXPO_PUBLIC_FIREBASE_API_KEY no .env (veja .env.example) ou no ambiente."
  );
  process.exit(1);
}
if (!PROJECT_ID) {
  console.error(
    "Defina EXPO_PUBLIC_FIREBASE_PROJECT_ID no .env (veja .env.example) ou no ambiente."
  );
  process.exit(1);
}

const EMAIL = process.env.ADMIN_EMAIL || "admin@gmail.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "G7!kP2#x";

async function signUp() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        returnSecureToken: true,
      }),
    }
  );
  return res.json().then((data) => ({ ok: res.ok, status: res.status, data }));
}

async function signIn() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        returnSecureToken: true,
      }),
    }
  );
  return res.json().then((data) => ({ ok: res.ok, status: res.status, data }));
}

function ts() {
  return new Date().toISOString();
}

async function upsertUserDoc(uid, idToken) {
  const fields = {
    name: { stringValue: "Administrador" },
    email: { stringValue: EMAIL },
    username: { stringValue: EMAIL.split("@")[0] },
    userType: { stringValue: "admin" },
    cpf: { stringValue: "" },
    rg: { stringValue: "" },
    language: { stringValue: "pt" },
    createdAt: { timestampValue: ts() },
    updatedAt: { timestampValue: ts() },
  };

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?documentId=${uid}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields }),
  });

  if (res.ok) {
    return { created: true, body: await res.json() };
  }

  const errText = await res.text();
  if (res.status === 409 || errText.includes("ALREADY_EXISTS")) {
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=name&updateMask.fieldPaths=userType&updateMask.fieldPaths=updatedAt`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          name: fields.name,
          userType: fields.userType,
          updatedAt: { timestampValue: ts() },
        },
      }),
    });
    const patchBody = await patchRes.text();
    return { created: false, patched: patchRes.ok, patchStatus: patchRes.status, patchBody };
  }

  throw new Error(`Firestore: ${res.status} ${errText}`);
}

async function main() {
  let uid;
  let idToken;

  const signUpResult = await signUp();
  if (signUpResult.ok && signUpResult.data.localId) {
    uid = signUpResult.data.localId;
    idToken = signUpResult.data.idToken;
    console.log("Auth: usuário criado (signUp). uid=", uid);
  } else if (signUpResult.data?.error?.message === "EMAIL_EXISTS") {
    const inResult = await signIn();
    if (!inResult.ok) {
      console.error("signIn falhou:", JSON.stringify(inResult.data, null, 2));
      process.exit(1);
    }
    uid = inResult.data.localId;
    idToken = inResult.data.idToken;
    console.log("Auth: usuário já existia; login ok. uid=", uid);
  } else {
    console.error("signUp falhou:", JSON.stringify(signUpResult.data, null, 2));
    process.exit(1);
  }

  const fsResult = await upsertUserDoc(uid, idToken);
  console.log("Firestore:", fsResult);
  console.log("Pronto. Faça login no app com:", EMAIL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
