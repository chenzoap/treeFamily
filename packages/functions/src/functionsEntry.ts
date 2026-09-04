import * as allFunctions from "./index.js";

const {claimTreeOwnership, ...productionFunctions} = allFunctions;

const isEmulator =
  Boolean(process.env.FIREBASE_EMULATOR_HUB) ||
  process.env.FUNCTIONS_EMULATOR === "true";

const firebaseFunctions = isEmulator ?
  {...productionFunctions, claimTreeOwnership} :
  productionFunctions;

export = firebaseFunctions;
