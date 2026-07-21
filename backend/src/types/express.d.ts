import { AuthTokenPayload } from "./auth";
import { AuthTerminalTokenPayload } from "./authTerminal";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      terminal?: AuthTerminalTokenPayload;
    }
  }
}

export {};
