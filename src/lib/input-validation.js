import { KNOWN_DJO_VERSIONS, getUnknownElements } from './djo-spec';

// Tope de tamaño para el XML de entrada. A diferencia del resto de las validaciones de
// este archivo, esta es una protección de recursos (no una regla de negocio de DJO) —
// por eso bloquea en vez de solo advertir.
export const MAX_XML_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

// Chequea el tamaño del archivo ANTES de leerlo/decodificarlo — recibe bytes, no el string
// ya decodificado (evita cargar en memoria algo descomunal solo para poder medirlo).
export const validateSize = (byteLength) => {
  if (byteLength > MAX_XML_SIZE_BYTES) {
    const mb = (byteLength / (1024 * 1024)).toFixed(1);
    return `El archivo pesa ${mb} MB, supera el máximo admitido de 4 MB.`;
  }
  return null;
};

// Decodifica bytes crudos (ArrayBuffer) como UTF-8 preservando la información de si el
// archivo traía BOM — TextDecoder con la opción por defecto (ignoreBOM: false) lo quita
// en silencio, que es justo lo que no queremos acá: necesitamos saber si estaba.
export const decodeXmlBytes = (arrayBuffer) => {
  const decoded = new TextDecoder('utf-8', { ignoreBOM: true }).decode(arrayBuffer);
  const hasBOM = decoded.charCodeAt(0) === 0xFEFF;
  return { content: hasBOM ? decoded.slice(1) : decoded, hasBOM };
};

// Una DJO con BOM no es un error de esta app en particular, pero el formato DJO de Sauken
// no lo admite — se puede procesar igual (por eso es un warning, no un bloqueo), pero hay
// que avisar porque el sistema de gestión de certificados podría rechazarlo por esa causa.
export const validateBOM = (hasBOM) => {
  if (hasBOM) {
    return 'El archivo tiene una marca BOM (Byte Order Mark) al inicio. Una DJO no debe contener BOM — el sistema de gestión de certificados podría rechazar este documento por esa causa, aunque esta aplicación pudo procesarlo igual.';
  }
  return null;
};

// Chequea la codificación declarada en el prólogo del XML contra UTF-8 (requisito del
// formato DJO de Sauken), y detecta caracteres de reemplazo que delatan una decodificación
// incorrecta.
export const validateEncoding = (xmlContent) => {
  const warnings = [];
  if (!xmlContent) return warnings;

  const prologMatch = xmlContent.match(/<\?xml[^?]*\?>/);
  const encodingMatch = prologMatch ? prologMatch[0].match(/encoding=["']([^"']+)["']/i) : null;
  const declaredEncoding = encodingMatch ? encodingMatch[1] : null;

  if (declaredEncoding && declaredEncoding.toUpperCase() !== 'UTF-8') {
    warnings.push(`El XML declara la codificación "${declaredEncoding}", pero el formato DJO exige UTF-8.`);
  }

  if (xmlContent.includes('�')) {
    warnings.push('El contenido tiene caracteres no válidos (�) — es probable que la codificación real del archivo no sea UTF-8, aunque el prólogo del XML lo declare.');
  }

  return warnings;
};

// Chequea que el XML tenga la estructura mínima esperada de una DJO antes de procesarlo:
// versión reconocida, acuerdo presente (informativo, no se valida contra una lista — ver
// djo-spec.js), estructura básica (<DJO id="DJO">/<DJOEH id="DJOEH">), y que no contenga
// elementos fuera de los definidos para su versión (confirmado por el dueño del proyecto,
// 2026-09-04: una DJO puede omitir u omitir el contenido de cualquier campo de su versión,
// pero nunca puede traer un elemento no enumerado para esa versión).
export const validateStructure = (xmlDoc) => {
  const warnings = [];
  if (!xmlDoc) return warnings;

  const version = xmlDoc.querySelector('DJOVer')?.textContent?.trim();
  const agreement = xmlDoc.querySelector('AgreementAcronym')?.textContent?.trim();

  if (!version) {
    warnings.push('No se encontró el elemento <DJOVer> — no se puede determinar la versión de la DJO.');
  } else if (!KNOWN_DJO_VERSIONS.includes(version)) {
    warnings.push(`La versión de DJO "${version}" no es una de las versiones reconocidas (${KNOWN_DJO_VERSIONS.join(', ')}).`);
  } else {
    const unknownElements = getUnknownElements(xmlDoc, version);
    if (unknownElements.length > 0) {
      warnings.push(`El XML contiene elementos no definidos para la versión ${version} de DJO: ${unknownElements.map((tag) => `<${tag}>`).join(', ')}.`);
    }
  }

  if (!agreement) {
    warnings.push('No se encontró el elemento <AgreementAcronym> — no se puede determinar el acuerdo comercial.');
  }

  if (xmlDoc.getElementById('DJO') === null) {
    warnings.push('No se encontró el elemento <DJO id="DJO"> — falta la estructura básica de una DJO.');
  }
  if (xmlDoc.getElementById('DJOEH') === null) {
    warnings.push('No se encontró el elemento <DJOEH id="DJOEH"> — falta la estructura básica de una DJO.');
  }

  return warnings;
};
