\set ON_ERROR_STOP on
INSERT INTO obras (id, nombre) VALUES ('10000000-0000-4000-8000-000000000001', 'Obra ficticia México');
INSERT INTO horarios (id,nombre,hora_entrada,hora_salida,tolerancia_minutos) VALUES ('11000000-0000-4000-8000-000000000001','Horario ficticio','08:00','18:00',10);
INSERT INTO secciones (id,obra_id,nombre,horario_id) VALUES ('12000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Frente ficticio','11000000-0000-4000-8000-000000000001');
INSERT INTO categorias_trabajador (id,nombre,sueldo_base_default,es_default) VALUES ('13000000-0000-4000-8000-000000000001','Categoría ficticia',700.00,true);
INSERT INTO trabajadores (id,nombre_completo,categoria,jefe_inmediato,fecha_ingreso,sueldo_base,numero_checador,estatus)
SELECT ('20000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, 'Persona Ficticia '||lpad(i::text,3,'0'), 'Categoría ficticia', 'Jefatura ficticia', DATE '2026-01-01', 700 + i, 10000+i,
       CASE WHEN i > 132 THEN 'baja'::trabajador_estatus ELSE 'activo'::trabajador_estatus END
FROM generate_series(1,137) i;
INSERT INTO usuarios (id,username,password_hash,rol,trabajador_id) VALUES
('30000000-0000-4000-8000-000000000001','migration-trabajador','$2b$04$GRzsVinQ0WFCQ4cWefAwfONRH4xMw2dvEvL84H0yW7eiEq4YK0pza','trabajador','20000000-0000-4000-8000-000000000001'),
('30000000-0000-4000-8000-000000000002','migration-recepcion','$2b$04$GRzsVinQ0WFCQ4cWefAwfONRH4xMw2dvEvL84H0yW7eiEq4YK0pza','recepcion',NULL),
('30000000-0000-4000-8000-000000000003','migration-encargado','$2b$04$GRzsVinQ0WFCQ4cWefAwfONRH4xMw2dvEvL84H0yW7eiEq4YK0pza','encargado_seccion',NULL),
('30000000-0000-4000-8000-000000000004','migration-rh','$2b$04$GRzsVinQ0WFCQ4cWefAwfONRH4xMw2dvEvL84H0yW7eiEq4YK0pza','rh',NULL),
('30000000-0000-4000-8000-000000000005','migration-admin','$2b$04$GRzsVinQ0WFCQ4cWefAwfONRH4xMw2dvEvL84H0yW7eiEq4YK0pza','administrador',NULL);
INSERT INTO "_SeccionEncargados" ("A","B") VALUES ('12000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003');
INSERT INTO terminales (id,username,password_hash,tipo,ubicacion,numero_serie,activo) VALUES
('40000000-0000-4000-8000-000000000001','migration-kiosco','$2b$04$GRzsVinQ0WFCQ4cWefAwfONRH4xMw2dvEvL84H0yW7eiEq4YK0pza','kiosco','Ubicación ficticia',NULL,true),
('40000000-0000-4000-8000-000000000002','migration-adms','$2b$04$GRzsVinQ0WFCQ4cWefAwfONRH4xMw2dvEvL84H0yW7eiEq4YK0pza','adms','Ubicación ficticia','SN-MIGRATION-TEST',true);
INSERT INTO tipos_movimiento (id,nombre,cuenta_como_dia_trabajado,es_informativo,requiere_autorizacion) VALUES ('50000000-0000-4000-8000-000000000001','Permiso ficticio',true,false,false);
INSERT INTO tarifas_hora_extra (id,valor,vigente_desde) VALUES ('51000000-0000-4000-8000-000000000001',100,DATE '2026-01-01');
INSERT INTO asistencias_diarias (id,trabajador_id,fecha,hora,seccion_id,turno,metodo_usado,terminal_origen_id)
SELECT ('60000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid, ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid, DATE '2026-08-03','08:00','12000000-0000-4000-8000-000000000001','Día','huella','40000000-0000-4000-8000-000000000001' FROM generate_series(1,100) i;
INSERT INTO movimientos_trabajador (id,trabajador_id,tipo_movimiento_id,fecha_inicio,fecha_fin) SELECT ('61000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'50000000-0000-4000-8000-000000000001',DATE '2026-08-04',DATE '2026-08-04' FROM generate_series(1,20) i;
INSERT INTO nominas_semanales (id,trabajador_id,periodo_inicio,periodo_fin,dias_laborados,monto_sueldo,horas_extra,monto_horas_extra,viaticos_semanal,viaticos_mensual,infonavit_descuento,descuentos_varios,total_a_pagar,estatus)
SELECT ('62000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,DATE '2026-08-03',DATE '2026-08-09',5,500,2,200,50,0,0,25,725,'pendiente' FROM generate_series(1,30) i;
INSERT INTO asignaciones_diarias (id,trabajador_id,seccion_id,fecha,asignado_por) SELECT ('63000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'12000000-0000-4000-8000-000000000001',DATE '2026-08-03','30000000-0000-4000-8000-000000000003' FROM generate_series(1,40) i;
INSERT INTO eventos_no_reconciliados (id,terminal_id,pin_dispositivo,marcado_en,metodo_crudo) VALUES ('64000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','PIN-FICTICIO',TIMESTAMPTZ '2026-08-03 14:00:00Z','1');
INSERT INTO audit_log (id,usuario_id,accion,entidad,entidad_id,detalle) VALUES ('65000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','ensayo_migracion','Trabajador','20000000-0000-4000-8000-000000000001','{"ficticio":true}');
