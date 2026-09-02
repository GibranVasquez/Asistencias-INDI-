#!/usr/bin/env python3
"""Lectura exclusivamente read-only de terminales ZKTeco compatibles con pyzk."""
import json
import sys
from zk import ZK

def main():
    if len(sys.argv) < 4:
        raise ValueError("uso: zk_readonly.py <operacion> <host> <puerto>")
    operacion, host, puerto = sys.argv[1], sys.argv[2], int(sys.argv[3])
    if operacion == "health":
        print(json.dumps({"ok": True, "serial": "health"})); return
    zk = ZK(host, port=puerto, timeout=10, password=0, ommit_ping=True)
    conn = zk.connect()
    try:
        serial = conn.get_serialnumber()
        if operacion == "info":
            print(json.dumps({"ok": True, "serial": serial, "model": getattr(conn, "get_platform", lambda: None)(), "firmware": getattr(conn, "get_firmware_version", lambda: None)()}, ensure_ascii=False))
            return
        if operacion != "attendance":
            raise ValueError("operacion no permitida")
        registros = []
        for registro in conn.get_attendance():
            registros.append({
                "trabajadorExternoId": str(registro.user_id),
                "fechaHoraLocal": registro.timestamp.strftime("%Y-%m-%dT%H:%M:%S"),
                "codigoCrudo": int(registro.punch) if registro.punch is not None else None,
                "tipoMarcacion": {0:"entrada",1:"salida",2:"salida_descanso",3:"entrada_descanso",4:"entrada_tiempo_extra",5:"salida_tiempo_extra"}.get(int(registro.punch)) if registro.punch is not None else None,
                "metodoVerificacion": None,
                "terminalSerial": serial,
                "eventoOrigenId": None,
                "metadata": {"status": int(registro.status) if registro.status is not None else None},
            })
        print(json.dumps({"ok": True, "serial": serial, "records": registros}, ensure_ascii=False))
    finally:
        conn.disconnect()

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        sys.exit(1)
