GastosApp — Guía de Versionado y Releases
Fecha: 2025-10-13

============================================================
¿QUÉ ES UNA VERSIÓN?
============================================================
Usaremos SemVer (MAJOR.MINOR.PATCH) + etiquetas opcionales.
- MAJOR: cambios incompatibles.
- MINOR: nuevas features compatibles.
- PATCH: correcciones y mejoras internas sin cambios de API.

Ejemplos:
- 0.1.0  → Demo inicial (MVP/POC).
- 0.2.0  → Profundización de Gastos (nuevas features en expenses).
- 0.2.1  → Fixes puntuales en expenses sin cambiar UX/flujo.

Pre‑releases (opcionales, para pruebas internas):
- 0.2.0-rc.1, 0.2.0-beta.2

============================================================
MAPPING CON EAS/EXPO (Android/iOS)
============================================================
app.json / app.config.js
- expo.version          → SemVer visible (iOS: CFBundleShortVersionString)
- android.versionCode   → Entero que SIEMPRE incrementa (1,2,3,…)
- ios.buildNumber       → String numérico que incrementa ("1","2","3",…)

Ejemplo para este release:
- expo.version = "0.2.0"
- android.versionCode = 2
- ios.buildNumber = "2"

============================================================
TAGS, RAMAS Y CHANGELOG
============================================================
- Rama principal: main
- Flujo simple:
  1) Merge a main
  2) Crear tag anotado:   git tag -a v0.2.0 -m "Expenses Deep Dive"
  3) Push del tag:        git push origin v0.2.0

- CHANGELOG.md (manual o automático):
  - Sección por versión, con fecha y subsecciones: Added / Changed / Fixed / Removed / Internal.
  - Fuente: PRs, commits y documentos de resumen del proyecto.

============================================================
NOMBRES HUMANOS PARA CADA RELEASE
============================================================
Puedes asignar un “codename” descriptivo:
- 0.1.0  → "Demo"
- 0.2.0  → "Expenses Deep Dive"
- 0.3.0  → "Balances & Export"

El nombre aparece en el tag de GitHub, en el título del release y en el archivo de notas.

============================================================
CHECKLIST DE RELEASE
============================================================
[ ] Actualizar expo.version / versionCode / buildNumber
[ ] Correr tests básicos y smoke test en Expo Go
[ ] Actualizar CHANGELOG.md (y README si aplica)
[ ] Generar APK/AAB con EAS
[ ] Subir artefacto y publicar notas
[ ] Crear tag git vX.Y.Z
[ ] Marcar hitos en el tablero/Issues

============================================================
CONVENCIÓN DE COMMIT (opcional pero útil)
============================================================
feat:    Nueva funcionalidad
fix:     Corrección de bug
chore:   Tareas internas (deps, scripts)
docs:    Documentación
refactor:Reorganización sin cambiar comportamiento
perf:    Mejora de rendimiento
build:   Cambios de build/CI
ci:      Cambios en pipelines

Ejemplo:  feat(expenses): chips por integrante y tarjeta de contribución

============================================================
VERSION ROADMAP (tentativo)
============================================================
v0.1.0  Demo inicial (Fase 1 + base Fase 2)
v0.2.0  Expenses Deep Dive (filtros por integrante, porcentajes, fade, emojis)
v0.3.0  Balance & Export (CSV por mes, breakdown por categoría/integrante)
v0.4.0  Servicios: historial y recurrencia simple
v1.0.0  Estable con onboarding, i18n y monetización básica
