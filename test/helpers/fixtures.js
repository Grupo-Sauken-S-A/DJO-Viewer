import fs from 'fs';
import path from 'path';

const REAL_FIXTURES_DIR = path.resolve(__dirname, '../fixtures/real');

export const REAL_FIXTURE_NAMES = [
  'djo-ejemplo-1-sin-firmas.xml',
  'djo-ejemplo-2-sin-firmas.xml',
  'djo-exportador.xml',
  'djo-exportador-signed.xml',
  'djo-exportador-signed-eh.xml',
  'djo-exportador-signed-eh-signed.xml',
];

export const hasRealFixtures = () => fs.existsSync(REAL_FIXTURES_DIR);

export const loadRealFixture = (name) =>
  fs.readFileSync(path.join(REAL_FIXTURES_DIR, name), 'utf-8');

export const availableRealFixtures = () =>
  hasRealFixtures() ? REAL_FIXTURE_NAMES.filter((n) => fs.existsSync(path.join(REAL_FIXTURES_DIR, n))) : [];

// --- Utilidades para armar copias mutadas de una DJO real ---

// Elimina la primera ocurrencia de un elemento (con cualquier prefijo de namespace) y su contenido.
export const stripElement = (xml, tagName) => {
  const re = new RegExp(`<(?:\\w+:)?${tagName}(?:\\s[^>]*)?>[\\s\\S]*?</(?:\\w+:)?${tagName}>`);
  return xml.replace(re, '');
};

// Elimina la firma XMLDSig cuyo Reference apunta a un id dado (p.ej. "#DJO" o "#DJOEH").
export const stripSignatureForReference = (xml, referenceUri) => {
  const re = /<ds:Signature\b[\s\S]*?<\/ds:Signature>/g;
  return xml.replace(re, (match) => (match.includes(`URI="${referenceUri}"`) ? '' : match));
};

export const replaceElementText = (xml, tagName, newText) => {
  const re = new RegExp(`(<(?:\\w+:)?${tagName}(?:\\s[^>]*)?>)[\\s\\S]*?(</(?:\\w+:)?${tagName}>)`);
  return xml.replace(re, `$1${newText}$2`);
};
