import { describe, expect, it } from 'vitest';
import {
  getFirebaseConfig,
  PRODUCTION_PROJECT_ID,
  STAGING_PROJECT_ID,
  validateFirebaseConfigForBuild,
} from './firebaseConfig';

const staging = {
  DEV: false,
  MODE: 'staging',
  VITE_FIREBASE_PROJECT_ID: STAGING_PROJECT_ID,
  VITE_FIREBASE_API_KEY: 'public-sdk-key',
  VITE_FIREBASE_AUTH_DOMAIN: `${STAGING_PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_MESSAGING_SENDER_ID: '233536230940',
  VITE_FIREBASE_APP_ID: '1:233536230940:web:67daba2383d8240f69f1d9',
};
const production = {
  ...staging,
  MODE: 'production',
  VITE_FIREBASE_PROJECT_ID: PRODUCTION_PROJECT_ID,
  VITE_FIREBASE_AUTH_DOMAIN: `${PRODUCTION_PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_STORAGE_BUCKET: `${PRODUCTION_PROJECT_ID}.firebasestorage.app`,
  VITE_FIREBASE_MESSAGING_SENDER_ID: '72998121513',
  VITE_FIREBASE_APP_ID: '1:72998121513:web:d7601a0590ef5943c56c38',
};
describe('Firebase environment isolation', () => {
  it('accepts the actual staging app without provisioning Storage', () => {
    expect(getFirebaseConfig(staging).projectId).toBe(STAGING_PROJECT_ID);
    expect(getFirebaseConfig(staging)).not.toHaveProperty('storageBucket');
  });
  it('preserves production configuration', () => {
    expect(getFirebaseConfig(production).projectId).toBe(PRODUCTION_PROJECT_ID);
  });
  it('allows a config-free production compile while runtime validation remains strict', () => {
    expect(() => validateFirebaseConfigForBuild('production', {})).not.toThrow();
    expect(() => getFirebaseConfig({DEV:false, MODE:'production'})).toThrow(
      'Missing Firebase production configuration: VITE_FIREBASE_PROJECT_ID',
    );
  });
  it('requires configuration for every staging build', () => {
    expect(() => validateFirebaseConfigForBuild('staging', {})).toThrow(
      'Missing Firebase staging configuration: VITE_FIREBASE_PROJECT_ID',
    );
  });
  it('rejects production identity during staging build validation', () => {
    expect(() => validateFirebaseConfigForBuild('staging', production)).toThrow(
      'Unexpected Firebase projectId for staging configuration',
    );
  });
  it.each([STAGING_PROJECT_ID, 'another-project'])('rejects foreign production project %s', project => {
    expect(() => getFirebaseConfig({...production, VITE_FIREBASE_PROJECT_ID:project})).toThrow();
  });
  it.each([PRODUCTION_PROJECT_ID, 'another-project'])('rejects foreign staging project %s', project => {
    expect(() => getFirebaseConfig({...staging, VITE_FIREBASE_PROJECT_ID:project})).toThrow();
  });
  it.each(Object.keys(staging).filter(key => key.startsWith('VITE_')))('rejects missing staging %s', key => {
    expect(() => getFirebaseConfig({...staging, [key]:' '})).toThrow();
  });
  it.each(['VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'] as const)('rejects production %s in staging', key => {
    expect(() => getFirebaseConfig({...staging, [key]:production[key]})).toThrow();
  });
  it('keeps local emulator defaults even when cloud variables exist', () => {
    expect(getFirebaseConfig({...production, DEV:true, MODE:'development'})).toEqual({
      projectId:PRODUCTION_PROJECT_ID,
      apiKey:'fake-api-key-for-emulator',
      authDomain:`${PRODUCTION_PROJECT_ID}.firebaseapp.com`,
    });
  });
  it('rejects vite dev --mode staging', () => {
    expect(() => getFirebaseConfig({...staging, DEV:true})).toThrow();
  });
  it('does not turn arbitrary modes into staging', () => {
    expect(() => getFirebaseConfig({...staging, MODE:'preview'})).toThrow();
  });
});
