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
    sesionSegura: {
      guardar: (valor: string, persistir: boolean) => Promise<void>;
      leer: () => Promise<{ valor: string; persistida: boolean } | null>;
      borrar: () => Promise<void>;
    };
  };
}
