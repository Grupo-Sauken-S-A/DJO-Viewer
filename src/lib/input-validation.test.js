import { describe, it, expect } from 'vitest';
import { validateEncoding, validateStructure, validateSize, validateBOM, decodeXmlBytes, MAX_XML_SIZE_BYTES } from './input-validation';

const parse = (xml) => new DOMParser().parseFromString(xml, 'text/xml');

describe('validateEncoding', () => {
  it('no advierte nada para un prólogo UTF-8 sin caracteres de reemplazo', () => {
    expect(validateEncoding('<?xml version="1.0" encoding="UTF-8"?><root>ok</root>')).toEqual([]);
  });

  it('advierte si el prólogo declara una codificación distinta de UTF-8', () => {
    const warnings = validateEncoding('<?xml version="1.0" encoding="ISO-8859-1"?><root>ok</root>');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/ISO-8859-1/);
    expect(warnings[0]).toMatch(/UTF-8/);
  });

  it('detecta el carácter de reemplazo U+FFFD (indicio de decodificación incorrecta)', () => {
    const warnings = validateEncoding('<?xml version="1.0" encoding="UTF-8"?><root>Exportador �</root>');
    expect(warnings.some((w) => w.includes('�'))).toBe(true);
  });

  it('puede acumular ambas advertencias a la vez', () => {
    const warnings = validateEncoding('<?xml version="1.0" encoding="ISO-8859-1"?><root>Exportador �</root>');
    expect(warnings).toHaveLength(2);
  });

  it('no revienta con contenido vacío o sin prólogo', () => {
    expect(validateEncoding('')).toEqual([]);
    expect(validateEncoding('<root>sin prologo</root>')).toEqual([]);
  });
});

describe('validateStructure', () => {
  const minimalDjo = '<DJOEH id="DJOEH"><DJO id="DJO"><DJOVer>1.0</DJOVer><Agreement><AgreementAcronym>A18</AgreementAcronym></Agreement></DJO></DJOEH>';

  it('no advierte nada para una estructura mínima con DJOVer/AgreementAcronym/ids presentes', () => {
    expect(validateStructure(parse(minimalDjo))).toEqual([]);
  });

  it('advierte si falta <DJOVer>', () => {
    const doc = parse('<DJOEH id="DJOEH"><DJO id="DJO"><Agreement><AgreementAcronym>A18</AgreementAcronym></Agreement></DJO></DJOEH>');
    const warnings = validateStructure(doc);
    expect(warnings.some((w) => w.includes('<DJOVer>'))).toBe(true);
  });

  it('advierte si falta <AgreementAcronym>', () => {
    const doc = parse('<DJOEH id="DJOEH"><DJO id="DJO"><DJOVer>1.0</DJOVer></DJO></DJOEH>');
    const warnings = validateStructure(doc);
    expect(warnings.some((w) => w.includes('<AgreementAcronym>'))).toBe(true);
  });

  it('advierte si falta <DJO id="DJO"> o <DJOEH id="DJOEH">', () => {
    const doc = parse('<root><DJOVer>1.0</DJOVer><Agreement><AgreementAcronym>A18</AgreementAcronym></Agreement></root>');
    const warnings = validateStructure(doc);
    expect(warnings.some((w) => w.includes('id="DJO"'))).toBe(true);
    expect(warnings.some((w) => w.includes('id="DJOEH"'))).toBe(true);
  });

  it('no revienta si el documento es null', () => {
    expect(validateStructure(null)).toEqual([]);
  });
});

describe('validateSize', () => {
  it('no bloquea un archivo dentro del límite', () => {
    expect(validateSize(1024)).toBeNull();
    expect(validateSize(MAX_XML_SIZE_BYTES)).toBeNull();
  });

  it('bloquea un archivo que supera 4MB, con el tamaño en el mensaje', () => {
    const error = validateSize(MAX_XML_SIZE_BYTES + 1);
    expect(error).toMatch(/4 MB/);
  });
});

describe('decodeXmlBytes / validateBOM', () => {
  const encodeUtf8 = (str) => new TextEncoder().encode(str).buffer;

  it('decodifica sin BOM y no lo reporta', () => {
    const { content, hasBOM } = decodeXmlBytes(encodeUtf8('<root>ok</root>'));
    expect(content).toBe('<root>ok</root>');
    expect(hasBOM).toBe(false);
    expect(validateBOM(hasBOM)).toBeNull();
  });

  it('detecta un BOM UTF-8 al inicio, lo quita del contenido y avisa (sin bloquear)', () => {
    const { content, hasBOM } = decodeXmlBytes(encodeUtf8('﻿<root>ok</root>'));
    expect(content).toBe('<root>ok</root>');
    expect(hasBOM).toBe(true);
    const warning = validateBOM(hasBOM);
    expect(warning).toMatch(/BOM/);
    expect(warning).toMatch(/aduanera/i);
  });
});
