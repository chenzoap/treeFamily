# Changelog

Este archivo resume los cambios relevantes de cada candidato y release de TreeFamily.

## [0.1.0-rc.1] - 2026-09-10

### Added

- Autenticación local con registro, inicio de sesión, cierre de sesión y creación del perfil/árbol inicial.
- Creación y visualización SVG del árbol familiar con zoom, pan, selección y layout de varias generaciones.
- Modelado de parejas, filiaciones, uniones, coparentalidad, familias monoparentales y roles parentales.
- Flujos seguros para editar y eliminar personas, desvincular relaciones, reasignar progenitores y cambiar el estado de pareja.
- Wrapper local seguro para importar el seed protegido, crear backup previo y exportar cada sesión DEV por separado.
- Cobertura E2E de autenticación, onboarding, mantenimiento y stress de layout/render hasta 100 personas.

### Changed

- Separación explícita de configuración Firebase DEV/producción mediante `VITE_FIREBASE_*`, fail-fast y guard del project ID.
- Normalización del pipeline de uniones y layout para preservar geometría determinista y relaciones válidas.

### Security

- Ownership canónico mediante `tree.ownerId` en Rules y Functions.
- Escrituras directas Firestore bloqueadas; operaciones de mantenimiento canalizadas mediante callables autenticadas.
- Acceso cross-owner y no autenticado cubierto dinámicamente en Rules y Functions.
- `claimTreeOwnership` disponible solo en Emulator; `addPerson` y `addRelationship` retiradas de la API pública.
- Configuración productiva y secretos locales excluidos del repositorio.

### Testing

- Functions: 367/367 tests PASS, lint y build PASS.
- Frontend: 210/210 tests PASS, lint y build PASS.
- Firestore Rules productivas: 7/7 tests PASS.
- E2E Chromium: 16/16 tests PASS, un worker y cero retries.
- Validator de integridad post-E2E: PASS, sin warnings ni errores críticos.

### Known limitations

- RC1 identifica un candidato reproducible; no equivale a deployment productivo.
- El bundle frontend minificado es de aproximadamente 801 kB y supera el warning de 500 kB de Vite.
- El onboarding E2E deja un tree y dos usuarios en la sesión efímera; Stage 8 no deja residuos propios.
- Auth productivo, Firestore remoto, Rules remotas y Functions productivas requieren verificación durante el release controlado.
