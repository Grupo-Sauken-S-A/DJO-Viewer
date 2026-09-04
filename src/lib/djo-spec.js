// Fuente de verdad de qué elementos existen en cada versión publicada de DJO. A diferencia
// de COD (regulado por ALADI), el formato DJO lo define exclusivamente Grupo Sauken S.A.
// para su propio sistema de gestión de certificados de origen — no hay un documento externo
// que consultar, esta lista es la fuente de verdad y se actualiza a mano cuando sale una
// versión nueva.
//
// Confirmado por el dueño del proyecto (2026-09-04): un campo de la versión puede faltar o
// venir vacío, pero la DJO NUNCA puede traer un elemento que no esté en esta lista para su
// versión declarada. El Acuerdo (<AgreementAcronym>) es meramente informativo — no hay
// operaciones ni requerimientos de campo que dependan de qué acuerdo sea, por eso esta lista
// no varía por acuerdo como sí lo hace la tabla M/O/NC de COD-Viewer.
//
// A partir de v2.0.0 (confirmado 2026-09-04) SÍ varía la ESTRUCTURA por versión: <Agreement>
// pasa de único a repetible (uno por cada acuerdo bajo el que se declara la DJO, cantidad
// declarada en <AgreementQty>), y cada bloque agrega nomenclatura propia (NomenclatureType/
// NomenclatureRev/AgreementNomenclatureCode) porque cada acuerdo puede clasificar el mismo
// producto con un código distinto. v1.0.0 y v2.0.0 quedan **ambas vigentes indefinidamente**
// — no es una migración, DJOViewer.jsx/pdf-generator.js ramifican por DJOVer para decidir cuál
// de las dos formas de "Acuerdo comercial" renderizar (ver docs/BUSINESS_RULES.md §3).

export const KNOWN_DJO_VERSIONS = ['1.0.0', '2.0.0'];

const V1_0_0_ELEMENTS = [
  'DJOEH', 'DJOExporter', 'DJO', 'DJOVer', 'DJOSubmitterType',
  'Agreement', 'AgreementAcronym', 'OriginRule',
  'Exporter', 'ExporterCountry', 'ExporterBusinessName', 'ExporterTaxIdentification',
  'ExporterBusinessAddress', 'ExporterBusinessCity', 'ExporterTelephone', 'ExporterEmail', 'ExporterURL',
  'Producer', 'ProducerCountry', 'ProducerBusinessName', 'ProducerTaxIdentification',
  'ProducerBusinessAddress', 'ProducerBusinessCity', 'ProducerFactoryAddress', 'ProducerFactoryCity',
  'ProducerTelephone', 'ProducerEmail', 'ProducerURL',
  'Declaration', 'DeclarationDate',
  'FormDJO', 'GoodName', 'GoodNCM', 'GoodMeasureUnit', 'GoodMinFOBValue', 'GoodMaxFOBValue',
  'GoodVariantQty', 'GoodVariant', 'GoodVariantItem', 'GoodVariantName', 'GoodVariantExporterCode', 'GoodVariantDescription',
  'ManufacturingProcess', 'DescriptionOfManufacturingProcess', 'OtherInformationOfManufacturingProcess',
  'Components',
  'LocalSupplies', 'LocalSuppliesQty', 'LocalSuppliesItem', 'LocalSupplieGoodItem', 'LocalSupplieGoodDescription',
  'LocalSupplieGoodNCM', 'LocalSupplierBusinessName',
  'IntrazoneSupplies', 'IntrazoneSuppliesQty', 'IntrazoneSuppliesItem', 'IntrazoneSupplieGoodItem',
  'IntrazoneSupplieGoodDescription', 'IntrazoneSupplierBusinessName', 'IntrazoneSupplierCountry',
  'IntrazoneSupplieGoodNCM', 'IntrazoneSupplieGoodCIFValue', 'IntrazoneSupplieGoodPercOnFOBValue',
  'IntrazoneSupplieDJMDate', 'IntrazoneSupplieDJMNumber',
  'ExtrazoneSupplies', 'ExtrazoneSuppliesQty', 'ExtrazoneSuppliesItem', 'ExtrazoneSupplieGoodItem',
  'ExtrazoneSupplieGoodDescription', 'ExtrazoneSupplierBusinessName', 'ExtrazoneSupplierCountry',
  'ExtrazoneSupplieGoodNCM', 'ExtrazoneSupplieGoodCIFValue', 'ExtrazoneSupplieGoodPercOnFOBValue',
  'PACThirdCountrySupplies', 'PACThirdCountrySuppliesQty', 'PACThirdCountrySuppliesItem',
  'PACThirdCountrySupplieGoodItem', 'PACThirdCountrySupplieGoodDescription', 'PACThirdCountrySupplierBusinessName',
  'PACThirdCountrySupplierCountry', 'PACThirdCountrySupplieGoodNCM', 'PACThirdCountrySupplieGoodCIFValue',
  'PACThirdCountrySupplieGoodPercOnFOBValue', 'CCPACCode',
  'EH', 'EHId', 'EHCountry', 'EHName', 'EHAddress', 'EHCity', 'EHTelephone', 'EHEmail', 'EHURL',
  'ApprovalEH', 'ApprovalNumber', 'ApprovalDate', 'ROMCompliance',
];

// v2.0.0 agrega AgreementQty (cantidad de bloques <Agreement>) y, dentro de cada <Agreement>,
// NomenclatureType/NomenclatureRev/AgreementNomenclatureCode — el resto de la DJO es idéntico
// a v1.0.0.
const V2_0_0_ELEMENTS = [
  ...V1_0_0_ELEMENTS,
  'AgreementQty', 'NomenclatureType', 'NomenclatureRev', 'AgreementNomenclatureCode',
];

export const ALLOWED_ELEMENTS_BY_VERSION = {
  '1.0.0': V1_0_0_ELEMENTS,
  '2.0.0': V2_0_0_ELEMENTS,
};

const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';

// Recorre todo el documento y devuelve los nombres de elemento que no están en la lista de
// la versión declarada. Ignora la firma digital (namespace XMLDSig, no son campos de la DJO)
// y el sobre SOAP raíz (ns1:Envelope/ns1:Affidavit — protocolo de transporte, no contenido de
// la DJO). Si la versión no es una de las conocidas, no reporta nada acá — eso ya lo cubre
// por separado la validación de versión reconocida (evita inundar de falsos positivos un
// documento cuya versión ni siquiera se pudo identificar).
export const getUnknownElements = (xmlDoc, version) => {
  const allowed = ALLOWED_ELEMENTS_BY_VERSION[version];
  if (!allowed) return [];

  const allowedSet = new Set(allowed);
  const unknown = new Set();
  const allElements = xmlDoc.getElementsByTagName('*');

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.namespaceURI === XMLDSIG_NS) continue;
    const tag = el.tagName;
    if (tag.includes(':')) continue; // ns1:Envelope, ns1:Affidavit
    if (!allowedSet.has(tag)) unknown.add(tag);
  }

  return Array.from(unknown);
};
