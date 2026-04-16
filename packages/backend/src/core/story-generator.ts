/**
 * Story Generator — PO-Agile-Master
 * 
 * Genera historias de usuario usando el prompt de PO-Agile-Master,
 * un agente experto en Product Ownership con metodología INVEST.
 * 
 * Si LLM_API_KEY está configurado, usa OpenAI/Anthropic.
 * Si no, usa un generador mock mejorado con la misma metodología.
 * 
 * Requerimientos: 1.1-1.5, 3.1-3.5, 10.1, 10.4, 11.1-11.5, 12.1-12.3, 12.5
 */

import { callLLM } from './llm-client';
import {
  Story,
  Epic,
  Ambiguity,
  AcceptanceCriterion,
  ProjectContext,
} from '@po-ai/shared';
import {
  createStory,
  createEpic,
  createAmbiguity,
  createAcceptanceCriterion,
  updateStory,
} from './models';
import { validate } from './invest-validator';
import { mapComponentsToStories } from '../integration/figma-analyzer';

export interface GenerationInput {
  description: string;
  context?: ProjectContext;
  figmaData?: any;
  productContext?: string;
  businessObjective?: string;
}

export interface GenerationResult {
  stories: Story[];
  ambiguities: Ambiguity[];
  epics?: Epic[];
}

export interface StoryChanges {
  title?: string;
  role?: string;
  action?: string;
  value?: string;
  description?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
  components?: string[];
}

const VAGUE_TERMS = [
  'rápidamente', 'rápido', 'veloz',
  'adecuado', 'apropiado',
  'user-friendly', 'fácil de usar', 'intuitivo',
  'eficiente', 'óptimo',
  'muchos', 'varios', 'algunos',
  'mejor', 'peor',
];

/**
 * System prompt para PO-Agile-Master
 */
function buildSystemPrompt(): string {
  return `Actúa como "PO-Agile-Master", un Product Owner experto con más de 10 años de experiencia en desarrollo de software bajo marcos ágiles como Scrum. Tu misión es transformar requisitos, ideas o descripciones de funcionalidades en Historias de Usuario (HU) impecables, claras, concisas y listas para un Sprint.

Proceso de Razonamiento Obligatorio:
1. Análisis del Requisito: Descompón la solicitud. ¿Cuál es el problema real? ¿Qué valor aporta?
2. Identificación de la Persona: Identifica el rol específico. Evita "usuario" genérico. Sé específico (ej. "Comprador recurrente", "Administrador de inventario").
3. Definición del Objetivo: Acción concreta y observable que debe poder realizar el usuario.
4. Articulación del Beneficio: Valor o beneficio final. El "porqué" que justifica la historia.
5. Criterios de Aceptación: Condiciones específicas, medibles y testables en formato Dado-Cuando-Entonces. Cubrir camino feliz, casos borde y errores.
6. Verificación INVEST: Independiente, Negociable, Valiosa, Estimable, Small, Testable.

IMPORTANTE: Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "stories": [
    {
      "title": "Título corto y descriptivo",
      "role": "Tipo de usuario específico",
      "action": "acción concreta",
      "value": "beneficio o valor",
      "description": "Descripción completa de la funcionalidad",
      "acceptanceCriteria": [
        { "title": "Nombre del escenario", "given": "contexto", "when": "acción", "then": "resultado", "type": "positive|negative|error" }
      ],
      "components": ["componente-sugerido"]
    }
  ],
  "epics": [
    {
      "title": "Nombre de la épica",
      "description": "Descripción del objetivo de la épica",
      "storyIndices": [0, 1, 2]
    }
  ],
  "clarificationQuestions": ["pregunta 1", "pregunta 2"]
}

Genera entre 1 y 5 historias según la complejidad. Cada historia debe tener mínimo 3 criterios de aceptación (positivo, negativo, error). Los criterios deben ser específicos al contexto, NO genéricos.

Agrupa las historias en una o más épicas coherentes. Cada épica debe tener un nombre descriptivo, una descripción del objetivo, y un array "storyIndices" con los índices (base 0) de las historias que pertenecen a esa épica. Toda historia debe pertenecer a al menos una épica.`;
}

