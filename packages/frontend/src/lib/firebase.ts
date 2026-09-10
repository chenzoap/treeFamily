import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const EXPECTED_PROJECT_ID = "tree-gen-chenzoap-2026";

const developmentFirebaseConfig = {
  projectId: EXPECTED_PROJECT_ID,
  apiKey: "fake-api-key-for-emulator",
  authDomain: `${EXPECTED_PROJECT_ID}.firebaseapp.com`,
};

function requireProductionEnv(name: string, value: string | undefined): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing Firebase production configuration: ${name}`);
  }

  return value.trim();
}

function getProductionFirebaseConfig() {
  const projectId = requireProductionEnv(
    "VITE_FIREBASE_PROJECT_ID",
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
  );

  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error("Unexpected Firebase projectId for production configuration");
  }

  return {
    apiKey: requireProductionEnv(
      "VITE_FIREBASE_API_KEY",
      import.meta.env.VITE_FIREBASE_API_KEY,
    ),
    authDomain: requireProductionEnv(
      "VITE_FIREBASE_AUTH_DOMAIN",
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    ),
    projectId,
    storageBucket: requireProductionEnv(
      "VITE_FIREBASE_STORAGE_BUCKET",
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: requireProductionEnv(
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: requireProductionEnv(
      "VITE_FIREBASE_APP_ID",
      import.meta.env.VITE_FIREBASE_APP_ID,
    ),
  };
}

const firebaseConfig = import.meta.env.DEV
  ? developmentFirebaseConfig
  : getProductionFirebaseConfig();

const app = initializeApp(firebaseConfig);

// Inicializar servicios
const db = getFirestore(app);
const functions = getFunctions(app);
const auth = getAuth(app);

// Conexión automática a emuladores si estás en modo desarrollo
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  console.log("🚀 Conectado a los emuladores locales");
}

export { db, functions, auth };
