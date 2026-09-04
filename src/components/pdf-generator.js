import jsPDF from 'jspdf';
import { getCountryName } from './country-codes';
import { verifySignatureForElement, getSignatureStatusDisplay } from './signature-utils';
import { APP_NAME, APP_VERSION } from '@/lib/app-version';

// Configuración de colores y estilos — mismo lenguaje visual que usa COD-Viewer para su PDF.
const COLORS = {
  primary: '#1f2937',      // gray-800
  secondary: '#374151',    // gray-700
  accent: '#3b82f6',       // blue-500
  warning: '#f59e0b',      // amber-500
  error: '#ef4444',        // red-500
  muted: '#6b7280',        // gray-500
  border: '#e5e7eb',       // gray-200
  required: '#fef3c7',     // amber-100 - para campos requeridos
  optional: '#f3f4f6'      // gray-100 - para campos opcionales
};

const FONTS = {
  mainTitle: { size: 16 },
  sectionTitle: { size: 12 },
  subsectionTitle: { size: 11 },
  heading: { size: 10 },
  body: { size: 8 },
  small: { size: 7 },
  caption: { size: 6 },
  signatureText: { size: 9 }
};

const formatDate = (dateString) => {
  if (!dateString) return 'No especificada';
  try {
    return new Date(dateString).toLocaleDateString('es-ES');
  } catch {
    return dateString;
  }
};

// A diferencia de COD (donde un campo "NC" se oculta del todo), en DJO todo campo definido
// para la versión se muestra siempre — ver docs/BUSINESS_RULES.md §5. Por eso este generador
// nunca decide si un campo se muestra: solo cómo se resalta (required/optional), igual que el
// componente <Field> de la vista web.
const processFieldValue = (value, label) => {
  if (!value) return 'No especificado';

  if (label?.toLowerCase().includes('país') || label?.toLowerCase().includes('pais')) {
    return getCountryName(value);
  }

  return value;
};

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Las variantes de un mismo producto (<GoodVariant>) aparecen como elementos hermanos planos
// (GoodVariantItem/Name/ExporterCode/Description de la variante 1, seguidos por los mismos 4
// tags de la variante 2, sin wrapper por ítem) — mismo mecanismo de separación por innerHTML
// que usa DJOViewer.jsx, reutilizado acá para no duplicar una lógica frágil dos veces.
const getGoodVariants = (formDJO) => {
  const goodVariant = formDJO?.querySelector('GoodVariant');
  if (!goodVariant) return [];

  const variantCodes = Array.from(goodVariant.querySelectorAll('GoodVariantItem'));
  return variantCodes.map((codeElement, index) => {
    const startIdx = goodVariant.innerHTML.indexOf(`<GoodVariantItem>${codeElement.textContent}</GoodVariantItem>`);
    const nextCodeIdx = index < variantCodes.length - 1
      ? goodVariant.innerHTML.indexOf(`<GoodVariantItem>${variantCodes[index + 1].textContent}</GoodVariantItem>`)
      : goodVariant.innerHTML.length;
    const variantSubstring = goodVariant.innerHTML.substring(startIdx, nextCodeIdx);
    const variantFragment = document.createRange().createContextualFragment(variantSubstring);
    const getTextContent = (selector) => variantFragment.querySelector(selector)?.textContent || null;

    return {
      item: getTextContent('GoodVariantItem'),
      code: getTextContent('GoodVariantExporterCode'),
      name: getTextContent('GoodVariantName'),
      description: getTextContent('GoodVariantDescription')
    };
  });
};

class PDFGenerator {
  constructor(xmlData, options = {}) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    this.pageWidth = 210;
    this.pageHeight = 297;
    this.margin = 10;
    this.contentWidth = this.pageWidth - (this.margin * 2);
    this.currentY = this.margin;

    this.djoVer = xmlData.querySelector('DJOVer')?.textContent?.trim();
    // A partir de DJOVer 2.0.0, <Agreement> es repetible — ver docs/BUSINESS_RULES.md §3.
    this.hasMultipleAgreements = this.djoVer === '2.0.0';
    this.agreementAcronym = this.hasMultipleAgreements
      ? Array.from(xmlData.querySelectorAll('Agreement'))
          .map((a) => a.querySelector('AgreementAcronym')?.textContent)
          .filter(Boolean)
          .join(', ')
      : xmlData.querySelector('AgreementAcronym')?.textContent?.trim();
    this.inputWarnings = options.inputWarnings || [];
    this.emissionStage = options.emissionStage || null;
    this.signatureIntegrity = options.signatureIntegrity || {};