function buildUserPrompt(input: GenerationInput): string {
  let prompt = '';
  if (input.productContext) {
    prompt += `**Producto:** ${input.productContext}\n`;
  }
  if (input.businessObjective) {
    prompt += `**Objetivo de Negocio Actual:** ${input.businessObjective}\n`;
  }
  if (input.figmaData?.components?.length > 0) {
    const names = input.figmaData.components.map((c: any) => c.name).join(', ');
    prompt += `**Componentes UI detectados en Figma:** ${names}\n`;
  }
  prompt += `\n**Requisito del usuario:**\n${input.description}`;
  return prompt;
}

/**
 * Parsea la respuesta del LLM y convierte a Story[]
 */
function parseLLMResponse(raw: string): { stories: Story[]; questions: string[]; epics: Epic[] } {
  // Extraer JSON del response (puede venir envuelto en markdown)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { stories: [], questions: [], epics: [] };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const stories: Story[] = (parsed.stories || []).map((s: any) => {
      const criteria = (s.acceptanceCriteria || []).map((ac: any) =>
        createAcceptanceCriterion({
          given: ac.given || '',
          when: ac.when || '',
          then: ac.then || '',
          type: ac.type || 'positive',
        })
      );
      const story = createStory({
        title: s.title || 'Historia sin título',
        role: s.role || 'usuario',
        action: s.action || '',
        value: s.value || '',
        description: s.description || '',
        acceptanceCriteria: criteria,
        components: s.components || [],
      });
      const result = validate(story);
      story.investScore = result.score;
      return story;
    });

    // Parse epics from LLM response and assign epicId to stories
    const epics: Epic[] = [];
    if (Array.isArray(parsed.epics) && parsed.epics.length > 0) {
      for (const rawEpic of parsed.epics) {
        const epic = createEpic({
          title: rawEpic.title || 'Épica sin título',
          description: rawEpic.description || '',
          businessValue: rawEpic.description || '',
          stories: [],
        });

        // Map storyIndices to actual story IDs and assign epicId
        const indices: number[] = Array.isArray(rawEpic.storyIndices) ? rawEpic.storyIndices : [];
        for (const idx of indices) {
          if (idx >= 0 && idx < stories.length) {
            epic.stories.push(stories[idx].id);
            stories[idx].epicId = epic.id;
          }
        }

        epics.push(epic);
      }
    }

    return { stories, questions: parsed.clarificationQuestions || [], epics };
  } catch {
    return { stories: [], questions: [], epics: [] };
  }
}

/**
 * Detecta ambigüedades en una descripción
 */
export function detectAmbiguities(description: string): Ambiguity[] {
  const ambiguities: Ambiguity[] = [];
  const lowerDesc = description.toLowerCase();

  for (const term of VAGUE_TERMS) {
    if (lowerDesc.includes(term)) {
      ambiguities.push(createAmbiguity({
        type: 'vague_term', location: 'descripción', term,
        question: `¿Qué significa específicamente "${term}" en este contexto? ¿Puedes proporcionar una métrica medible?`,
        suggestions: [
          'Define un tiempo específico (ej: "en menos de 2 segundos")',
          'Define una cantidad específica (ej: "hasta 100 elementos")',
          'Define un criterio objetivo (ej: "con menos de 3 clics")',
        ],
      }));
    }
  }

  const roleIndicators = ['como', 'usuario', 'administrador', 'cliente', 'operador'];
  if (!roleIndicators.some(i => lowerDesc.includes(i))) {
    ambiguities.push(createAmbiguity({
      type: 'missing_role', location: 'descripción', term: 'rol de usuario',
      question: '¿Quién es el usuario que utilizará esta funcionalidad?',
      suggestions: ['Usuario final', 'Administrador del sistema', 'Cliente', 'Operador'],
    }));
  }

  if (description.length < 20) {
    ambiguities.push(createAmbiguity({
      type: 'unclear_scope', location: 'descripción', term: 'alcance',
      question: 'La descripción es muy breve. ¿Puedes proporcionar más detalles?',
      suggestions: ['Describe el flujo principal', 'Menciona las acciones clave', 'Indica qué datos se manejan'],
    }));
  }

  return ambiguities;
}

