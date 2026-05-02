import { createLLMProvider } from './llm/factory.js';

export interface DocumentSummary {
  summary: string;
  keyPoints: string[];
  topics: string[];
}

export async function generateDocumentSummary(
  content: string,
  title: string,
  docType: string,
  tenant?: any
): Promise<DocumentSummary> {
  const llm = createLLMProvider(tenant);

  const prompt = `Analizá el siguiente documento de tipo "${docType}" titulado "${title}".

INSTRUCCIONES:
1. Generá un resumen conciso (máximo 3 párrafos) que explique de qué trata el documento
2. Extraé los 3-5 puntos clave más importantes
3. Identificá los temas principales cubiertos (máximo 5 temas)

Respondé ÚNICAMENTE en formato JSON con esta estructura exacta:
{
  "summary": "resumen del documento...",
  "keyPoints": ["punto 1", "punto 2", "punto 3"],
  "topics": ["tema 1", "tema 2", "tema 3"]
}

CONTENIDO DEL DOCUMENTO:
${content.slice(0, 8000)}

${content.length > 8000 ? '\n[Nota: El documento fue truncado por longitud]' : ''}`;

  try {
    const response = await llm.chat([{ role: 'user', content: prompt }], 2000);
    
    // Intentar parsear la respuesta como JSON
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'No se pudo generar un resumen.',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      };
    }
    
    // Fallback si no es JSON válido
    return {
      summary: response.text.slice(0, 500),
      keyPoints: [],
      topics: [],
    };
  } catch (err) {
    // Si no hay LLM configurado, devolver un mensaje genérico
    return {
      summary: `El documento "${title}" es un ${docType.toLowerCase()} que contiene ${content.length} caracteres de texto. Para generar un resumen automático con IA, configurá una API key de OpenAI o Ollama.`,
      keyPoints: ['Contenido cargado exitosamente', `${content.length} caracteres extraídos`],
      topics: [docType],
    };
  }
}
