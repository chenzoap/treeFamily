import {setGlobalOptions} from "firebase-functions/v2/options";

// Applied before release exports are constructed; never affects production/local.
if (
  process.env.GCLOUD_PROJECT === "treefamily-staging-2026" &&
  !process.env.FIREBASE_EMULATOR_HUB &&
  process.env.FUNCTIONS_EMULATOR !== "true"
) {
  setGlobalOptions({
    region: "us-central1",
    minInstances: 0,
    maxInstances: 1,
    memory: "256MiB",
    cpu: "gcf_gen1",
    concurrency: 1,
    timeoutSeconds: 60,
    invoker: "public",
  });
}