/**
 * Genera historias de usuario.
 * Si LLM_API_KEY está configurado, usa el LLM con prompt PO-Agile-Master.
 * Si no, usa el generador mock mejorado.
 */
export async function generateStories(input: GenerationInput): Promise<GenerationResult> {
  const ambiguities = detectAmbiguities(input.description);
  const critical = ambiguities.filter(a => a.type === 'missing_role');
  if (critical.length > 0 && input.description.length < 20) {
    return { stories: [], ambiguities };
  }

  const llmKey = process.env.LLM_API_KEY;

  if (llmKey) {
    try {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(input);
      const raw = await callLLM(systemPrompt, userPrompt);
      const { stories, questions, epics } = parseLLMResponse(raw);
      const extraAmbiguities = questions.map(q => createAmbiguity({
        type: 'unclear_scope', location: 'LLM', term: '',
        question: q, suggestions: [],
      }));
      return { stories, ambiguities: [...ambiguities, ...extraAmbiguities], epics: epics.length > 0 ? epics : undefined };
    } catch (err: any) {
      console.error('LLM call failed, falling back to mock:', err.message);
    }
  }

  // Fallback: generador mock mejorado
  const stories = generateMockStories(input);
  return { stories, ambiguities };
}

function generateMockStories(input: GenerationInput): Story[] {
  const { description, context, figmaData } = input;
  const stories: Story[] = [];

  if (figmaData?.components?.length > 0) {
    const mappings = mapComponentsToStories(figmaData.components);
    for (const { component, storyHint } of mappings) {
      const role = extractRole(storyHint + ' ' + description, context);
      const action = extractActionFromHint(storyHint);
      const value = extractValue(description);
      const ac = generateMockAcceptanceCriteria(storyHint);
      const story = createStory({
        title: `${role.charAt(0).toUpperCase() + role.slice(1)} - ${action}`,
        role, action, value, description: storyHint, acceptanceCriteria: ac,
        components: [component.name.toLowerCase().replace(/\s+/g, '-')],
      });
      story.investScore = validate(story).score;
      stories.push(story);
    }
    return stories;
  }

  const role = extractRole(description, context);
  const action = extractAction(description);
  const value = extractValue(description);
  const components = suggestComponents(description, context);
  const ac = generateMockAcceptanceCriteria(description);
  const story = createStory({
    title: generateTitle(role, action),
    role, action, value, description, acceptanceCriteria: ac, components,
  });
  story.investScore = validate(story).score;
  stories.push(story);
  return stories;
}

function extractActionFromHint(hint: string): string {
  const match = hint.match(/quiero (.+)/i);
  return match ? match[1] : extractAction(hint);
}

function extractRole(description: string, context?: ProjectContext): string {
  const l = description.toLowerCase();
  if (l.includes('administrador')) return 'administrador';
  if (l.includes('cliente')) return 'cliente';
  if (l.includes('operador')) return 'operador';
  if (l.includes('comprador')) return 'comprador';
  if (context?.userRoles?.length) return context.userRoles[0];
  return 'usuario';
}

function extractAction(description: string): string {
  const l = description.toLowerCase();
  if (l.includes('crear')) return 'crear elementos';
  if (l.includes('editar') || l.includes('modificar')) return 'editar información';
  if (l.includes('eliminar') || l.includes('borrar')) return 'eliminar elementos';
  if (l.includes('ver') || l.includes('visualizar')) return 'ver información';
  if (l.includes('buscar') || l.includes('filtrar')) return 'buscar y filtrar datos';
  if (l.includes('exportar')) return 'exportar datos';
  if (l.includes('configurar')) return 'configurar opciones';
  return 'gestionar la funcionalidad';
}

