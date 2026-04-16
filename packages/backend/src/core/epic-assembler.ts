/**
 * Epic Assembler
 * 
 * Agrupa historias relacionadas en épicas coherentes.
 * Identifica dependencias entre historias.
 * Descompone épicas grandes en épicas más pequeñas.
 * 
 * Requerimientos: 4.1-4.5, 12.4
 */

import {
  Story,
  Epic,
  Dependency,
} from '@po-ai/shared';
import {
  createEpic,
  createDependency,
  updateEpic,
  addStoryToEpic,
  removeStoryFromEpic,
} from './models';

/**
 * Umbral para considerar una épica como "grande"
 */
const LARGE_EPIC_THRESHOLD = 10;

/**
 * Umbral de similitud para agrupar historias (0-1)
 */
const SIMILARITY_THRESHOLD = 0.3;

/**
 * Ensambla épicas desde un conjunto de historias
 */
export function assembleEpics(stories: Story[]): Epic[] {
  if (stories.length === 0) {
    return [];
  }

  // Agrupar historias por similitud
  const groups = groupStoriesBySimilarity(stories);

  // Crear épicas desde los grupos
  const epics: Epic[] = [];
  
  for (const group of groups) {
    const epic = createEpicFromStories(group);
    epics.push(epic);
  }

  // Identificar dependencias dentro de cada épica
  for (const epic of epics) {
    const epicStories = stories.filter(s => epic.stories.includes(s.id));
    const dependencies = identifyDependencies(epicStories);
    epic.dependencies = dependencies;
  }

  // Descomponer épicas grandes
  const finalEpics: Epic[] = [];
  for (const epic of epics) {
    if (epic.stories.length > LARGE_EPIC_THRESHOLD) {
      const decomposed = decomposeEpic(epic, stories);
      finalEpics.push(...decomposed);
    } else {
      finalEpics.push(epic);
    }
  }

  return finalEpics;
}

/**
 * Agrupa historias por similitud semántica y componentes compartidos
 */
