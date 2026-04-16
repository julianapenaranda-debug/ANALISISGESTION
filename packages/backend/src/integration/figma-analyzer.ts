/**
 * Figma Analyzer
 *
 * Analiza diseños de Figma para extraer componentes, flujos y generar historias.
 * Si se proporciona un accessToken, usa la API real de Figma.
 * Si no, mantiene el comportamiento mock para desarrollo local.
 *
 * Requerimientos: 2.1-2.5, 8.1-8.4
 */

import https from 'https';

export interface UIComponent {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  interactions: string[];
}

export interface FlowStep {
  screenId: string;
  action: string;
  trigger: string;
  nextScreenId?: string;
}

export interface UserFlow {
  id: string;
  name: string;
  screens: string[];
  sequence: FlowStep[];
}

export interface Screen {
  id: string;
  name: string;
  components: string[];
}

export interface Interaction {
  sourceId: string;
  targetId: string;
  trigger: string;
  action: string;
}

export interface FigmaAnalysisResult {
  fileKey: string;
  components: UIComponent[];
  flows: UserFlow[];
  screens: Screen[];
  interactions: Interaction[];
}

/**
 * Extrae el fileKey de una URL de Figma
 */
export function extractFileKey(figmaUrl: string): string {
  // Soporta múltiples formatos de URL de Figma:
  // https://www.figma.com/file/FILEKEY/...
  // https://www.figma.com/design/FILEKEY/...
  // https://www.figma.com/proto/FILEKEY/...
  // https://www.figma.com/board/FILEKEY/...
  // https://figma.com/file/FILEKEY/...
  const match = figmaUrl.match(/figma\.com\/(?:file|design|proto|board)\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error(`URL de Figma no válida. Formatos aceptados: https://www.figma.com/file/KEY/..., https://www.figma.com/design/KEY/...`);
  }
  return match[1];
}

/**
 * Extrae componentes interactivos de un nodo Figma
 * En producción, esto usaría las herramientas MCP de Figma
 */
export function extractComponents(figmaNodes: any[]): UIComponent[] {
  const components: UIComponent[] = [];

  for (const node of figmaNodes) {
    if (!node || !node.type) continue;

    const interactiveTypes = ['COMPONENT', 'INSTANCE', 'FRAME', 'GROUP'];
    if (!interactiveTypes.includes(node.type)) continue;

    const interactions: string[] = [];

    // Detectar interacciones en prototipos
    if (node.interactions && Array.isArray(node.interactions)) {
      for (const interaction of node.interactions) {
        if (interaction.trigger?.type) {
          interactions.push(interaction.trigger.type);
        }
      }
    }

    // Solo incluir componentes con nombre significativo o interacciones
    if (node.name && (interactions.length > 0 || node.type === 'COMPONENT')) {
      components.push({
        id: node.id || `comp-${components.length}`,
        name: node.name,
        type: node.type,
        properties: {
          width: node.absoluteBoundingBox?.width,
          height: node.absoluteBoundingBox?.height,
          visible: node.visible !== false,
        },
        interactions,
      });
    }

    // Recursión en hijos
    if (node.children && Array.isArray(node.children)) {
      const childComponents = extractComponents(node.children);
      components.push(...childComponents);
    }
  }

  return components;
}

/**
 * Identifica flujos de usuario desde prototipos de Figma
 */
export function identifyFlows(
  components: UIComponent[],
  interactions: Interaction[]
): UserFlow[] {
  if (interactions.length === 0) return [];

  // Agrupar interacciones por pantalla de origen
  const flowMap = new Map<string, FlowStep[]>();

  for (const interaction of interactions) {
    const steps = flowMap.get(interaction.sourceId) || [];
    steps.push({
      screenId: interaction.sourceId,
      action: interaction.action,
      trigger: interaction.trigger,
      nextScreenId: interaction.targetId,
    });
    flowMap.set(interaction.sourceId, steps);
  }

  // Construir flujos desde el mapa
  const flows: UserFlow[] = [];
  let flowIndex = 0;

  for (const [screenId, steps] of flowMap.entries()) {
    const screenIds = new Set<string>([screenId]);
    for (const step of steps) {
      if (step.nextScreenId) screenIds.add(step.nextScreenId);
    }

    flows.push({
      id: `flow-${flowIndex++}`,
      name: `Flujo desde ${screenId}`,
      screens: Array.from(screenIds),
      sequence: steps,
    });
  }

  return flows;
}

