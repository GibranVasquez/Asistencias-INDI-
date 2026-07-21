# Verificación manual pendiente: `safeStorage` en Windows

**Por qué existe este archivo:** el fix de `password-store=gnome-libsecret`
en `src/main/index.ts` es específico de Linux (gated por
`process.platform === "linux"`) y fue necesario porque el escritorio de
desarrollo (Hyprland) no es reconocido por la autodetección de Chromium.
En Windows, `safeStorage` usa DPAPI — un backend completamente distinto,
sin dependencia de ningún daemon de terceros, y que según la documentación
de Electron está disponible automáticamente una vez que `app` emite
`ready` (no hace falta ningún fix equivalente).

**Esto NO se ha ejecutado ni verificado en Windows todavía.** Este entorno
de desarrollo es Linux y no hay manera de correr un build de Windows real
desde aquí. No des por cerrado el punto de `safeStorage` hasta marcar esta
lista en un equipo Windows real.

## Cómo verificar

En una máquina Windows con Node y el repo clonado:

```powershell
cd frontend
npm install
npm run build
npm start   # o: node_modules\.bin\electron out\main\index.js
```

1. **`isEncryptionAvailable()` debe dar `true` sin ningún flag extra.**
   Abre las DevTools del proceso principal (o agrega un `console.log`
   temporal en `secureStore.ts`) y confirma que
   `safeStorage.isEncryptionAvailable()` es `true` apenas arranca la app,
   sin necesidad del `password-store` switch (ese switch es Linux-only,
   en Windows no debería ni ejecutarse — confirmar que la rama
   `process.platform === "linux"` efectivamente no corre).

2. **Login con "Recordarme" marcado → cerrar la app por completo → volver
   a abrirla.** Debe entrar directo al Dashboard sin pedir login de nuevo.
   Confirmar que aparece un archivo `sesion.enc` en
   `%APPDATA%\indi-asistencia-frontend\` y que **no** es texto plano (abrir
   con un editor hex o `Get-Content -Encoding Byte` — no debe verse el JWT
   ni ningún fragmentado legible de él).

3. **Login con "Recordarme" desmarcado → cerrar la app → volver a abrirla.**
   Debe pedir login de nuevo (sesión NO restaurada). Confirmar que
   `sesion.enc` **no** existe en ese caso.

4. **Ningún indicador de "sesión no seguía" debe aparecer en los pasos 2 y
   3** — el banner/badge de sesión degradada (`AdminLayout.tsx`,
   `sesionPersistida === false`) es solo para cuando `safeStorage`
   realmente falla. Si aparece en Windows con Recordarme marcado, es un
   bug real que hay que investigar antes de shippear.

5. **(Opcional, más difícil de forzar) Simular una falla real de
   `safeStorage`** — por ejemplo, corriendo la app bajo una cuenta de
   servicio sin perfil de usuario cargado, donde DPAPI puede no estar
   disponible — y confirmar que el login igual funciona (sesión en
   memoria) y que el banner/badge de "sesión no guardada" SÍ aparece.

Marca este archivo como resuelto (o bórralo) una vez confirmados los 4
primeros puntos en un Windows real; el punto 5 es deseable pero no
bloqueante.
