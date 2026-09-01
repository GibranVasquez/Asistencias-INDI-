# Adapter local ZKTeco

`zk_readonly.py` es un helper de lectura para el MVP. En la laptop de
desarrollo se selecciona el intérprete mediante `INDI_ZK_PYTHON` (por ejemplo,
un entorno que tenga `pyzk`). El helper solo consulta serial, plataforma,
firmware y `get_attendance()`; nunca borra ni modifica datos del equipo.

Para el release Windows final se debe empaquetar un ejecutable autocontenido
(por ejemplo con PyInstaller) como `extraResource` en lugar de depender de
Python instalado por el usuario. La interfaz `TerminalAdapter` no cambia.
