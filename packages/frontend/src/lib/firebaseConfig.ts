export const PRODUCTION_PROJECT_ID = "tree-gen-chenzoap-2026";
export const STAGING_PROJECT_ID = "treefamily-staging-2026";

type FirebaseEnvironment = {
  DEV: boolean;
  MODE: string;
  [key: string]: string | boolean | undefined;
};

export function validateFirebaseConfigForBuild(
  mode: string,
  env: Record<string, string | boolean | undefined>,
) {
  // CI compiles production without deploy credentials. Production remains
  // strict when the app initializes; staging is validated before it is emitted.
  if (mode === "staging") {
    getCloudFirebaseConfig({...env, DEV: false, MODE: mode});
  }
}

export function getFirebaseConfig(env: FirebaseEnvironment) {
  if (env.DEV) {
    if (env.MODE === "staging") {
      throw new Error("Staging requires a build; use preview instead of the dev server");
    }
    return {
      projectId: PRODUCTION_PROJECT_ID,
      apiKey: "fake-api-key-for-emulator",
      authDomain: `${PRODUCTION_PROJECT_ID}.firebaseapp.com`,
    };
  }

  return getCloudFirebaseConfig(env);
}

export function getCloudFirebaseConfig(env: FirebaseEnvironment) {
  const staging = env.MODE === "staging";
  const mode = staging ? "staging" : "production";
  const required = (name: string): string => {
    const value = env[name];
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`Missing Firebase ${mode} configuration: ${name}`);
    }
    return value.trim();
  };
  const projectId = required("VITE_FIREBASE_PROJECT_ID");
  if (projectId !== (staging ? STAGING_PROJECT_ID : PRODUCTION_PROJECT_ID)) {
    throw new Error(`Unexpected Firebase projectId for ${mode} configuration`);
  }
  const config = {
    projectId,
    apiKey: required("VITE_FIREBASE_API_KEY"),
    authDomain: required("VITE_FIREBASE_AUTH_DOMAIN"),
    messagingSenderId: required("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: required("VITE_FIREBASE_APP_ID"),
    // Staging does not provision or use Storage.
    ...(staging ? {} : { storageBucket: required("VITE_FIREBASE_STORAGE_BUCKET") }),
  };
  if (staging && (
    config.authDomain !== `${STAGING_PROJECT_ID}.firebaseapp.com` ||
    config.appId !== "1:233536230940:web:67daba2383d8240f69f1d9" ||
    config.messagingSenderId !== "233536230940"
  )) {
    throw new Error("Firebase staging application identity mismatch");
  }
  return config;
}
