import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAuth, connectAuthEmulator } from "firebase/auth";

import { getFirebaseConfig, getCloudFirebaseConfig } from "./firebaseConfig";

const firebaseConfig = import.meta.env.DEV
  ? getFirebaseConfig(import.meta.env)
  : getCloudFirebaseConfig(import.meta.env);

const app = initializeApp(firebaseConfig);

// Inicializar servicios
const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");
const auth = getAuth(app);

// Conexión automática a emuladores si estás en modo desarrollo
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  console.log("🚀 Conectado a los emuladores locales");
}

export { db, functions, auth };
