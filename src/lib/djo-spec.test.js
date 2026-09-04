import { describe, it, expect } from 'vitest';
import { getUnknownElements, KNOWN_DJO_VERSIONS } from './djo-spec';
import { hasRealFixtures, availableRealFixtures, loadRealFixture } from '../../test/helpers/fixtures';

const parse = (xml) => new DOMParser().parseFromString(xml, 'text/xml');

describe('getUnknownElements', () => {
  it('no reporta nada para una estructura mínima con solo elementos conocidos de 1.0.0', () => {
    const doc = parse('<DJOEH id="DJOEH"><DJOExporter><DJO id="DJO"><DJOVer>1.0.0</DJOVer></DJO></DJOExporter></DJOEH>');
    expect(getUnknownElements(doc, '1.0.0')).toEqual([]);
  });

  it('detecta un elemento no definido para la versión', () => {
    const doc = parse('<DJOEH id="DJOEH"><DJOExporter><DJO id="DJO"><DJOVer>1.0.0</DJOVer><CampoInventado>x</CampoInventado></DJO></DJOExporter></DJOEH>');
    expect(getUnknownElements(doc, '1.0.0')).toEqual(['CampoInventado']);
  });

  it('no reporta duplicados si el mismo elemento desconocido aparece más de una vez', () => {
    const doc = parse('<DJO id="DJO"><CampoInventado>a</CampoInventado><CampoInventado>b</CampoInventado></DJO>');
    expect(getUnknownElements(doc, '1.0.0')).toEqual(['CampoInventado']);
  });

  it('ignora la firma digital (namespace XMLDSig)', () => {
    const doc = parse(
      '<DJO id="DJO">' +
      '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:Reference URI="#DJO"/></ds:SignedInfo></ds:Signature>' +
      '</DJO>'
    );
    expect(getUnknownElements(doc, '1.0.0')).toEqual([]);
  });

  it('ignora el sobre SOAP raíz (ns1:Envelope/ns1:Affidavit)', () => {
    const doc = parse('<ns1:Envelope xmlns:ns1="http://www.w3.org/2001/12/soap-envelope"><ns1:Affidavit><DJO id="DJO"/></ns1:Affidavit></ns1:Envelope>');
    expect(getUnknownElements(doc, '1.0.0')).toEqual([]);
  });

  it('devuelve [] si la versión no es una de las conocidas (no infla de falsos positivos)', () => {
    const doc = parse('<root><CampoInventado>x</CampoInventado></root>');
    expect(getUnknownElements(doc, '9.9.9')).toEqual([]);
  });
});

describe.runIf(hasRealFixtures())('getUnknownElements contra DJO reales', () => {
  for (const name of availableRealFixtures()) {
    it(`${name}: no tiene elementos fuera de los definidos para ${KNOWN_DJO_VERSIONS[0]}`, () => {
      const doc = parse(loadRealFixture(name));
      expect(getUnknownElements(doc, KNOWN_DJO_VERSIONS[0])).toEqual([]);
    });
  }
});
