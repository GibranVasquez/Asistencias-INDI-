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

## Verificación

```bash
npm run typecheck
npm run build
npm test
npm run lint
npm run test:e2e
```
