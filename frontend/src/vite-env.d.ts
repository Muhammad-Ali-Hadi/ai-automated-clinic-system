/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev only: origin the Vite proxy forwards `/api` to. */
  readonly VITE_BACKEND_ORIGIN?: string;
  /** Production: deployed backend origin, e.g. https://renovia-api.onrender.com */
  readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
