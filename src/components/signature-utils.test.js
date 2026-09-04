import { describe, it, expect } from 'vitest';
import { verifySignatureForElement, getSignatureStatusDisplay, getEmissionStage, EMISSION_STAGE_LABELS } from './signature-utils';
import { hasRealFixtures, availableRealFixtures, loadRealFixture } from '../../test/helpers/fixtures';

const parse = (xml) => new DOMParser().parseFromString(xml, 'text/xml');

describe('verifySignatureForElement — casos sintéticos', () => {
  it('devuelve hasSignature:false si el elemento no existe', async () => {
    const doc = parse('<root></root>');
    const status = await verifySignatureForElement(doc, 'DJO');
    expect(status.hasSignature).toBe(false);
    expect(status.error).toMatch(/No se encontró el elemento/);
  });

  it('devuelve hasSignature:false si el elemento existe pero no tiene firma', async () => {
    const doc = parse('<root><DJO id="DJO">contenido</DJO></root>');
    const status = await verifySignatureForElement(doc, 'DJO');
    expect(status.hasSignature).toBe(false);
    expect(status.error).toMatch(/No se encontró firma digital/);
  });

  it('detecta firmas duplicadas para el mismo elemento', async () => {
    const sig = (uri) => `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:Reference URI="${uri}"/></ds:SignedInfo></ds:Signature>`;
    const doc = parse(`<root><DJO id="DJO">c</DJO>${sig('#DJO')}${sig('#DJO')}</root>`);
    const status = await verifySignatureForElement(doc, 'DJO');
    expect(status.hasSignature).toBe(true);
    expect(status.duplicateSignatures).toBe(true);
  });

  it('certValidityKnown es false si no hay fecha de referencia en el XML (no debe asumir que es válido)', async () => {
    const doc = parse(
      '<root><DJO id="DJO">c</DJO>' +
      '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:Reference URI="#DJO"/></ds:SignedInfo></ds:Signature>' +
      '</root>'
    );
    const status = await verifySignatureForElement(doc, 'DJO');
    expect(status.hasSignature).toBe(true);
    expect(status.certValidityKnown).toBe(false);
    expect(status.certExpired).toBe(false);
    expect(status.certNotYetValid).toBe(false);
  });

  it('usa ApprovalDate como fecha de referencia para DJOEH', async () => {
    const doc = parse(
      '<root><DJOEH id="DJOEH">c</DJOEH><ApprovalDate>2024-05-01T00:00:00</ApprovalDate>' +
      '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:Reference URI="#DJOEH"/></ds:SignedInfo></ds:Signature>' +
      '</root>'
    );
    const status = await verifySignatureForElement(doc, 'DJOEH');
    expect(status.referenceDateSource).toBe('ApprovalDate');
    expect(status.referenceDate.toISOString()).toBe('2024-05-01T00:00:00.000Z');
  });
});

describe('getSignatureStatusDisplay', () => {
  it('severidad "warning" y texto correspondiente cuando no hay firma', () => {
    const display = getSignatureStatusDisplay({ hasSignature: false, error: 'No se encontró firma digital para el elemento: DJO' });
    expect(display.severity).toBe('warning');
    expect(display.text).toContain('No se encontró firma digital');
  });

  it('severidad "error" cuando el certificado no estaba vigente al firmar', () => {
    const display = getSignatureStatusDisplay({
      hasSignature: true,
      signerName: 'Alguien',
      signatureAlgorithm: 'RSA-SHA256',
      signatureAlgorithmWeak: false,
      digestAlgorithm: 'SHA-256',
      certNotBefore: new Date('2020-01-01T00:00:00Z'),
      certNotAfter: new Date('2020-06-01T00:00:00Z'),
      referenceDate: new Date('2021-01-01T00:00:00Z'),
      referenceDateSource: 'DeclarationDate',
      certValidityKnown: true,
      certExpired: true,
      certNotYetValid: false,
      duplicateSignatures: false,
    });
    expect(display.severity).toBe('error');
    expect(display.text).toMatch(/NO estaba vigente/);
  });

  it('severidad "warning" (no "error") por algoritmo débil aunque el certificado sí estuviera vigente', () => {
    const display = getSignatureStatusDisplay({
      hasSignature: true,
      signerName: 'Alguien',
      signatureAlgorithm: 'RSA-SHA1',
      signatureAlgorithmWeak: true,
      digestAlgorithm: 'SHA-1',
      certNotBefore: new Date('2020-01-01T00:00:00Z'),
      certNotAfter: new Date('2022-01-01T00:00:00Z'),
      referenceDate: new Date('2021-01-01T00:00:00Z'),
      referenceDateSource: 'DeclarationDate',
      certValidityKnown: true,
      certExpired: false,
      certNotYetValid: false,
      duplicateSignatures: false,
    });
    expect(display.severity).toBe('warning');
  });

  it('severidad "ok" para una firma fuerte y vigente al momento de firmar', () => {
    const display = getSignatureStatusDisplay({
      hasSignature: true,
      signerName: 'Alguien',
      signatureAlgorithm: 'RSA-SHA256',
      signatureAlgorithmWeak: false,
      digestAlgorithm: 'SHA-256',
      certNotBefore: new Date('2020-01-01T00:00:00Z'),
      certNotAfter: new Date('2022-01-01T00:00:00Z'),
      referenceDate: new Date('2021-01-01T00:00:00Z'),
      referenceDateSource: 'DeclarationDate',
      certValidityKnown: true,
      certExpired: false,
      certNotYetValid: false,
      duplicateSignatures: false,
    });
    expect(display.severity).toBe('ok');
  });

  it('severidad "error" y alerta clara cuando integrityValid es false (documento editado post-firma)', () => {
    const display = getSignatureStatusDisplay({
      hasSignature: true,
      signerName: 'Alguien',
      signatureAlgorithm: 'RSA-SHA256',
      signatureAlgorithmWeak: false,
      digestAlgorithm: 'SHA-256',
      certNotBefore: new Date('2020-01-01T00:00:00Z'),
      certNotAfter: new Date('2022-01-01T00:00:00Z'),
      referenceDate: new Date('2021-01-01T00:00:00Z'),
      referenceDateSource: 'DeclarationDate',
      certValidityKnown: true,
      certExpired: false,
      certNotYetValid: false,
      duplicateSignatures: false,
      integrityValid: false,
    });
    expect(display.severity).toBe('error');
    expect(display.text).toMatch(/modificado después de haber sido firmado/);
    expect(display.text).toMatch(/INVÁLIDA/);
  });

  it('confirma la integridad cuando integrityValid es true', () => {
    const display = getSignatureStatusDisplay({
      hasSignature: true, signerName: 'Alguien', signatureAlgorithm: 'RSA-SHA256',
      signatureAlgorithmWeak: false, digestAlgorithm: 'SHA-256', duplicateSignatures: false,
      integrityValid: true,
    });
    expect(display.text).toMatch(/Integridad verificada/);
    expect(display.severity).toBe('ok');
  });

  it('no afirma nada cuando integrityValid es null/undefined (no se pudo determinar)', () => {
    const display = getSignatureStatusDisplay({
      hasSignature: true, signerName: 'Alguien', signatureAlgorithm: 'RSA-SHA256',
      signatureAlgorithmWeak: false, digestAlgorithm: 'SHA-256', duplicateSignatures: false,
    });
    expect(display.text).toMatch(/No se pudo verificar criptográficamente/);
    expect(display.severity).toBe('ok');
  });

  it('menciona S-FiDE como sugerencia de aplicación alternativa', () => {
    const display = getSignatureStatusDisplay({
      hasSignature: true, signerName: 'Alguien', signatureAlgorithm: 'RSA-SHA256',
      signatureAlgorithmWeak: false, digestAlgorithm: 'SHA-256', duplicateSignatures: false,
    });
    expect(display.text).toContain('S-FiDE');
  });
});

