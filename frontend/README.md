# Frontend de INDI Asistencia

Aplicación Electron con React. El proceso principal y el preload permanecen
separados del renderer:

```text
src/
├── main/                  # Ventana, CSP, configuración e IPC seguro
├── preload/               # API expuesta al renderer
└── renderer/src/
    ├── app/               # Bootstrap, providers y estados globales
    ├── core/              # Cliente HTTP y configuración transversal
    ├── features/          # Módulos funcionales y sus APIs/componentes
    ├── layouts/           # Estructura visual administrativa
    ├── routes/            # Rutas y configuración única de navegación
    ├── shared/            # Componentes, hooks y recursos reutilizables
    └── styles/            # Tema, motion y estilos globales
```

## Convenciones

- `@/` apunta a `src/renderer/src/` en TypeScript, electron-vite y Vitest.
- Cada módulo vive en `features/<modulo>`; su cliente de endpoints se mantiene
  junto al módulo y reutiliza `core/api/client.ts`.
- Los componentes solo compartidos por un módulo permanecen dentro de ese
  feature. `shared/` no debe importar desde `features/`.
- Las rutas, etiquetas, roles, iconos, grupos y orden del menú se agregan en
  `routes/navigationConfig.tsx`; el árbol del router vive en `routes/AppRoutes.tsx`.
  El backend continúa siendo la autoridad efectiva de autorización.
- El Kiosco usa su propio feature y no depende de `AdminLayout`.

## Terminología de asistencia

La pantalla principal de `features/asistencias` se presenta como **Lista
semanal de asistencia**. Reutiliza el rango existente de `/asistencias`,
agrupa las marcaciones por trabajador y día y conserva una vista secundaria de
`Registros`. Una hora se muestra como marcación; el sistema no la etiqueta como
entrada o salida porque el modelo actual no guarda ese tipo de evento.

`Seccion` se presenta como `Frente`, `Trabajador.categoria` es la referencia
actual para categoría/puesto y `Horario` pertenece a una sección. Área, tramo,
ubicación y responsable no se inventan en esta vista: requieren definición o
datos adicionales de operación.

## Verificación

```bash
npm run typecheck
npm run build
npm test
npm run lint
npm run test:e2e
```