/**
 * Mapea componentes UI a historias de usuario
 */
export function mapComponentsToStories(
  components: UIComponent[]
): Array<{ component: UIComponent; storyHint: string }> {
  return components.map(component => {
    let storyHint = '';

    const nameLower = component.name.toLowerCase();

    if (nameLower.includes('login') || nameLower.includes('auth')) {
      storyHint = 'Como usuario, quiero autenticarme en el sistema';
    } else if (nameLower.includes('form') || nameLower.includes('formulario')) {
      storyHint = `Como usuario, quiero completar el formulario ${component.name}`;
    } else if (nameLower.includes('list') || nameLower.includes('tabla')) {
      storyHint = `Como usuario, quiero ver la lista de ${component.name}`;
    } else if (nameLower.includes('button') || nameLower.includes('btn')) {
      storyHint = `Como usuario, quiero realizar la acción ${component.name}`;
    } else if (nameLower.includes('nav') || nameLower.includes('menu')) {
      storyHint = `Como usuario, quiero navegar usando ${component.name}`;
    } else {
      storyHint = `Como usuario, quiero interactuar con ${component.name}`;
    }

    return { component, storyHint };
  });
}

/**
 * Realiza una petición HTTPS a la API de Figma.
 * Usa el módulo nativo https, consistente con el patrón de jira-connector.
 *
 * Requerimiento 8.1
 */
