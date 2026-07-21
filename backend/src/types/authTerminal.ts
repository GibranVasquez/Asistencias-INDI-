export interface AuthTerminalTokenPayload {
  terminalId: string;
}

export function esAuthTerminalTokenPayload(payload: unknown): payload is AuthTerminalTokenPayload {
  return (
    typeof payload === "object" && payload !== null && typeof (payload as AuthTerminalTokenPayload).terminalId === "string"
  );
}
