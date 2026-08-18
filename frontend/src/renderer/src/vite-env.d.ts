/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // Solo debe valer "true" en builds de desarrollo/QA (ver .env.development).
  // Controla si el kiosco expone el input manual de trabajadorId como
  // sustituto temporal del lector biometrico real.
  readonly VITE_ENABLE_MODO_PRUEBA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  indiApp?: {
    esKiosco: boolean;
    // Resuelta en tiempo de ejecución por el proceso principal (env var o
    // config.json en userData, ver src/main/apiConfig.ts) — nunca horneada
    // en el build, así el paquete instalado puede apuntar a donde sea que
    // viva el backend sin recompilar.
    apiBaseUrl: string;
    guardarExportacion?: (solicitud: { nombreSugerido: string; formato: "pdf" | "xlsx"; bytes: Uint8Array }) => Promise<{ cancelado: boolean; guardado?: boolean }>;
    sesionSegura: {
      guardar: (valor: string, persistir: boolean) => Promise<void>;
      leer: () => Promise<{ valor: string; persistida: boolean } | null>;
      borrar: () => Promise<void>;
    };
    sesionTerminalSegura: {
      guardar: (valor: string) => Promise<void>;
      leer: () => Promise<string | null>;
      borrar: () => Promise<void>;
    };
  };
}
