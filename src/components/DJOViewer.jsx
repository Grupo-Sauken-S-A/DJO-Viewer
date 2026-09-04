"use client";

import React, { useState, useEffect } from 'react';
import { Upload, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Field, Section, DocumentSignatures, InputValidationAlert, EmissionStageAlert } from './signature-components';
import { getCountryName } from './country-codes';
import { validateEncoding, validateStructure, validateSize, validateBOM, decodeXmlBytes } from '@/lib/input-validation';
import { checkSignatureIntegrity, getEmissionStage } from './signature-utils';
import { APP_NAME, APP_VERSION } from '@/lib/app-version';

// Función auxiliar para obtener contenido de cualquiera de los dos tipos de etiquetas
const getOperatorContent = (xmlData, fieldName) => {
  // Intenta primero con ThirdOp
  const thirdOpValue = xmlData.querySelector(`ThirdOp${fieldName}`)?.textContent;
  if (thirdOpValue) return thirdOpValue;
  
  // Si no encuentra ThirdOp, intenta con Op3c
  const op3cValue = xmlData.querySelector(`Op3c${fieldName}`)?.textContent;
  return op3cValue || null;
};

const DJOViewer = () => {
  const [xmlData, setXmlData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inputWarnings, setInputWarnings] = useState([]);
  const [signatureIntegrity, setSignatureIntegrity] = useState({});
  const [emissionStage, setEmissionStage] = useState(null);

  // Función para procesar el XML
  const processXML = (xmlContent, { hasBOM = false } = {}) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('El archivo XML no es válido');
      }

      const bomWarning = validateBOM(hasBOM);
      const warnings = [
        ...validateEncoding(xmlContent),
        ...validateStructure(xmlDoc),
        ...(bomWarning ? [bomWarning] : [])
      ];
      setInputWarnings(warnings);
      setEmissionStage(getEmissionStage(xmlDoc));

      setXmlData(xmlDoc);
      setError(null);

      // Corre server-side (C14N no tiene equivalente en el navegador), se pide una sola vez
      // por documento (no repetida por cada firma) — ver checkSignatureIntegrity en
      // signature-utils.js.
      setSignatureIntegrity({});
      checkSignatureIntegrity(xmlContent).then(setSignatureIntegrity);
    } catch (err) {
      setError('Error al procesar el XML: ' + err.message);
      setXmlData(null);
    }
  };

  // Manejador para carga manual de archivos
  const handleFileUpload = async (event) => {
    try {
      setError(null);
      const file = event.target.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.xml')) {
        setError('Por favor seleccione un archivo XML válido');
        return;
      }

      // Tamaño primero, sobre file.size directo — sin leer el contenido a memoria para
      // archivos que ya sabemos que van a ser rechazados (validateSize bloquea, a
      // diferencia del resto de las validaciones de entrada).
      const sizeError = validateSize(file.size);
      if (sizeError) {
        setError(sizeError);
        return;
      }

      const buffer = await file.arrayBuffer();
      const { content, hasBOM } = decodeXmlBytes(buffer);
      processXML(content, { hasBOM });
    } catch (err) {
      setError('Error al procesar el archivo: ' + err.message);
    }
  };

  // Efecto para cargar XML desde URL si existe en los parámetros
  useEffect(() => {
    const loadXMLFromURL = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const xmlUri = params.get('xmlUri');

            if (xmlUri) {
                setLoading(true);
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(xmlUri)}`;
                const response = await fetch(proxyUrl);

                if (!response.ok) {
                    const body = await response.json().catch(() => null);
                    throw new Error(body?.error || `HTTP error! status: ${response.status}`);
                }

                // El proxy ya aplica el tope de 4MB mientras lee la respuesta remota (ver
                // /api/proxy), pero igual revalidamos acá — y usamos arrayBuffer en vez de
                // .text() para poder detectar un BOM (ver decodeXmlBytes).
                const buffer = await response.arrayBuffer();
                const sizeError = validateSize(buffer.byteLength);
                if (sizeError) {
                    throw new Error(sizeError);
                }
                const { content, hasBOM } = decodeXmlBytes(buffer);
                processXML(content, { hasBOM });
            }
        } catch (err) {
            setError('Error al cargar el XML desde URL: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    loadXMLFromURL();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-gray-600">Cargando...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="max-w-full mx-auto p-4 bg-red-50 rounded-lg text-red-900 border border-red-200">
        <div className="flex items-center">
          <XCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!xmlData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visualizador de Declaración Jurada de Origen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="upload-zone">
            <Upload className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mb-4" />
            <label className="btn-primary mb-3 cursor-pointer">
              Seleccionar Archivo XML
              <input
                type="file"
                accept=".xml"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <p className="text-xs sm:text-sm text-gray-500">
              Seleccione un archivo XML de Declaración Jurada de Origen o use el parámetro xmlUri en la URL
            </p>
            <div className="mt-4 text-center text-xs text-gray-500">
              Desarrollado por <a href="https://sauken.com.ar/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Sauken</a> para{' '}
              <a href="https://certificadoorigen.com.ar/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Certificados de Origen</a>
            </div>
            <div className="mt-1 text-center text-[10px] text-gray-400">
              {APP_NAME} v{APP_VERSION}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const eh = xmlData.querySelector('EH');
  const approvalEH = xmlData.querySelector('ApprovalEH');
  const djo = xmlData.querySelector('DJO');
  const exporter = xmlData.querySelector('Exporter');
  const producer = xmlData.querySelector('Producer');
  const formDJO = xmlData.querySelector('FormDJO');
  const agreement = xmlData.querySelector('Agreement');

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <CardTitle>Declaración Jurada de Origen Digital</CardTitle>
        <label className="btn-primary cursor-pointer text-center">
          Cargar otro archivo
          <input
            type="file"
            accept=".xml"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Etapa de emisión de la DJO */}
          <EmissionStageAlert emissionStage={emissionStage} />

          {/* Advertencias sobre el archivo XML de entrada */}
          <InputValidationAlert warnings={inputWarnings} />

          {/* Estado de Firmas Digitales */}
          <DocumentSignatures xmlDoc={xmlData} integrityResults={signatureIntegrity} />

          {/* Estructura del documento */}
          <Section title="Estructura de Declaración Jurada de Origen" level={0}>
            <Section title="Declaración Jurada de Origen (DJOEH)" level={1} className="col-span-full">
              <Section title="Declaración Jurada de Origen (DJO)" level={2} className="col-span-full">

                {/* Información General */}
                <Section title="Información general" level={3} className="col-span-full">
                  <Field 
                    label="Versión" 
                    value={djo?.querySelector('DJOVer')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Tipo de remitente" 
                    value={djo?.querySelector('DJOSubmitterType')?.textContent}
                    required={true}
                  />
                </Section>

                {/* Acuerdo */}
                <Section title="Acuerdo comercial" level={3} className="col-span-full">
                  <Field 
                    label="Acrónimo" 
                    value={agreement?.querySelector('AgreementAcronym')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Norma de origen" 
                    value={agreement?.querySelector('OriginRule')?.textContent}
                    required={true}
                  />
                </Section>

                {/* Exportador */}
                <Section title="Datos del exportador" level={3} className="col-span-full">
                  <Field 
                    label="País" 
                    value={exporter?.querySelector('ExporterCountry')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Razón social" 
                    value={exporter?.querySelector('ExporterBusinessName')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Identificación fiscal" 
                    value={exporter?.querySelector('ExporterTaxIdentification')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Domicilio comercial" 
                    value={exporter?.querySelector('ExporterBusinessAddress')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Ciudad" 
                    value={exporter?.querySelector('ExporterBusinessCity')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Teléfono" 
                    value={exporter?.querySelector('ExporterTelephone')?.textContent}
                    optional={true}
                  />
                  <Field 
                    label="Email" 
                    value={exporter?.querySelector('ExporterEmail')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Website" 
                    value={exporter?.querySelector('ExporterURL')?.textContent}
                    optional={true}
                  />
                </Section>

                {/* Productor */}
                <Section title="Datos del productor" level={3} className="col-span-full">
                  <Field 
                    label="País" 
                    value={producer?.querySelector('ProducerCountry')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Razón social" 
                    value={producer?.querySelector('ProducerBusinessName')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Identificación fiscal" 
                    value={producer?.querySelector('ProducerTaxIdentification')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Domicilio comercial" 
                    value={producer?.querySelector('ProducerBusinessAddress')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Ciudad" 
                    value={producer?.querySelector('ProducerBusinessCity')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Domicilio de planta industrial" 
                    value={producer?.querySelector('ProducerFactoryAddress')?.textContent}
                    optional={true}
                  />
                  <Field 
                    label="Ciudad de planta industrial" 
                    value={producer?.querySelector('ProducerFactoryCity')?.textContent}
                    optional={true}
                  />
                  <Field 
                    label="Teléfono" 
                    value={producer?.querySelector('ProducerTelephone')?.textContent}
                    optional={true}
                  />
                  <Field 
                    label="Email" 
                    value={producer?.querySelector('ProducerEmail')?.textContent}
                    required={true}
                  />
                  <Field 
                    label="Website" 
                    value={producer?.querySelector('ProducerURL')?.textContent}
                    optional={true}
                  />
                </Section>

                {/* Producto */}
                <Section title="Producto" level={3} className="col-span-full">
                  <Field 
                    label="Nombre del producto"
                    value={formDJO?.querySelector('GoodName')?.textContent}
                    required={true}
                  />
                  <div className="flex-row-container">
                    <Field 
                      label="Unidad de medida"
                      value={formDJO?.querySelector('GoodMeasureUnit')?.textContent}
                      required={true}
                    />
                    <Field 
                      label="Posición arancelaria (NCM)"
                      value={formDJO?.querySelector('GoodNCM')?.textContent}
                      required={true}
                    />
                  </div>
                  <div className="flex-row-container">
                    <Field 
                      label="Valor FOB Mínimo"
                      value={formDJO?.querySelector('GoodMinFOBValue')?.textContent}
                      required={true}
                    />
                    <Field 
                      label="Valor FOB Máximo"
                      value={formDJO?.querySelector('GoodMaxFOBValue')?.textContent}
                      required={true}
                    />
                  </div>
                </Section>

                {/* Variantes de Producto */}
                <Section 
                  title="Presentaciones del producto" 
                  level={3}
                  className="col-span-full"
                  count={parseInt(formDJO?.querySelector('GoodVariantQty')?.textContent || '0')}
                >
                  {/* Vamos a buscar todas las variantes de producto */}
                  {(() => {
                    if (!formDJO) return null;
                    
                    const goodVariant = formDJO.querySelector('GoodVariant');
                    if (!goodVariant) return null;
                      
                    const variantCodes = Array.from(goodVariant.querySelectorAll('GoodVariantItem'));
                      
                    return variantCodes.map((codeElement, index) => {
                      // Encontrar todos los elementos que pertenecen a esta variante
                      const startIdx = goodVariant.innerHTML.indexOf(`<GoodVariantItem>${codeElement.textContent}</GoodVariantItem>`);
                      const nextCodeIdx = index < variantCodes.length - 1 
                        ? goodVariant.innerHTML.indexOf(`<GoodVariantItem>${variantCodes[index + 1].textContent}</GoodVariantItem>`)
                        : goodVariant.innerHTML.length;
                        
                      const variantSubstring = goodVariant.innerHTML.substring(startIdx, nextCodeIdx);
                      const variantFragment = document.createRange().createContextualFragment(variantSubstring);
                        
                      // Extraer valores para esta variante
                      const getTextContent = (selector) => {
                        const element = variantFragment.querySelector(selector);
                        return element ? element.textContent : null;
                      };
                        
                      return (
                        <div key={index} className="item-card goods">
                          <div className="flex-row-container">
                            <Field 
                              label="Ítem"
                              value={getTextContent('GoodVariantItem')}
                              required={true}
                            />
                            <Field 
                              label="Código de producto"
                              value={getTextContent('GoodVariantExporterCode')}
                              required={true}
                            />
                          </div>
                          <Field 
                            label="Nombre del producto"
                            value={getTextContent('GoodVariantName')}
                            required={true}
                          />
                          <Field 
                            label="Descripción"
                            value={getTextContent('GoodVariantDescription')}
                            required={true}
                          />
                        </div>
                      );
                    });
                  })()}
                </Section>

                {/* Proceso de Fabricación */}
                <Section title="Proceso de fabricación" level={3} className="col-span-full">
                  <div>
                    <Field 
                      label="Descripción" 
                      value={formDJO?.querySelector('ManufacturingProcess > DescriptionOfManufacturingProcess')?.textContent}
                      required={true}
                    />
                  </div>
                  <div>
                    <Field 
                      label="Información adicional" 
                      value={formDJO?.querySelector('ManufacturingProcess > OtherInformationOfManufacturingProcess')?.textContent}
                      optional={true}
                    />
                  </div>
                </Section>

                {/* Componentes - Suministros Locales */}
                <Section 
                  title="Materiales locales" 
                  level={3}
                  className="col-span-full"
                  count={parseInt(formDJO?.querySelector('Components > LocalSupplies > LocalSuppliesQty')?.textContent || '0')}
                >
                  {Array.from(formDJO?.querySelectorAll('Components > LocalSupplies > LocalSuppliesItem') || []).map((item, index) => (
                    <div key={index} className="item-card goods">
                      <div className="flex-row-container">
                        <Field 
                          label="Ítem"
                          value={item.querySelector('LocalSupplieGoodItem')?.textContent}
                          required={true}
                        />
                        <Field 
                          label="Posición arancelaria (NCM)"
                          value={item.querySelector('LocalSupplieGoodNCM')?.textContent}
                          optional={true}
                        />
                      </div>
                      <div className="flex-row-container">
                        <Field 
                          label="Descripción"
                          value={item.querySelector('LocalSupplieGoodDescription')?.textContent}
                          required={true}
                        />
                      </div>
                      <div className="flex-row-container">
                        <Field 
                          label="Proveedor"
                          value={item.querySelector('LocalSupplierBusinessName')?.textContent}
                          required={true}
                        />
                      </div>
                    </div>
                  ))}
                </Section>

                {/* Componentes - Suministros Intrazona */}
                <Section 
                  title="Materiales intrazona" 
                  level={3}
                  className="col-span-full"
                  count={parseInt(formDJO?.querySelector('Components > IntrazoneSupplies > IntrazoneSuppliesQty')?.textContent || '0')}
                >
                  {Array.from(formDJO?.querySelectorAll('Components > IntrazoneSupplies > IntrazoneSuppliesItem') || []).map((item, index) => (
                    <div key={index} className="item-card goods">
                      <div className="flex-row-container">
                        <Field 
                          label="Ítem"
                          value={item.querySelector('IntrazoneSupplieGoodItem')?.textContent}
                          required={true}
                        />
                        <Field 
                          label="Posición arancelaria (NCM)"
                          value={item.querySelector('IntrazoneSupplieGoodNCM')?.textContent}
                          required={true}
                        />
                      </div>
                      <Field 
                        label="Descripción"
                        value={item.querySelector('IntrazoneSupplieGoodDescription')?.textContent}
                        required={true}
                      />
                      <div className="flex-row-container">
                        <Field 
                          label="Proveedor"
                          value={item.querySelector('IntrazoneSupplierBusinessName')?.textContent}
                          required={true}
                        />
                        <Field 
                          label="País"
                          value={item.querySelector('IntrazoneSupplierCountry')?.textContent}
                          required={true}
                        />
                      </div>
                      <div className="flex-row-container">
                        <Field 
                          label="Valor CIF"
                          value={item.querySelector('IntrazoneSupplieGoodCIFValue')?.textContent}
                          required={true}
                        />
                        <Field 
                          label="% sobre FOB"
                          value={item.querySelector('IntrazoneSupplieGoodPercOnFOBValue')?.textContent}
                          required={true}
                        />
                      </div>
                      <div className="flex-row-container">
                        <Field 
                          label="Fecha de DJM" 
                            value={(() => {
                            const date = item.querySelector('IntrazoneSupplieDJMDate')?.textContent;
                            return date ? new Date(date).toLocaleDateString() : null;
                          })()}
                          optional={true}
                        />
                        <Field 
                          label="Número DJM"
                          value={item.querySelector('IntrazoneSupplieDJMNumber')?.textContent}
                          optional={true}
                        />
                      </div>
                    </div>
                  ))}
                </Section>

                {/* Componentes - Suministros Extrazona */}
                <Section 
                  title="Materiales extrazona" 
                  level={3}
                  className="col-span-full"
                  count={parseInt(formDJO?.querySelector('Components > ExtrazoneSupplies > ExtrazoneSuppliesQty')?.textContent || '0')}
                >
                  {Array.from(formDJO?.querySelectorAll('Components > ExtrazoneSupplies > ExtrazoneSuppliesItem') || []).map((item, index) => (
                    <div key={index} className="item-card goods">
                      <div className="flex-row-container">
                        <Field 
                          label="Ítem"
                          value={item.querySelector('ExtrazoneSupplieGoodItem')?.textContent}
                          required={true}
                        />
                        <Field 
                          label="Posición arancelaria (NCM)"
                          value={item.querySelector('ExtrazoneSupplieGoodNCM')?.textContent}
                          required={true}
                        />
                      </div>
                      <Field 
                        label="Descripción"
                        value={item.querySelector('ExtrazoneSupplieGoodDescription')?.textContent}
                        required={true}
                      />
                      <div className="flex-row-container">
                        <Field 
                          label="Proveedor"
                          value={item.querySelector('ExtrazoneSupplierBusinessName')?.textContent}
                          required={true}
                        />
                        <Field 
                          label="País"
                          value={item.querySelector('ExtrazoneSupplierCountry')?.textContent}
                          required={true}
                        />
                      </div>
                      <div className="flex-row-container">
                        <Field 
                          label="Valor CIF"
                          value={item.querySelector('ExtrazoneSupplieGoodCIFValue')?.textContent}
                          required={true}
                        />
                        <Field 
                          label="% sobre FOB"
                          value={item.querySelector('ExtrazoneSupplieGoodPercOnFOBValue')?.textContent}
                          required={true}
                        />
                      </div>
                    </div>
                  ))}
                </Section>

                {/* Componentes - Suministros Terceros Países PAC */}
                <Section 
                  title="Materiales de terceros países PAC" 
                  level={3}
                  className="col-span-full"
                  count={parseInt(formDJO?.querySelector('Components > PACThirdCountrySupplies > PACThirdCountrySuppliesQty')?.textContent || '0')}
                >
                  {parseInt(formDJO?.querySelector('Components > PACThirdCountrySupplies > PACThirdCountrySuppliesQty')?.textContent || '0') > 0 && 
                    Array.from(formDJO?.querySelectorAll('Components > PACThirdCountrySupplies > PACThirdCountrySuppliesItem') || []).map((item, index) => (
                      <div key={index} className="item-card goods">
                        <div className="flex-row-container">
                          <Field 
                            label="Ítem"
                            value={item.querySelector('PACThirdCountrySupplieGoodItem')?.textContent}
                            required={true}
                          />
                          <Field 
                            label="Posición arancelaria (NCM)"
                            value={item.querySelector('PACThirdCountrySupplieGoodNCM')?.textContent}
                            required={true}
                          />
                        </div>
                        <Field 
                          label="Descripción"
                          value={item.querySelector('PACThirdCountrySupplieGoodDescription')?.textContent}
                          required={true}
                        />
                        <div className="flex-row-container">
                          <Field 
                            label="Proveedor"
                            value={item.querySelector('PACThirdCountrySupplierBusinessName')?.textContent}
                            required={true}
                          />
                          <Field 
                            label="País"
                            value={item.querySelector('PACThirdCountrySupplierCountry')?.textContent}
                            required={true}
                          />
                        </div>
                        <div className="flex-row-container">
                          <Field 
                            label="Valor CIF"
                            value={item.querySelector('PACThirdCountrySupplieGoodCIFValue')?.textContent}
                            required={true}
                          />
                          <Field 
                            label="% sobre FOB"
                            value={item.querySelector('PACThirdCountrySupplieGoodPercOnFOBValue')?.textContent}
                            required={true}
                          />
                        </div>
                        <Field 
                          label="Código CCPAC"
                          value={item.querySelector('CCPACCode')?.textContent}
                          required={true}
                        />
                      </div>
                    ))
                  }
                </Section>

                {/* Declaración */}
                <Section title="Declaración Jurada de Origen" level={3} className="col-span-full">
                  <Field 
                    label="Fecha de DJO" 
                    value={(() => {
                      const date = djo?.querySelector('Declaration > DeclarationDate')?.textContent;
                      return date ? new Date(date).toLocaleDateString() : null;
                    })()}
                    required={true}
                  />
                </Section>
              </Section>
            </Section>

          {/* Entidad Habilitada */}
          <Section title="Entidad que verifica la DJO" level={1} className="col-span-full">
            <Field 
              label="Código de EH" 
              value={eh?.querySelector('EHId')?.textContent}
              required={true}
            />
            <Field 
              label="País" 
              value={eh?.querySelector('EHCountry')?.textContent}
              required={true}
            />
            <Field 
              label="Nombre" 
              value={eh?.querySelector('EHName')?.textContent}
              required={true}
            />
            <Field 
              label="Domicilio" 
              value={eh?.querySelector('EHAddress')?.textContent}
              required={true}
            />
            <Field 
              label="Ciudad" 
              value={eh?.querySelector('EHCity')?.textContent}
              required={true}
            />
            <Field 
              label="Teléfono" 
              value={eh?.querySelector('EHTelephone')?.textContent}
              optional={true}
            />
            <Field 
              label="Email" 
              value={eh?.querySelector('EHEmail')?.textContent}
              required={true}
            />
            <Field 
              label="Website" 
              value={eh?.querySelector('EHURL')?.textContent}
              required={true}
            />
          </Section>

          {/* Aprobación EH */}
          <Section title="Verificación" level={1} className="col-span-full">
            <div className="flex-row-container">
              <Field 
                label="Número DJO" 
                value={approvalEH?.querySelector('ApprovalNumber')?.textContent}
                required={true}
              />
              <Field 
                label="Fecha de verificación" 
                value={(() => {
                  const date = approvalEH?.querySelector('ApprovalDate')?.textContent;
                  return date ? new Date(date).toLocaleDateString() : null;
                })()}
                required={true}
              />
            </div>
            <div>
              <Field 
                label="Estado de aceptación" 
                value={approvalEH?.querySelector('ROMCompliance')?.textContent}
                required={true}
              />
            </div>
          </Section>
        </Section>

        <div className="text-center text-[10px] text-gray-400 pt-2">
          {APP_NAME} v{APP_VERSION}
        </div>
      </div>
      </CardContent>
    </Card>
  );
};

export default DJOViewer;