    this.doc.setProperties({
      title: 'Declaración Jurada de Origen Digital - DJO',
      subject: 'Declaración Jurada de Origen Digital',
      author: 'Grupo Sauken S.A. - ARGENTINA',
      creator: 'Visualizador DJO',
      producer: 'jsPDF',
      keywords: `${APP_NAME} v${APP_VERSION}`
    });
  }

  checkPageBreak(neededHeight = 20) {
    const maxContentY = this.pageHeight - 20;
    if (this.currentY + neededHeight > maxContentY) {
      this.addPage();
      return true;
    }
    return false;
  }

  addPage() {
    this.doc.addPage();
    this.currentY = this.margin;
  }

  addHeader() {
    const accentRgb = hexToRgb(COLORS.accent);
    this.doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
    this.doc.rect(this.margin, this.margin, this.contentWidth, 15, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(FONTS.mainTitle.size);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('DECLARACIÓN JURADA DE ORIGEN DIGITAL - DJO', this.pageWidth / 2, this.margin + 10, { align: 'center' });

    if (this.djoVer) {
      this.doc.setFontSize(FONTS.small.size);
      this.doc.setFont('helvetica', 'normal');
      const subtitle = this.agreementAcronym
        ? `Versión ${this.djoVer} · ${this.hasMultipleAgreements ? 'Acuerdos' : 'Acuerdo'} ${this.agreementAcronym}`
        : `Versión ${this.djoVer}`;
      this.doc.text(subtitle, this.pageWidth / 2, this.margin + 13, { align: 'center' });
    }

    this.currentY = this.margin + 20;
    const primaryRgb = hexToRgb(COLORS.primary);
    this.doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  }

  addFooter() {
    const footerY = this.pageHeight - 15;

    const borderRgb = hexToRgb(COLORS.border);
    this.doc.setDrawColor(borderRgb.r, borderRgb.g, borderRgb.b);
    this.doc.line(this.margin, footerY, this.pageWidth - this.margin, footerY);

    const mutedRgb = hexToRgb(COLORS.muted);
    this.doc.setTextColor(mutedRgb.r, mutedRgb.g, mutedRgb.b);
    this.doc.setFontSize(FONTS.caption.size);
    this.doc.setFont('helvetica', 'normal');

    const currentDate = new Date().toLocaleDateString('es-ES');
    const time = new Date().toLocaleTimeString('es-ES');

    this.doc.text(`Generado el ${currentDate} a las ${time}`, this.margin, footerY + 5);
    this.doc.text(`Página ${this.doc.internal.getCurrentPageInfo().pageNumber}`, this.pageWidth - this.margin, footerY + 5, { align: 'right' });
    this.doc.text(`Desarrollado por Sauken para Certificados de Origen · ${APP_NAME} v${APP_VERSION}`, this.pageWidth / 2, footerY + 8, { align: 'center' });
  }

  addSection(title, level = 0, count = null) {
    let spacing = 0;
    if (level === 0) spacing = 6;
    else if (level === 1) spacing = 4;
    else if (level === 2) spacing = 3;
    else spacing = 2;

    const fontSize = level === 0 ? FONTS.sectionTitle.size :
      level === 1 ? FONTS.subsectionTitle.size :
      level === 2 ? FONTS.heading.size :
      FONTS.body.size;

    this.checkPageBreak(spacing + fontSize + 6 + 10);
    this.currentY += spacing;

    const indent = level * 5;

    if (level === 0) {
      this.doc.setFillColor(229, 231, 235);
      this.doc.rect(this.margin + indent, this.currentY - 2, this.contentWidth - indent, fontSize + 4, 'F');
    } else if (level === 1) {
      this.doc.setFillColor(219, 234, 254);
      this.doc.rect(this.margin + indent, this.currentY - 2, this.contentWidth - indent, fontSize + 4, 'F');
      this.doc.setFillColor(147, 197, 253);
      this.doc.rect(this.margin + indent, this.currentY - 2, this.contentWidth - indent, 1, 'F');
    } else if (level === 2) {
      this.doc.setFillColor(220, 252, 231);
      this.doc.rect(this.margin + indent, this.currentY - 2, this.contentWidth - indent, fontSize + 4, 'F');
      this.doc.setFillColor(134, 239, 172);
      this.doc.rect(this.margin + indent, this.currentY - 2, this.contentWidth - indent, 1, 'F');
    } else {
      this.doc.setFillColor(243, 244, 246);
      this.doc.rect(this.margin + indent, this.currentY - 2, this.contentWidth - indent, fontSize + 4, 'F');
      this.doc.setFillColor(209, 213, 219);
      this.doc.rect(this.margin + indent, this.currentY - 2, this.contentWidth - indent, 1, 'F');
    }

    if (level === 0) {
      const accentRgb = hexToRgb(COLORS.accent);
      this.doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
    } else {
      const primaryRgb = hexToRgb(COLORS.primary);
      this.doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    }

    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', 'bold');

    let titleText = title;
    if (count !== null && count > 0) {
      titleText += ` (${count} item${count !== 1 ? 's' : ''})`;
    }

    this.doc.text(titleText, this.margin + indent + 2, this.currentY + fontSize / 2 + 1);
    this.currentY += fontSize + 4;
  }

  // Campo individual. required/optional espejan los props del <Field> de la vista web —
  // a diferencia de COD, acá no hay tabla M/O/NC que decida si el campo se oculta: todo campo
  // pasado a este método se muestra siempre (ver docs/BUSINESS_RULES.md §5).
  addField(label, rawValue, { required = false, optional = false, indent = 0 } = {}) {
    const processedValue = processFieldValue(rawValue, label);
    const fieldIndent = this.margin + indent;

    const textLines = this.doc.splitTextToSize(processedValue, this.contentWidth - indent - 50);
    const neededHeight = Math.max(6, textLines.length * 4 + 2);

    this.checkPageBreak(neededHeight + 5);

    const fillRgb = required ? hexToRgb(COLORS.required) : hexToRgb(COLORS.optional);
    this.doc.setFillColor(fillRgb.r, fillRgb.g, fillRgb.b);
    this.doc.rect(fieldIndent, this.currentY, this.contentWidth - indent, neededHeight, 'F');

    const drawRgb = required ? hexToRgb(COLORS.warning) : hexToRgb(COLORS.border);
    this.doc.setDrawColor(drawRgb.r, drawRgb.g, drawRgb.b);
    this.doc.setLineWidth(1);
    this.doc.line(fieldIndent, this.currentY, fieldIndent, this.currentY + neededHeight);

    const secondaryRgb = hexToRgb(COLORS.secondary);
    this.doc.setTextColor(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);
    this.doc.setFontSize(FONTS.small.size);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(required ? `${label} *` : label, fieldIndent + 2, this.currentY + 3);

    const primaryRgb = hexToRgb(COLORS.primary);
    this.doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    this.doc.setFontSize(FONTS.body.size);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(textLines, fieldIndent + 2, this.currentY + 6);

    this.currentY += neededHeight + 2;
  }

  // Varios campos en una sola fila — mismo criterio que los `flex-row-container` de la vista web.
  addMultiField(fields, indent = 0) {
    if (fields.length === 0) return;

    const fieldIndent = this.margin + indent;
    const columnWidth = (this.contentWidth - indent) / fields.length;

    let maxHeight = 6;
    fields.forEach((field) => {
      const processedValue = processFieldValue(field.value, field.label);
      const textLines = this.doc.splitTextToSize(processedValue, columnWidth - 10);
      const fieldHeight = Math.max(6, textLines.length * 4 + 2);
      if (fieldHeight > maxHeight) maxHeight = fieldHeight;
    });

    this.checkPageBreak(maxHeight + 5);

    fields.forEach((field, index) => {
      const xPos = fieldIndent + (index * columnWidth);
      const processedValue = processFieldValue(field.value, field.label);

      const fillRgb = field.required ? hexToRgb(COLORS.required) : hexToRgb(COLORS.optional);
      this.doc.setFillColor(fillRgb.r, fillRgb.g, fillRgb.b);
      this.doc.rect(xPos, this.currentY, columnWidth - 1, maxHeight, 'F');

      const drawRgb = field.required ? hexToRgb(COLORS.warning) : hexToRgb(COLORS.border);
      this.doc.setDrawColor(drawRgb.r, drawRgb.g, drawRgb.b);
      this.doc.setLineWidth(1);
      this.doc.line(xPos, this.currentY, xPos, this.currentY + maxHeight);

      const secondaryRgb = hexToRgb(COLORS.secondary);
      this.doc.setTextColor(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);
      this.doc.setFontSize(FONTS.small.size);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(field.required ? `${field.label} *` : field.label, xPos + 2, this.currentY + 3);

      const primaryRgb = hexToRgb(COLORS.primary);
      this.doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      this.doc.setFontSize(FONTS.body.size);
      this.doc.setFont('helvetica', 'normal');
      const textLines = this.doc.splitTextToSize(processedValue, columnWidth - 10);
      this.doc.text(textLines, xPos + 2, this.currentY + 6);
    });

    this.currentY += maxHeight + 2;
  }

  // Sección de lista con encabezado por ítem (variantes de producto, materiales locales/
  // intrazona/extrazona/PAC) — mismo patrón que addListSection de COD-Viewer para facturas
  // y mercaderías.
  addListSection(title, items, itemRenderer, level = 3) {
    if (items.length === 0) return;

    this.addSection(title, level, items.length);

    items.forEach((item, index) => {
      this.checkPageBreak(30);

      this.doc.setFillColor(219, 234, 254);
      this.doc.rect(this.margin + 15, this.currentY, this.contentWidth - 15, 6, 'F');
      const accentRgb = hexToRgb(COLORS.accent);
      this.doc.setDrawColor(accentRgb.r, accentRgb.g, accentRgb.b);
      this.doc.setLineWidth(1);
      this.doc.line(this.margin + 15, this.currentY, this.margin + 15, this.currentY + 6);

      this.doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
      this.doc.setFontSize(FONTS.body.size);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`Ítem ${index + 1}`, this.margin + 17, this.currentY + 4);
      this.currentY += 8;

      itemRenderer(item, index);
    });
  }

  // Un bloque por acuerdo (solo DJOVer 2.0.0 — ver docs/BUSINESS_RULES.md §3). Cada acuerdo
  // trae su propia nomenclatura porque puede clasificar el mismo producto con un código
  // distinto según el sistema/revisión de nomenclatura que use ese acuerdo en particular.
  renderAgreement(agreementEl) {
    this.addMultiField([
      { label: 'Acrónimo', value: agreementEl.querySelector('AgreementAcronym')?.textContent, required: true },
      { label: 'Norma de origen', value: agreementEl.querySelector('OriginRule')?.textContent, required: true }
    ], 20);
    this.addMultiField([
      { label: 'Tipo de nomenclatura', value: agreementEl.querySelector('NomenclatureType')?.textContent, required: true },
      { label: 'Revisión de nomenclatura', value: agreementEl.querySelector('NomenclatureRev')?.textContent, required: true }
    ], 20);
    this.addField('Código de nomenclatura del acuerdo', agreementEl.querySelector('AgreementNomenclatureCode')?.textContent, { required: true, indent: 20 });
  }

  renderGoodVariant(variant) {
    this.addMultiField([
      { label: 'Ítem', value: variant.item, required: true },
      { label: 'Código de producto', value: variant.code, required: true }
    ], 20);
    this.addField('Nombre del producto', variant.name, { required: true, indent: 20 });
    this.addField('Descripción', variant.description, { required: true, indent: 20 });
  }

  renderLocalSupply(item) {
    this.addMultiField([
      { label: 'Ítem', value: item.querySelector('LocalSupplieGoodItem')?.textContent, required: true },
      { label: 'Posición arancelaria (NCM)', value: item.querySelector('LocalSupplieGoodNCM')?.textContent, optional: true }
    ], 20);
    this.addField('Descripción', item.querySelector('LocalSupplieGoodDescription')?.textContent, { required: true, indent: 20 });
    this.addField('Proveedor', item.querySelector('LocalSupplierBusinessName')?.textContent, { required: true, indent: 20 });
  }

  renderIntrazoneSupply(item) {
    this.addMultiField([
      { label: 'Ítem', value: item.querySelector('IntrazoneSupplieGoodItem')?.textContent, required: true },
      { label: 'Posición arancelaria (NCM)', value: item.querySelector('IntrazoneSupplieGoodNCM')?.textContent, required: true }
    ], 20);
    this.addField('Descripción', item.querySelector('IntrazoneSupplieGoodDescription')?.textContent, { required: true, indent: 20 });
    this.addMultiField([
      { label: 'Proveedor', value: item.querySelector('IntrazoneSupplierBusinessName')?.textContent, required: true },
      { label: 'País', value: item.querySelector('IntrazoneSupplierCountry')?.textContent, required: true }
    ], 20);
    this.addMultiField([
      { label: 'Valor CIF', value: item.querySelector('IntrazoneSupplieGoodCIFValue')?.textContent, required: true },
      { label: '% sobre FOB', value: item.querySelector('IntrazoneSupplieGoodPercOnFOBValue')?.textContent, required: true }
    ], 20);
    this.addMultiField([
      { label: 'Fecha de DJM', value: formatDate(item.querySelector('IntrazoneSupplieDJMDate')?.textContent), optional: true },
      { label: 'Número DJM', value: item.querySelector('IntrazoneSupplieDJMNumber')?.textContent, optional: true }
    ], 20);
  }

  renderExtrazoneSupply(item) {
    this.addMultiField([
      { label: 'Ítem', value: item.querySelector('ExtrazoneSupplieGoodItem')?.textContent, required: true },
      { label: 'Posición arancelaria (NCM)', value: item.querySelector('ExtrazoneSupplieGoodNCM')?.textContent, required: true }
    ], 20);
    this.addField('Descripción', item.querySelector('ExtrazoneSupplieGoodDescription')?.textContent, { required: true, indent: 20 });
    this.addMultiField([
      { label: 'Proveedor', value: item.querySelector('ExtrazoneSupplierBusinessName')?.textContent, required: true },
      { label: 'País', value: item.querySelector('ExtrazoneSupplierCountry')?.textContent, required: true }
    ], 20);
    this.addMultiField([
      { label: 'Valor CIF', value: item.querySelector('ExtrazoneSupplieGoodCIFValue')?.textContent, required: true },
      { label: '% sobre FOB', value: item.querySelector('ExtrazoneSupplieGoodPercOnFOBValue')?.textContent, required: true }
    ], 20);
  }

  renderPACSupply(item) {
    this.addMultiField([
      { label: 'Ítem', value: item.querySelector('PACThirdCountrySupplieGoodItem')?.textContent, required: true },
      { label: 'Posición arancelaria (NCM)', value: item.querySelector('PACThirdCountrySupplieGoodNCM')?.textContent, required: true }
    ], 20);
    this.addField('Descripción', item.querySelector('PACThirdCountrySupplieGoodDescription')?.textContent, { required: true, indent: 20 });
    this.addMultiField([
      { label: 'Proveedor', value: item.querySelector('PACThirdCountrySupplierBusinessName')?.textContent, required: true },
      { label: 'País', value: item.querySelector('PACThirdCountrySupplierCountry')?.textContent, required: true }
    ], 20);
    this.addMultiField([
      { label: 'Valor CIF', value: item.querySelector('PACThirdCountrySupplieGoodCIFValue')?.textContent, required: true },
      { label: '% sobre FOB', value: item.querySelector('PACThirdCountrySupplieGoodPercOnFOBValue')?.textContent, required: true }
    ], 20);
    this.addField('Código CCPAC', item.querySelector('CCPACCode')?.textContent, { required: true, indent: 20 });
  }

  // Estado de firmas — reutiliza la misma lógica que la vista web (signature-utils.js), sin
  // duplicar la interpretación de severidad/algoritmo/vigencia.
  async addSignatureStatus(xmlDoc) {
    this.addSection('Estado de Firmas Digitales', 0);

    const signatures = [
      { element: 'DJO', name: 'Declaración Jurada de Origen (DJO)' },
      { element: 'DJOEH', name: 'Declaración Jurada de Origen con Entidad Habilitada (DJOEH)' }
    ];

    for (const sig of signatures) {
      const signatureStatus = await verifySignatureForElement(xmlDoc, sig.element);
      const integrityResult = this.signatureIntegrity?.[sig.element];
      const mergedStatus = { ...signatureStatus, integrityValid: integrityResult?.integrityValid ?? null };
      const displayInfo = getSignatureStatusDisplay(mergedStatus);

      const availableWidth = this.contentWidth - 10;
      // Fijar fuente/tamaño ANTES de medir con splitTextToSize, no solo antes de dibujar — si no,
      // la primera firma del bucle hereda el tamaño de la sección anterior y ajusta mal el ancho.
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(FONTS.small.size);
      const textLines = this.doc.splitTextToSize(displayInfo.text, availableWidth);
      const neededHeight = Math.max(12, (textLines.length + 1) * 3 + 6);

      this.checkPageBreak(neededHeight + 2);

      const fillBySeverity = { ok: [219, 234, 254], warning: [254, 243, 199], error: [254, 226, 226] };
      const [r, g, b] = fillBySeverity[displayInfo.severity] || fillBySeverity.ok;
      this.doc.setFillColor(r, g, b);
      this.doc.rect(this.margin + 5, this.currentY, this.contentWidth - 5, neededHeight, 'F');

      const titleRgb = displayInfo.severity === 'error' ? hexToRgb(COLORS.error)
        : displayInfo.severity === 'warning' ? hexToRgb(COLORS.warning)
        : hexToRgb(COLORS.accent);
      this.doc.setTextColor(titleRgb.r, titleRgb.g, titleRgb.b);
      this.doc.setFontSize(FONTS.signatureText.size);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(sig.name, this.margin + 7, this.currentY + 4);

      const primaryRgb = hexToRgb(COLORS.primary);
      this.doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(FONTS.small.size);

      let currentLineY = this.currentY + 7;
      textLines.forEach((line) => {
        const boldIndex = line.indexOf('S-FiDE');
        if (boldIndex === -1) {
          this.doc.text(line, this.margin + 7, currentLineY);
        } else {
          const before = line.slice(0, boldIndex);
          const after = line.slice(boldIndex + 'S-FiDE'.length);
          let x = this.margin + 7;
          this.doc.setFont('helvetica', 'normal');
          if (before) {
            this.doc.text(before, x, currentLineY);
            x += this.doc.getTextWidth(before);
          }
          this.doc.setFont('helvetica', 'bold');
          this.doc.text('S-FiDE', x, currentLineY);
          x += this.doc.getTextWidth('S-FiDE');
          this.doc.setFont('helvetica', 'normal');
          if (after) {
            this.doc.text(after, x, currentLineY);
          }
        }
        currentLineY += 3;
      });
      this.doc.setFont('helvetica', 'normal');

      this.currentY += neededHeight + 2;
    }
  }

  // Advertencias sobre el XML de entrada (codificación, versión/elementos no reconocidos,
  // estructura faltante, BOM) — mismo texto que InputValidationAlert de la vista web. La
  // whitelist de elementos por versión (djo-spec.js) ya viaja dentro de este mismo arreglo,
  // así que no hace falta una alerta separada como el "elementos inesperados" de COD.
  addInputValidationAlert() {
    if (!this.inputWarnings || this.inputWarnings.length === 0) {
      return;
    }

    this.addSection('Advertencias sobre el Archivo XML', 0);

    const availableWidth = this.contentWidth - 10;
    const itemLines = this.inputWarnings.flatMap((warning) => this.doc.splitTextToSize(`• ${warning}`, availableWidth));
    const neededHeight = Math.max(12, itemLines.length * 3 + 6);
    this.checkPageBreak(neededHeight + 2);

    this.doc.setFillColor(254, 243, 199);
    this.doc.rect(this.margin + 5, this.currentY, this.contentWidth - 5, neededHeight, 'F');

    const warningRgb = hexToRgb(COLORS.warning);
    this.doc.setTextColor(warningRgb.r, warningRgb.g, warningRgb.b);
    this.doc.setFontSize(FONTS.signatureText.size);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Advertencias sobre el archivo XML', this.margin + 7, this.currentY + 4);

    const primaryRgb = hexToRgb(COLORS.primary);
    this.doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(FONTS.small.size);

    let currentLineY = this.currentY + 7;
    itemLines.forEach((line) => {
      this.doc.text(line, this.margin + 7, currentLineY);
      currentLineY += 3;
    });

    this.currentY += neededHeight + 2;
  }

  // Etapa de emisión — mismo texto que EmissionStageAlert de la vista web.
  addEmissionStageAlert() {
    if (!this.emissionStage || this.emissionStage.stage === 4) {
      return;
    }

    const isAnomaly = this.emissionStage.stage === 'anomalo';
    this.addSection('Estado de la DJO', 0);

    const availableWidth = this.contentWidth - 10;
    const titleText = isAnomaly ? 'Orden de firmas inconsistente' : 'Esta DJO está en proceso — no está completa';
    const bodyText = isAnomaly
      ? this.emissionStage.label
      : `Etapa detectada: ${this.emissionStage.label}. Este documento no constituye una Declaración Jurada de Origen válida hasta que complete todas las etapas de su emisión.`;
    const bodyLines = this.doc.splitTextToSize(bodyText, availableWidth);

    const neededHeight = Math.max(14, (bodyLines.length + 1) * 3 + 8);
    this.checkPageBreak(neededHeight + 2);

    this.doc.setFillColor(254, 226, 226); // red-100
    this.doc.rect(this.margin + 5, this.currentY, this.contentWidth - 5, neededHeight, 'F');

    const errorRgb = hexToRgb(COLORS.error);
    this.doc.setTextColor(errorRgb.r, errorRgb.g, errorRgb.b);
    this.doc.setFontSize(FONTS.signatureText.size);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(titleText, this.margin + 7, this.currentY + 4);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(FONTS.small.size);
    let currentLineY = this.currentY + 8;
    bodyLines.forEach((line) => {
      this.doc.text(line, this.margin + 7, currentLineY);
      currentLineY += 3;
    });

    this.currentY += neededHeight + 2;
  }

  // Marca de agua diagonal en todas las páginas cuando la DJO no está completa.
  addIncompleteWatermark() {
    if (!this.emissionStage || this.emissionStage.stage === 4) {
      return;
    }

    const pageCount = this.doc.internal.getNumberOfPages();
    const errorRgb = hexToRgb(COLORS.error);

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.saveGraphicsState();
      this.doc.setTextColor(errorRgb.r, errorRgb.g, errorRgb.b);
      this.doc.setFontSize(40);
      this.doc.setFont('helvetica', 'bold');
      if (this.doc.setGState && this.doc.GState) {
        this.doc.setGState(new this.doc.GState({ opacity: 0.18 }));
      }
      this.doc.text('EN PROCESO — NO VÁLIDO', this.pageWidth / 2, this.pageHeight / 2, {
        angle: 45,
        align: 'center'
      });
      this.doc.restoreGraphicsState();
    }
  }

  async generatePDF(xmlData) {
    try {
      this.addHeader();

      this.addEmissionStageAlert();
      this.addInputValidationAlert();

      await this.addSignatureStatus(xmlData);

      const eh = xmlData.querySelector('EH');
      const approvalEH = xmlData.querySelector('ApprovalEH');
      const djo = xmlData.querySelector('DJO');
      const exporter = xmlData.querySelector('Exporter');
      const producer = xmlData.querySelector('Producer');
      const formDJO = xmlData.querySelector('FormDJO');
      const agreement = xmlData.querySelector('Agreement');

      this.addSection('Estructura de Declaración Jurada de Origen', 0);
      this.addSection('Declaración Jurada de Origen (DJOEH)', 1);
      this.addSection('Declaración Jurada de Origen (DJO)', 2);

      this.addSection('Información general', 3);
      this.addMultiField([
        { label: 'Versión', value: djo?.querySelector('DJOVer')?.textContent, required: true },
        { label: 'Tipo de remitente', value: djo?.querySelector('DJOSubmitterType')?.textContent, required: true }
      ], 15);

      if (this.hasMultipleAgreements) {
        const agreements = Array.from(djo?.querySelectorAll('Agreement') || []);
        this.addSection('Acuerdos comerciales', 3, agreements.length);
        this.addField('Cantidad de acuerdos', djo?.querySelector('AgreementQty')?.textContent, { required: true, indent: 15 });
        agreements.forEach((agreementEl) => this.renderAgreement(agreementEl));
      } else {
        this.addSection('Acuerdo comercial', 3);
        this.addMultiField([
          { label: 'Acrónimo', value: agreement?.querySelector('AgreementAcronym')?.textContent, required: true },
          { label: 'Norma de origen', value: agreement?.querySelector('OriginRule')?.textContent, required: true }
        ], 15);
      }

      this.addSection('Datos del exportador', 3);
      this.addField('País', exporter?.querySelector('ExporterCountry')?.textContent, { required: true, indent: 15 });
      this.addField('Razón social', exporter?.querySelector('ExporterBusinessName')?.textContent, { required: true, indent: 15 });
      this.addField('Identificación fiscal', exporter?.querySelector('ExporterTaxIdentification')?.textContent, { required: true, indent: 15 });
      this.addField('Domicilio comercial', exporter?.querySelector('ExporterBusinessAddress')?.textContent, { required: true, indent: 15 });
      this.addField('Ciudad', exporter?.querySelector('ExporterBusinessCity')?.textContent, { required: true, indent: 15 });
      this.addField('Teléfono', exporter?.querySelector('ExporterTelephone')?.textContent, { optional: true, indent: 15 });
      this.addField('Email', exporter?.querySelector('ExporterEmail')?.textContent, { required: true, indent: 15 });
      this.addField('Website', exporter?.querySelector('ExporterURL')?.textContent, { optional: true, indent: 15 });

      this.addSection('Datos del productor', 3);
      this.addField('País', producer?.querySelector('ProducerCountry')?.textContent, { required: true, indent: 15 });
      this.addField('Razón social', producer?.querySelector('ProducerBusinessName')?.textContent, { required: true, indent: 15 });
      this.addField('Identificación fiscal', producer?.querySelector('ProducerTaxIdentification')?.textContent, { required: true, indent: 15 });
      this.addField('Domicilio comercial', producer?.querySelector('ProducerBusinessAddress')?.textContent, { required: true, indent: 15 });
      this.addField('Ciudad', producer?.querySelector('ProducerBusinessCity')?.textContent, { required: true, indent: 15 });
      this.addField('Domicilio de planta industrial', producer?.querySelector('ProducerFactoryAddress')?.textContent, { optional: true, indent: 15 });
      this.addField('Ciudad de planta industrial', producer?.querySelector('ProducerFactoryCity')?.textContent, { optional: true, indent: 15 });
      this.addField('Teléfono', producer?.querySelector('ProducerTelephone')?.textContent, { optional: true, indent: 15 });
      this.addField('Email', producer?.querySelector('ProducerEmail')?.textContent, { required: true, indent: 15 });
      this.addField('Website', producer?.querySelector('ProducerURL')?.textContent, { optional: true, indent: 15 });

      this.addSection('Producto', 3);
      this.addField('Nombre del producto', formDJO?.querySelector('GoodName')?.textContent, { required: true, indent: 15 });
      this.addMultiField([
        { label: 'Unidad de medida', value: formDJO?.querySelector('GoodMeasureUnit')?.textContent, required: true },
        { label: 'Posición arancelaria (NCM)', value: formDJO?.querySelector('GoodNCM')?.textContent, required: true }
      ], 15);
      this.addMultiField([
        { label: 'Valor FOB Mínimo', value: formDJO?.querySelector('GoodMinFOBValue')?.textContent, required: true },
        { label: 'Valor FOB Máximo', value: formDJO?.querySelector('GoodMaxFOBValue')?.textContent, required: true }
      ], 15);

      this.addListSection('Presentaciones del producto', getGoodVariants(formDJO), (variant) => {
        this.renderGoodVariant(variant);
      });

      this.addSection('Proceso de fabricación', 3);
      this.addField('Descripción', formDJO?.querySelector('ManufacturingProcess > DescriptionOfManufacturingProcess')?.textContent, { required: true, indent: 15 });
      this.addField('Información adicional', formDJO?.querySelector('ManufacturingProcess > OtherInformationOfManufacturingProcess')?.textContent, { optional: true, indent: 15 });

      this.addListSection(
        'Materiales locales',
        Array.from(formDJO?.querySelectorAll('Components > LocalSupplies > LocalSuppliesItem') || []),
        (item) => this.renderLocalSupply(item)
      );

      this.addListSection(
        'Materiales intrazona',
        Array.from(formDJO?.querySelectorAll('Components > IntrazoneSupplies > IntrazoneSuppliesItem') || []),
        (item) => this.renderIntrazoneSupply(item)
      );

      this.addListSection(
        'Materiales extrazona',
        Array.from(formDJO?.querySelectorAll('Components > ExtrazoneSupplies > ExtrazoneSuppliesItem') || []),
        (item) => this.renderExtrazoneSupply(item)
      );

      this.addListSection(
        'Materiales de terceros países PAC',
        Array.from(formDJO?.querySelectorAll('Components > PACThirdCountrySupplies > PACThirdCountrySuppliesItem') || []),
        (item) => this.renderPACSupply(item)
      );

      this.addSection('Declaración Jurada de Origen', 3);
      this.addField('Fecha de DJO', formatDate(djo?.querySelector('Declaration > DeclarationDate')?.textContent), { required: true, indent: 15 });

      this.addSection('Entidad que verifica la DJO', 1);
      this.addField('Código de EH', eh?.querySelector('EHId')?.textContent, { required: true, indent: 10 });
      this.addField('País', eh?.querySelector('EHCountry')?.textContent, { required: true, indent: 10 });
      this.addField('Nombre', eh?.querySelector('EHName')?.textContent, { required: true, indent: 10 });
      this.addField('Domicilio', eh?.querySelector('EHAddress')?.textContent, { required: true, indent: 10 });
      this.addField('Ciudad', eh?.querySelector('EHCity')?.textContent, { required: true, indent: 10 });
      this.addField('Teléfono', eh?.querySelector('EHTelephone')?.textContent, { optional: true, indent: 10 });
      this.addField('Email', eh?.querySelector('EHEmail')?.textContent, { required: true, indent: 10 });
      this.addField('Website', eh?.querySelector('EHURL')?.textContent, { required: true, indent: 10 });

      this.addSection('Verificación', 1);
      this.addMultiField([
        { label: 'Número DJO', value: approvalEH?.querySelector('ApprovalNumber')?.textContent, required: true },
        { label: 'Fecha de verificación', value: formatDate(approvalEH?.querySelector('ApprovalDate')?.textContent), required: true }
      ], 10);
      this.addField('Estado de aceptación', approvalEH?.querySelector('ROMCompliance')?.textContent, { required: true, indent: 10 });

      const pageCount = this.doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        this.doc.setPage(i);
        this.addFooter();
      }

      this.addIncompleteWatermark();

      return this.doc;
    } catch (error) {
      console.error('Error generando PDF:', error);
      throw new Error('Error al generar el PDF: ' + error.message);
    }
  }
}

// Arma el documento jsPDF sin descargarlo — separado de generateDJOPDF para poder probar la
// generación en tests sin disparar una descarga/escritura a disco real.
export const buildDJOPDFDocument = async (xmlData, options = {}) => {
  const generator = new PDFGenerator(xmlData, options);
  const doc = await generator.generatePDF(xmlData);

  const approvalNumber = xmlData.querySelector('ApprovalNumber')?.textContent || 'DJO';
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `DJO_${approvalNumber}_${timestamp}.pdf`;

  return { doc, filename };
};

export const generateDJOPDF = async (xmlData, options = {}) => {
  try {
    const { doc, filename } = await buildDJOPDFDocument(xmlData, options);
    doc.save(filename);
    return { success: true, filename };
  } catch (error) {
    console.error('Error al generar PDF:', error);
    return { success: false, error: error.message };
  }
};