export function figmaRequest(accessToken: string, path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.figma.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        'X-Figma-Token': accessToken,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const statusCode = res.statusCode || 0;

        if (statusCode === 403) {
          reject(Object.assign(
            new Error('Token de Figma sin permisos para acceder a este archivo.'),
            { code: 'FIGMA_FORBIDDEN', statusCode }
          ));
          return;
        }

        if (statusCode === 404) {
          reject(Object.assign(
            new Error('Archivo de Figma no encontrado. Verifica la URL.'),
            { code: 'FIGMA_NOT_FOUND', statusCode }
          ));
          return;
        }

        try {
          const parsed = data ? JSON.parse(data) : {};
          if (statusCode >= 400) {
            reject(Object.assign(
              new Error(parsed?.message || `Figma API error ${statusCode}`),
              { code: `FIGMA_ERROR_${statusCode}`, statusCode }
            ));
          } else {
            resolve(parsed);
          }
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Extrae pantallas (frames de nivel superior) de los hijos del documento Figma.
 * Los frames de nivel superior en las páginas de Figma representan pantallas.
 */
function extractScreens(pages: any[]): Screen[] {
  const screens: Screen[] = [];

  for (const page of pages) {
    if (!page?.children) continue;

    for (const child of page.children) {
      if (child?.type === 'FRAME' || child?.type === 'COMPONENT' || child?.type === 'SECTION') {
        const componentIds: string[] = [];
        if (child.children && Array.isArray(child.children)) {
          for (const grandchild of child.children) {
            if (grandchild?.id) {
              componentIds.push(grandchild.id);
            }
          }
        }

        screens.push({
          id: child.id || `screen-${screens.length}`,
          name: child.name || `Screen ${screens.length}`,
          components: componentIds,
        });
      }
    }
  }

  return screens;
}

/**
 * Extrae interacciones de prototipo de los nodos del documento Figma.
 * Recorre recursivamente buscando nodos con prototypeStartNodeID o interactions.
 */
function extractInteractions(pages: any[]): Interaction[] {
  const interactions: Interaction[] = [];

  function walkNodes(nodes: any[]): void {
    for (const node of nodes) {
      if (!node) continue;

      // Extraer interacciones de prototipo del nodo
      if (node.interactions && Array.isArray(node.interactions)) {
        for (const interaction of node.interactions) {
          const trigger = interaction.trigger?.type || 'ON_CLICK';
          const action = interaction.actions?.[0];
          if (action?.destinationId) {
            interactions.push({
              sourceId: node.id,
              targetId: action.destinationId,
              trigger,
              action: action.type || 'NAVIGATE',
            });
          }
        }
      }

      // Recurse into children
      if (node.children && Array.isArray(node.children)) {
        walkNodes(node.children);
      }
    }
  }

  for (const page of pages) {
    if (page?.children) {
      walkNodes(page.children);
    }
  }

  return interactions;
}

/**
 * Analiza un diseño de Figma completo.
 * Si se proporciona accessToken, usa la API real de Figma (GET /v1/files/:fileKey).
 * Si no, mantiene el comportamiento mock para desarrollo local.
 *
 * Requerimientos: 8.1, 8.2, 8.3, 8.4
 */
export async function analyzeDesign(figmaUrl: string, accessToken?: string): Promise<FigmaAnalysisResult> {
  const fileKey = extractFileKey(figmaUrl);

  // Si se proporciona accessToken, usar la API real de Figma
  if (accessToken) {
    const figmaData = await figmaRequest(accessToken, `/v1/files/${fileKey}`);

    const pages = figmaData?.document?.children || [];
    // Pages are CANVAS nodes — extractComponents expects interactive types,
    // so we flatten page children to get the actual frames/components.
    const topLevelNodes = pages.flatMap((page: any) => page?.children || []);
    const components = extractComponents(topLevelNodes);
    const screens = extractScreens(pages);
    const interactions = extractInteractions(pages);
    const flows = identifyFlows(components, interactions);

    return {
      fileKey,
      components,
      flows,
      screens,
      interactions,
    };
  }

  // Mock representativo para desarrollo local — simula un diseño típico con pantallas comunes
  const mockComponents: UIComponent[] = [
    { id: 'comp-1', name: 'Login Form', type: 'COMPONENT', properties: {}, interactions: ['ON_CLICK'] },
    { id: 'comp-2', name: 'Navigation Menu', type: 'COMPONENT', properties: {}, interactions: ['ON_CLICK'] },
    { id: 'comp-3', name: 'Dashboard', type: 'FRAME', properties: {}, interactions: [] },
    { id: 'comp-4', name: 'Data Table', type: 'COMPONENT', properties: {}, interactions: ['ON_CLICK'] },
    { id: 'comp-5', name: 'Create Form', type: 'COMPONENT', properties: {}, interactions: ['ON_SUBMIT'] },
  ];

  const mockScreens: Screen[] = [
    { id: 'screen-1', name: 'Login', components: ['comp-1'] },
    { id: 'screen-2', name: 'Dashboard', components: ['comp-2', 'comp-3', 'comp-4'] },
    { id: 'screen-3', name: 'Create', components: ['comp-2', 'comp-5'] },
  ];

  const mockInteractions: Interaction[] = [
    { sourceId: 'screen-1', targetId: 'screen-2', trigger: 'ON_CLICK', action: 'NAVIGATE' },
    { sourceId: 'screen-2', targetId: 'screen-3', trigger: 'ON_CLICK', action: 'NAVIGATE' },
    { sourceId: 'screen-3', targetId: 'screen-2', trigger: 'ON_SUBMIT', action: 'NAVIGATE' },
  ];

  const mockFlows = identifyFlows(mockComponents, mockInteractions);

  return {
    fileKey,
    components: mockComponents,
    flows: mockFlows,
    screens: mockScreens,
    interactions: mockInteractions,
  };
}