function groupStoriesBySimilarity(stories: Story[]): Story[][] {
  const groups: Story[][] = [];
  const assigned = new Set<string>();

  for (const story of stories) {
    if (assigned.has(story.id)) {
      continue;
    }

    // Crear nuevo grupo con esta historia
    const group: Story[] = [story];
    assigned.add(story.id);

    // Buscar historias similares
    for (const otherStory of stories) {
      if (assigned.has(otherStory.id)) {
        continue;
      }

      const similarity = calculateSimilarity(story, otherStory);
      
      if (similarity >= SIMILARITY_THRESHOLD) {
        group.push(otherStory);
        assigned.add(otherStory.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Calcula similitud entre dos historias (0-1)
 * Basado en componentes compartidos y palabras clave en común
 */
function calculateSimilarity(story1: Story, story2: Story): number {
  let score = 0;
  let factors = 0;

  // Similitud por componentes compartidos (peso: 0.5)
  if (story1.components.length > 0 && story2.components.length > 0) {
    const sharedComponents = story1.components.filter(c => 
      story2.components.includes(c)
    );
    const componentSimilarity = sharedComponents.length / 
      Math.max(story1.components.length, story2.components.length);
    score += componentSimilarity * 0.5;
    factors += 0.5;
  }

  // Similitud por rol compartido (peso: 0.2)
  if (story1.role === story2.role) {
    score += 0.2;
  }
  factors += 0.2;

  // Similitud por palabras clave en acción (peso: 0.3)
  const action1Words = new Set(story1.action.toLowerCase().split(/\s+/));
  const action2Words = new Set(story2.action.toLowerCase().split(/\s+/));
  
  const sharedWords = [...action1Words].filter(w => action2Words.has(w));
  const actionSimilarity = sharedWords.length / 
    Math.max(action1Words.size, action2Words.size);
  score += actionSimilarity * 0.3;
  factors += 0.3;

  return factors > 0 ? score / factors : 0;
}

/**
 * Crea una épica desde un grupo de historias
 */
function createEpicFromStories(stories: Story[]): Epic {
  // Generar título basado en componentes y acciones comunes
  const title = generateEpicTitle(stories);
  
  // Generar descripción
  const description = generateEpicDescription(stories);
  
  // Generar valor de negocio
  const businessValue = generateBusinessValue(stories);

  return createEpic({
    title,
    description,
    businessValue,
    stories: stories.map(s => s.id),
    dependencies: [],
  });
}

/**
 * Genera un título para la épica basado en las historias
 */
function generateEpicTitle(stories: Story[]): string {
  // Encontrar componentes más comunes
  const componentCounts = new Map<string, number>();
  
  for (const story of stories) {
    for (const component of story.components) {
      componentCounts.set(component, (componentCounts.get(component) || 0) + 1);
    }
  }

  // Componente más común
  let mostCommonComponent = 'Sistema';
  let maxCount = 0;
  
  for (const [component, count] of componentCounts.entries()) {
    if (count > maxCount) {
      mostCommonComponent = component;
      maxCount = count;
    }
  }

  // Encontrar acción más común
  const actionWords = new Map<string, number>();
  
  for (const story of stories) {
    const words = story.action.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3) { // Ignorar palabras cortas
        actionWords.set(word, (actionWords.get(word) || 0) + 1);
      }
    }
  }

  let mostCommonAction = 'Gestión';
  maxCount = 0;
  
  for (const [word, count] of actionWords.entries()) {
    if (count > maxCount) {
      mostCommonAction = word.charAt(0).toUpperCase() + word.slice(1);
      maxCount = count;
    }
  }

  return `${mostCommonAction} de ${mostCommonComponent}`;
}

/**
 * Genera descripción de la épica
 */
function generateEpicDescription(stories: Story[]): string {
  const storyCount = stories.length;
  const roles = [...new Set(stories.map(s => s.role))];
  
  let description = `Esta épica agrupa ${storyCount} historias de usuario relacionadas `;
  description += `que permiten a ${roles.join(', ')} realizar operaciones `;
  description += `sobre el sistema.\n\n`;
  description += `Las historias incluidas cubren funcionalidades de: `;
  
  const actions = stories.map(s => s.action).slice(0, 3);
  description += actions.join(', ');
  
  if (stories.length > 3) {
    description += `, entre otras`;
  }
  
  description += `.`;
  
  return description;
}

/**
 * Genera valor de negocio de la épica
 */
function generateBusinessValue(stories: Story[]): string {
  const values = stories.map(s => s.value);
  
  // Buscar temas comunes en los valores
  const commonThemes = extractCommonThemes(values);
  
  if (commonThemes.length > 0) {
    return `Esta épica proporciona valor al permitir ${commonThemes[0]}, mejorando la experiencia del usuario y la eficiencia operativa.`;
  }
  
  return `Esta épica proporciona valor incremental al sistema, permitiendo a los usuarios completar sus tareas de manera más eficiente.`;
}

/**
 * Extrae temas comunes de un conjunto de textos
 */
function extractCommonThemes(texts: string[]): string[] {
  const wordCounts = new Map<string, number>();
  
  for (const text of texts) {
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 4) { // Palabras significativas
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }

  // Ordenar por frecuencia
  const sorted = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  return sorted;
}

/**
 * Identifica dependencias entre historias
 */
export function identifyDependencies(stories: Story[]): Dependency[] {
  const dependencies: Dependency[] = [];

  // Palabras clave que indican dependencias
  const dependencyKeywords = [
    'después de', 'antes de', 'requiere', 'depende de',
    'necesita', 'una vez que', 'cuando se complete',
  ];

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    const text = `${story.description} ${story.acceptanceCriteria.map(c => 
      `${c.given} ${c.when} ${c.then}`
    ).join(' ')}`.toLowerCase();

    // Buscar referencias a otras historias
    for (let j = 0; j < stories.length; j++) {
      if (i === j) continue;
      
      const otherStory = stories[j];
      
      // Verificar si hay palabras clave de dependencia
      const hasDependencyKeyword = dependencyKeywords.some(keyword => 
        text.includes(keyword)
      );

      if (hasDependencyKeyword) {
        // Verificar si menciona componentes o acciones de la otra historia
        const mentionsOther = 
          otherStory.components.some(c => text.includes(c.toLowerCase())) ||
          text.includes(otherStory.action.toLowerCase());

        if (mentionsOther) {
          dependencies.push(createDependency({
            fromStoryId: story.id,
            toStoryId: otherStory.id,
            type: 'requires',
            reason: 'La historia hace referencia a funcionalidad de otra historia',
          }));
        }
      }
    }

    // Identificar dependencias por componentes compartidos
    for (let j = i + 1; j < stories.length; j++) {
      const otherStory = stories[j];
      
      const sharedComponents = story.components.filter(c => 
        otherStory.components.includes(c)
      );

      if (sharedComponents.length > 0) {
        dependencies.push(createDependency({
          fromStoryId: story.id,
          toStoryId: otherStory.id,
          type: 'relates',
          reason: `Ambas historias afectan los componentes: ${sharedComponents.join(', ')}`,
        }));
      }
    }
  }

  return dependencies;
}

/**
 * Descompone una épica grande en épicas más pequeñas
 */
function decomposeEpic(epic: Epic, allStories: Story[]): Epic[] {
  const epicStories = allStories.filter(s => epic.stories.includes(s.id));
  
  // Dividir historias en grupos más pequeños
  const targetSize = Math.ceil(LARGE_EPIC_THRESHOLD / 2);
  const subGroups: Story[][] = [];
  
  let currentGroup: Story[] = [];
  
  for (const story of epicStories) {
    currentGroup.push(story);
    
    if (currentGroup.length >= targetSize) {
      subGroups.push(currentGroup);
      currentGroup = [];
    }
  }
  
  if (currentGroup.length > 0) {
    subGroups.push(currentGroup);
  }

  // Crear épicas desde los subgrupos
  const decomposedEpics: Epic[] = [];
  
  for (let i = 0; i < subGroups.length; i++) {
    const subGroup = subGroups[i];
    const subEpic = createEpicFromStories(subGroup);
    
    // Agregar sufijo al título para diferenciar
    subEpic.title = `${epic.title} - Parte ${i + 1}`;
    
    decomposedEpics.push(subEpic);
  }

  return decomposedEpics;
}

/**
 * Reorganiza una historia de una épica a otra
 */
export function reorganizeStories(
  storyId: string,
  targetEpicId: string,
  epics: Epic[],
  stories: Story[]
): { epics: Epic[]; stories: Story[] } {
  // Encontrar la épica actual de la historia
  const currentEpic = epics.find(e => e.stories.includes(storyId));
  const targetEpic = epics.find(e => e.id === targetEpicId);

  if (!targetEpic) {
    throw new Error(`Épica objetivo ${targetEpicId} no encontrada`);
  }

  // Actualizar épicas
  const updatedEpics = epics.map(epic => {
    if (currentEpic && epic.id === currentEpic.id) {
      // Remover historia de épica actual
      return removeStoryFromEpic(epic, storyId);
    }
    if (epic.id === targetEpicId) {
      // Agregar historia a épica objetivo
      return addStoryToEpic(epic, storyId);
    }
    return epic;
  });

  // Actualizar historia con nuevo epicId
  const updatedStories = stories.map(story => {
    if (story.id === storyId) {
      return {
        ...story,
        epicId: targetEpicId,
        metadata: {
          ...story.metadata,
          modified: new Date(),
        },
      };
    }
    return story;
  });

  return {
    epics: updatedEpics,
    stories: updatedStories,
  };
}