describe('getEmissionStage', () => {
  const sig = (uri) => `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:Reference URI="${uri}"/></ds:SignedInfo></ds:Signature>`;

  it('etapa 1: borrador sin firmar', () => {
    const doc = parse('<DJOEH id="DJOEH"><DJOExporter><DJO id="DJO"></DJO></DJOExporter></DJOEH>');
    expect(getEmissionStage(doc)).toEqual({ stage: 1, label: EMISSION_STAGE_LABELS[1] });
  });

  it('etapa 2: firmado por el Exportador, sin datos de la EH', () => {
    const doc = parse(`<DJOEH id="DJOEH"><DJOExporter><DJO id="DJO"></DJO>${sig('#DJO')}</DJOExporter></DJOEH>`);
    expect(getEmissionStage(doc)).toEqual({ stage: 2, label: EMISSION_STAGE_LABELS[2] });
  });

  it('etapa 3: con datos de la EH (EH/ApprovalEH), sin firma del FH', () => {
    const doc = parse(`<DJOEH id="DJOEH"><DJOExporter><DJO id="DJO"></DJO>${sig('#DJO')}</DJOExporter><EH>e</EH><ApprovalEH>a</ApprovalEH></DJOEH>`);
    expect(getEmissionStage(doc)).toEqual({ stage: 3, label: EMISSION_STAGE_LABELS[3] });
  });

  it('etapa 4: completa, ambas firmas presentes', () => {
    const doc = parse(`<DJOEH id="DJOEH"><DJOExporter><DJO id="DJO"></DJO>${sig('#DJO')}</DJOExporter><EH>e</EH><ApprovalEH>a</ApprovalEH>${sig('#DJOEH')}</DJOEH>`);
    expect(getEmissionStage(doc)).toEqual({ stage: 4, label: EMISSION_STAGE_LABELS[4] });
  });

  it('anómalo: la EH firmó #DJOEH sin que el Exportador haya firmado #DJO', () => {
    const doc = parse(`<DJOEH id="DJOEH"><DJOExporter><DJO id="DJO"></DJO></DJOExporter>${sig('#DJOEH')}</DJOEH>`);
    expect(getEmissionStage(doc).stage).toBe('anomalo');
  });

  it('anómalo: hay datos de la EH sin que el Exportador haya firmado', () => {
    const doc = parse('<DJOEH id="DJOEH"><DJOExporter><DJO id="DJO"></DJO></DJOExporter><EH>e</EH><ApprovalEH>a</ApprovalEH></DJOEH>');
    expect(getEmissionStage(doc).stage).toBe('anomalo');
  });
});

describe.runIf(hasRealFixtures())('getEmissionStage contra DJO reales', () => {
  const expectedStageByFixture = {
    'djo-exportador.xml': 1,
    'djo-exportador-signed.xml': 2,
    'djo-exportador-signed-eh.xml': 3,
    'djo-exportador-signed-eh-signed.xml': 4,
    'djo-ejemplo-1-sin-firmas.xml': 'anomalo',
    'djo-ejemplo-2-sin-firmas.xml': 'anomalo',
    'djo-ejemplo-v200.xml': 'anomalo', // DJOVer 2.0.0, mismo caso: EH/ApprovalEH sin firmas
  };

  for (const name of availableRealFixtures()) {
    const expectedStage = expectedStageByFixture[name];
    it(`${name}: etapa ${expectedStage}`, () => {
      const doc = parse(loadRealFixture(name));
      expect(getEmissionStage(doc).stage).toBe(expectedStage);
    });
  }
});
