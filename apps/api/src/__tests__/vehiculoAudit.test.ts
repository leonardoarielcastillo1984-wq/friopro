import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  accionPorCambios, cambiosDeAlta, diffVehiculo,
  ACCIONES_CON_MOTIVO, tzParaPais,
} from '../services/vehiculoAudit.js';

describe('diffVehiculo — solo cambios reales', () => {
  const base = {
    dominio: 'AB123CD', tipo: 'CAMION', marca: 'Scania', modelo: 'R450',
    anio: 2021, color: 'Blanco', chasis: 'CH1', motor: 'M1',
    status: 'ACTIVO', currentOdometer: 100000, notas: '',
  };

  it('no genera cambios si se guarda el formulario sin modificar nada', () => {
    const cambios = diffVehiculo(base, { ...base });
    assert.equal(cambios.length, 0);
  });

  it('detecta edición de campos maestros con antes/después', () => {
    const cambios = diffVehiculo(base, { ...base, marca: 'Volvo', anio: 2022 });
    assert.equal(cambios.length, 2);
    const marca = cambios.find((c) => c.campo === 'marca')!;
    assert.equal(marca.etiqueta, 'Marca');
    assert.equal(marca.antesTxt, 'Scania');
    assert.equal(marca.despuesTxt, 'Volvo');
    assert.equal(cambios.find((c) => c.campo === 'anio')!.antes, 2021);
  });

  it('traduce claves técnicas de estado a español', () => {
    const cambios = diffVehiculo(base, { ...base, status: 'BAJA' });
    const s = cambios.find((c) => c.campo === 'status')!;
    assert.equal(s.antesTxt, 'Activo');
    assert.equal(s.despuesTxt, 'Baja');
  });

  it('trata "100" (string) igual que 100 (número): no es un cambio', () => {
    const cambios = diffVehiculo(base, { ...base, currentOdometer: '100000' as any });
    assert.equal(cambios.length, 0);
  });

  it('ignora campos que no son del maestro (passthrough)', () => {
    const cambios = diffVehiculo(base, { ...base, purchaseDate: '2020-01-01' } as any);
    assert.equal(cambios.length, 0);
  });
});

describe('accionPorCambios — prioridad de acción', () => {
  it('sin cambio de status → EDICION', () => {
    const cambios = diffVehiculo({ marca: 'A', status: 'ACTIVO' }, { marca: 'B', status: 'ACTIVO' });
    assert.equal(accionPorCambios(cambios, 'ACTIVO'), 'EDICION');
  });
  it('status → BAJA ⇒ BAJA', () => {
    const cambios = diffVehiculo({ status: 'ACTIVO' }, { status: 'BAJA' });
    assert.equal(accionPorCambios(cambios, 'ACTIVO'), 'BAJA');
  });
  it('desde BAJA a otro estado ⇒ REACTIVACION', () => {
    const cambios = diffVehiculo({ status: 'BAJA' }, { status: 'ACTIVO' });
    assert.equal(accionPorCambios(cambios, 'BAJA'), 'REACTIVACION');
  });
  it('ACTIVO → INACTIVO ⇒ CAMBIO_ESTADO', () => {
    const cambios = diffVehiculo({ status: 'ACTIVO' }, { status: 'INACTIVO' });
    assert.equal(accionPorCambios(cambios, 'ACTIVO'), 'CAMBIO_ESTADO');
  });
  it('las acciones de estado exigen motivo', () => {
    assert.equal(ACCIONES_CON_MOTIVO.has('BAJA'), true);
    assert.equal(ACCIONES_CON_MOTIVO.has('REACTIVACION'), true);
    assert.equal(ACCIONES_CON_MOTIVO.has('CAMBIO_ESTADO'), true);
    assert.equal(ACCIONES_CON_MOTIVO.has('EDICION'), false);
    assert.equal(ACCIONES_CON_MOTIVO.has('ALTA'), false);
  });
});

describe('cambiosDeAlta — valores iniciales', () => {
  it('registra solo campos con valor y con antes vacío', () => {
    const cambios = cambiosDeAlta({ dominio: 'AA111', tipo: 'SEMI', marca: null });
    const dominio = cambios.find((c) => c.campo === 'dominio')!;
    assert.equal(dominio.antes, null);
    assert.equal(dominio.despuesTxt, 'AA111');
    assert.equal(cambios.find((c) => c.campo === 'marca'), undefined);
    const tipo = cambios.find((c) => c.campo === 'tipo')!;
    assert.equal(tipo.despuesTxt, 'Semirremolque');
  });
});

describe('tzParaPais — zona horaria por país del tenant', () => {
  it('AR → Buenos Aires', () => assert.equal(tzParaPais('AR'), 'America/Argentina/Buenos_Aires'));
  it('CL → Santiago', () => assert.equal(tzParaPais('CL'), 'America/Santiago'));
  it('default (sin país) → Buenos Aires', () => assert.equal(tzParaPais(null), 'America/Argentina/Buenos_Aires'));
});