function extractValue(description: string): string {
  const l = description.toLowerCase();
  if (l.includes('para que')) {
    const parts = description.split(/para que/i);
    if (parts.length > 1) return parts[1].trim();
  }
  if (l.includes('crear')) return 'pueda agregar nueva información al sistema';
  if (l.includes('editar')) return 'pueda mantener la información actualizada';
  if (l.includes('buscar')) return 'pueda encontrar información rápidamente';
  return 'pueda completar mi trabajo de manera eficiente';
}

function generateTitle(role: string, action: string): string {
  return `${role.charAt(0).toUpperCase() + role.slice(1)} - ${action}`;
}

function generateMockAcceptanceCriteria(description: string): AcceptanceCriterion[] {
  const l = description.toLowerCase();
  const criteria: AcceptanceCriterion[] = [];

  // Criterio positivo contextualizado
  if (l.includes('buscar') || l.includes('filtrar')) {
    criteria.push(createAcceptanceCriterion({ given: 'el usuario está en la página principal', when: 'ingresa un término de búsqueda y presiona Enter', then: 'se muestra una lista de resultados que coinciden con el término', type: 'positive' }));
    criteria.push(createAcceptanceCriterion({ given: 'el usuario busca un término sin resultados', when: 'presiona Enter', then: 'se muestra un mensaje "No se encontraron resultados"', type: 'negative' }));
  } else if (l.includes('crear') || l.includes('formulario')) {
    criteria.push(createAcceptanceCriterion({ given: 'el usuario está en el formulario de creación', when: 'completa todos los campos requeridos y envía', then: 'el elemento se crea exitosamente y se muestra confirmación', type: 'positive' }));
    criteria.push(createAcceptanceCriterion({ given: 'el usuario deja campos requeridos vacíos', when: 'intenta enviar el formulario', then: 'se muestran mensajes de validación en los campos faltantes', type: 'negative' }));
  } else {
    criteria.push(createAcceptanceCriterion({ given: 'el usuario está autenticado en el sistema', when: 'realiza la acción principal', then: 'el sistema procesa la solicitud exitosamente y muestra confirmación', type: 'positive' }));
    criteria.push(createAcceptanceCriterion({ given: 'el usuario proporciona datos inválidos', when: 'intenta realizar la acción', then: 'el sistema muestra un mensaje de error descriptivo', type: 'negative' }));
  }

  // Criterio de error siempre
  criteria.push(createAcceptanceCriterion({ given: 'ocurre un error inesperado en el servidor', when: 'el sistema intenta procesar la solicitud', then: 'el usuario recibe un mensaje de error amigable y puede reintentar', type: 'error' }));

  return criteria;
}

export function suggestComponents(description: string, context?: ProjectContext): string[] {
  const components: string[] = [];
  const l = description.toLowerCase();
  if (l.includes('login') || l.includes('autenticación')) components.push('authentication');
  if (l.includes('formulario') || l.includes('crear') || l.includes('editar')) components.push('forms');
  if (l.includes('tabla') || l.includes('lista') || l.includes('ver')) components.push('data-display');
  if (l.includes('buscar') || l.includes('filtrar')) components.push('search');
  if (l.includes('exportar') || l.includes('importar')) components.push('data-import-export');
  if (l.includes('notificación') || l.includes('alerta')) components.push('notifications');
  if (l.includes('reporte') || l.includes('dashboard')) components.push('reporting');
  if (context?.existingComponents) {
    for (const c of context.existingComponents) {
      if (l.includes(c.toLowerCase())) components.push(c);
    }
  }
  if (components.length === 0) components.push('core');
  return [...new Set(components)];
}

export async function refineStory(story: Story, changes: StoryChanges): Promise<Story> {
  const updated = updateStory(story, changes);
  updated.investScore = validate(updated).score;
  return updated;
}

export function updateComponentsList(context: ProjectContext, newComponents: string[]): ProjectContext {
  const existing = new Set(context.existingComponents);
  for (const c of newComponents) existing.add(c);
  return { ...context, existingComponents: Array.from(existing) };
}
