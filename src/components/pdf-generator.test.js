// Test de humo: genera el documento PDF completo para cada DJO real (y variantes mutadas que
// simulan etapas de emisión incompletas y errores de entrada) y verifica que no lance
// excepciones. Usa buildDJOPDFDocument (no generateDJOPDF) para no disparar doc.save(): en este
// entorno de test, jsPDF detecta Node y escribe el PDF directamente a disco en vez de simular
// una descarga de navegador, así que llamar a generateDJOPDF de verdad dejaba archivos reales
// (con datos de exportadores/firmantes reales) tirados en el directorio del proyecto.
// Este test no valida el contenido visual/posicional del PDF — es una guarda de regresión
// contra errores que rompan la generación entera (mismo criterio que usa COD-Viewer).
import { describe, it, expect } from 'vitest';
import { buildDJOPDFDocument } from './pdf-generator';
import {
  hasRealFixtures,
  availableRealFixtures,
  loadRealFixture,
  stripSignatureForReference,
  stripElement,
} from '../../test/helpers/fixtures';

const parse = (xml) => new DOMParser().parseFromString(xml, 'text/xml');

describe.runIf(hasRealFixtures())('buildDJOPDFDocument contra DJO reales y variantes mutadas', () => {
  for (const name of availableRealFixtures()) {
    it(`${name}: genera el PDF completo sin lanzar excepción`, async () => {
      const doc = parse(loadRealFixture(name));
      const { doc: pdfDoc, filename } = await buildDJOPDFDocument(doc, { inputWarnings: [], emissionStage: { stage: 4, label: 'DJO completa' } });
      expect(pdfDoc).toBeTruthy();
      expect(filename).toMatch(/\.pdf$/);
    });

    it(`${name}: también genera el PDF para una DJO en etapa 3 (con marca de agua de incompleto)`, async () => {
      const xml = stripSignatureForReference(loadRealFixture(name), '#DJOEH');
      const doc = parse(xml);
      const { doc: pdfDoc } = await buildDJOPDFDocument(doc, { inputWarnings: [], emissionStage: { stage: 3, label: 'Verificado por la EH — pendiente de firma del FH' } });
      expect(pdfDoc).toBeTruthy();
    });

    it(`${name}: también genera el PDF cuando hay advertencias de validación de entrada`, async () => {
      const doc = parse(loadRealFixture(name));
      const { doc: pdfDoc } = await buildDJOPDFDocument(doc, {
        inputWarnings: ['El XML contiene elementos no definidos para la versión 1.0.0 de DJO: <CampoInventado>.'],
        emissionStage: { stage: 4, label: 'DJO completa' },
      });
      expect(pdfDoc).toBeTruthy();
    });

    it(`${name}: no explota si falta el certificado X.509 dentro de la firma`, async () => {
      const xml = stripElement(loadRealFixture(name), 'X509Certificate');
      const doc = parse(xml);
      const { doc: pdfDoc } = await buildDJOPDFDocument(doc, { inputWarnings: [], emissionStage: { stage: 4, label: 'DJO completa' } });
      expect(pdfDoc).toBeTruthy();
    });
  }
});
