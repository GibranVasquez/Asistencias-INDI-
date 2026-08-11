import express, { Router } from "express";
import { devicecmd, getrequest, handshake, registry, subirDatos } from "../controllers/adms.controller";
import { restringirPorIP } from "../middlewares/restringirPorIP";

export const admsRouter = Router();

// Primera línea de defensa (ver restringirPorIP.ts + CLAUDE.md, sección
// ADMS): el protocolo no tiene autenticación propia, así que esto corre
// ANTES que cualquier otra cosa — ni siquiera llega a resolverTerminalPorSN
// si la IP no está en la lista blanca.
admsRouter.use("/iclock", restringirPorIP);

// El equipo ADMS no manda Content-Type: application/json (manda texto
// plano o nada), así que express.json() global (app.ts) no lo toca —
// pero tampoco alcanza a parsear el cuerpo por nosotros. `type: () => true`
// fuerza a leer el body como texto sin importar qué (o ningún) Content-Type
// traiga la petición.
const cuerpoComoTexto = express.text({ type: () => true });

// Rutas fijas por el firmware del equipo (no configurables de nuestro
// lado) — ver CLAUDE.md para el resto del protocolo ADMS. Sin
// authMiddleware/terminalAuthMiddleware a propósito: el equipo no habla
// JWT en absoluto. resolverTerminalPorSN (dentro de cada controller) es
// la única verificación, y no es autenticación fuerte — ver ese mismo
// comentario en adms.service.ts.
admsRouter.get("/iclock/cdata", handshake);
admsRouter.post("/iclock/cdata", cuerpoComoTexto, subirDatos);
admsRouter.get("/iclock/getrequest", getrequest);
admsRouter.post("/iclock/devicecmd", cuerpoComoTexto, devicecmd);
admsRouter.get("/iclock/registry", registry);
admsRouter.post("/iclock/registry", cuerpoComoTexto, registry);
