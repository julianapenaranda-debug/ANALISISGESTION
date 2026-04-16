/**
 * Unit Tests for Integration Models
 * 
 * Tests factory functions and helper utilities for Jira, Figma, and Export models
 */

import {
  createJiraCredentials,
  createJiraIssueFromStory,
  createJiraIssueFromEpic,
  formatStoryDescription,
  formatEpicDescription,
  convertToJiraPayload,
  convertMarkdownToADF,
  validateJiraCredentials,
  createFigmaFile,
  createFigmaNode,
  extractNodesByType,
  extractInteractiveComponents,
  findPrototypeStartNode,
  findNodeById,
  countNodes,
  createJiraExport,
  convertToCsvRows,
  formatAcceptanceCriteriaForCsv,
  convertCsvRowsToString,
  filterStoriesByIds,
  filterEpicsByStories,
  validateJiraExport,
  validateCsvRows,
} from '../../../src/integration/models';

import {
  createStory,
  createAcceptanceCriterion,
  createEpic,
  createDependency,
} from '../../../src/core/models';

describe('Integration Models - Jira', () => {
  describe('createJiraCredentials', () => {
    it('should create Jira credentials', () => {
      const credentials = createJiraCredentials({
        baseUrl: 'https://mycompany.atlassian.net',
        email: 'user@example.com',
        apiToken: 'token123',
      });

      expect(credentials.baseUrl).toBe('https://mycompany.atlassian.net');
      expect(credentials.email).toBe('user@example.com');
      expect(credentials.apiToken).toBe('token123');
    });
  });

  describe('validateJiraCredentials', () => {
    it('should validate correct credentials', () => {
      const credentials = createJiraCredentials({
        baseUrl: 'https://mycompany.atlassian.net',
        email: 'user@example.com',
        apiToken: 'token123',
      });

      const result = validateJiraCredentials(credentials);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject credentials without baseUrl', () => {
      const credentials = createJiraCredentials({
        baseUrl: '',
        email: 'user@example.com',
        apiToken: 'token123',
      });

      const result = validateJiraCredentials(credentials);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Base URL es requerida');
    });

    it('should reject credentials with invalid baseUrl', () => {
      const credentials = createJiraCredentials({
        baseUrl: 'mycompany.atlassian.net',
        email: 'user@example.com',
        apiToken: 'token123',
      });

      const result = validateJiraCredentials(credentials);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Base URL debe comenzar con http:// o https://');
    });

    it('should reject credentials without email', () => {
      const credentials = createJiraCredentials({
        baseUrl: 'https://mycompany.atlassian.net',
        email: '',
        apiToken: 'token123',
      });

      const result = validateJiraCredentials(credentials);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email es requerido');
    });

    it('should reject credentials with invalid email', () => {
      const credentials = createJiraCredentials({
        baseUrl: 'https://mycompany.atlassian.net',
        email: 'invalid-email',
        apiToken: 'token123',
      });

      const result = validateJiraCredentials(credentials);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email debe ser válido');
    });

    it('should reject credentials without apiToken', () => {
      const credentials = createJiraCredentials({
        baseUrl: 'https://mycompany.atlassian.net',
        email: 'user@example.com',
        apiToken: '',
      });

      const result = validateJiraCredentials(credentials);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API Token es requerido');
    });
  });

  describe('createJiraIssueFromStory', () => {
    it('should create a Jira issue from a story', () => {
      const criterion = createAcceptanceCriterion({
        given: 'el usuario está autenticado',
        when: 'hace clic en guardar',
        then: 'los datos se guardan',
        type: 'positive',
      });

      const story = createStory({
        title: 'User Login',
        role: 'usuario',
        action: 'iniciar sesión',
        value: 'pueda acceder a mi cuenta',
        description: 'Historia de login',
        acceptanceCriteria: [criterion],
        components: ['auth', 'frontend'],
      });

      const jiraIssue = createJiraIssueFromStory(story, 'PROJ');

      expect(jiraIssue.projectKey).toBe('PROJ');
      expect(jiraIssue.issueType).toBe('Story');
      expect(jiraIssue.summary).toBe('User Login');
      expect(jiraIssue.description).toContain('Como usuario');
      expect(jiraIssue.components).toEqual(['auth', 'frontend']);
    });

    it('should include epicId as epicLink', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        epicId: 'epic-123',
      });

      const jiraIssue = createJiraIssueFromStory(story, 'PROJ');
      expect(jiraIssue.epicLink).toBe('epic-123');
    });
  });

  describe('createJiraIssueFromEpic', () => {
    it('should create a Jira issue from an epic', () => {
      const epic = createEpic({
        title: 'User Authentication',
        description: 'Epic para autenticación',
        businessValue: 'Acceso seguro al sistema',
        stories: ['story-1', 'story-2'],
      });

      const jiraIssue = createJiraIssueFromEpic(epic, 'PROJ');

      expect(jiraIssue.projectKey).toBe('PROJ');
      expect(jiraIssue.issueType).toBe('Epic');
      expect(jiraIssue.summary).toBe('User Authentication');
      expect(jiraIssue.description).toContain('Epic para autenticación');
      expect(jiraIssue.description).toContain('Acceso seguro al sistema');
    });
  });

  describe('formatStoryDescription', () => {
    it('should format story description with acceptance criteria', () => {
      const criterion1 = createAcceptanceCriterion({
        given: 'precondición 1',
        when: 'acción 1',
        then: 'resultado 1',
        type: 'positive',
      });

      const criterion2 = createAcceptanceCriterion({
        given: 'precondición 2',
        when: 'acción 2',
        then: 'resultado 2',
        type: 'negative',
      });

      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción detallada',
        acceptanceCriteria: [criterion1, criterion2],
        components: ['auth', 'api'],
      });

      const formatted = formatStoryDescription(story);

      expect(formatted).toContain('Como usuario, quiero hacer algo, para que obtener valor');
      expect(formatted).toContain('Descripción detallada');
      expect(formatted).toContain('## Criterios de Aceptación');
      expect(formatted).toContain('**Dado que** precondición 1');
      expect(formatted).toContain('**Cuando** acción 1');
      expect(formatted).toContain('**Entonces** resultado 1');
      expect(formatted).toContain('## Componentes');
      expect(formatted).toContain('auth, api');
    });
  });

  describe('formatEpicDescription', () => {
    it('should format epic description with business value', () => {
      const dependency = createDependency({
        fromStoryId: 'story-1',
        toStoryId: 'story-2',
        type: 'blocks',
        reason: 'Story 1 debe completarse primero',
      });

      const epic = createEpic({
        title: 'Test Epic',
        description: 'Descripción de la épica',
        businessValue: 'Valor de negocio importante',
        stories: ['story-1', 'story-2'],
        dependencies: [dependency],
      });

      const formatted = formatEpicDescription(epic);

      expect(formatted).toContain('Descripción de la épica');
      expect(formatted).toContain('## Valor de Negocio');
      expect(formatted).toContain('Valor de negocio importante');
      expect(formatted).toContain('## Historias Incluidas');
      expect(formatted).toContain('2 historias de usuario');
      expect(formatted).toContain('## Dependencias');
      expect(formatted).toContain('blocks');
    });
  });

  describe('convertToJiraPayload', () => {
    it('should convert JiraIssue to JiraIssuePayload', () => {
      const criterion = createAcceptanceCriterion({
        given: 'precondición',
        when: 'acción',
        then: 'resultado',
        type: 'positive',
      });

      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        acceptanceCriteria: [criterion],
        components: ['auth'],
      });

      const jiraIssue = createJiraIssueFromStory(story, 'PROJ');
      const payload = convertToJiraPayload(jiraIssue);

      expect(payload.fields.project.key).toBe('PROJ');
      expect(payload.fields.issuetype.name).toBe('Story');
      expect(payload.fields.summary).toBe('Test Story');
      expect(payload.fields.description.type).toBe('doc');
      expect(payload.fields.description.version).toBe(1);
      expect(payload.fields.components).toEqual([{ name: 'auth' }]);
    });

    it('should include epicLink in payload', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        epicId: 'epic-123',
      });

      const jiraIssue = createJiraIssueFromStory(story, 'PROJ');
      const payload = convertToJiraPayload(jiraIssue);

      expect(payload.fields.customfield_10014).toBe('epic-123');
    });
  });

  describe('convertMarkdownToADF', () => {
    it('should convert simple text to ADF', () => {
      const markdown = 'Simple text';
      const adf = convertMarkdownToADF(markdown);

      expect(adf.type).toBe('doc');
      expect(adf.version).toBe(1);
      expect(adf.content).toHaveLength(1);
      expect(adf.content[0].type).toBe('paragraph');
    });

    it('should convert headers to ADF', () => {
      const markdown = '## Header 2\n### Header 3';
      const adf = convertMarkdownToADF(markdown);

      expect(adf.content[0].type).toBe('heading');
      expect(adf.content[0].attrs.level).toBe(2);
      expect(adf.content[1].type).toBe('heading');
      expect(adf.content[1].attrs.level).toBe(3);
    });

    it('should convert bold text to ADF', () => {
      const markdown = '**Bold text**';
      const adf = convertMarkdownToADF(markdown);

      expect(adf.content[0].type).toBe('paragraph');
      expect(adf.content[0].content[0].marks).toEqual([{ type: 'strong' }]);
    });

    it('should convert list items to ADF', () => {
      const markdown = '- Item 1';
      const adf = convertMarkdownToADF(markdown);

      expect(adf.content[0].type).toBe('bulletList');
      expect(adf.content[0].content[0].type).toBe('listItem');
    });
  });
});

describe('Integration Models - Figma', () => {
  describe('createFigmaFile', () => {
    it('should create a Figma file', () => {
      const rootNode = createFigmaNode({
        id: 'root',
        name: 'Document',
        type: 'DOCUMENT',
      });

      const file = createFigmaFile({
        name: 'My Design',
        lastModified: '2024-01-01',
        thumbnailUrl: 'https://example.com/thumb.png',
        version: '1.0',
        document: rootNode,
      });

      expect(file.name).toBe('My Design');
      expect(file.version).toBe('1.0');
      expect(file.document).toEqual(rootNode);
    });
  });

  describe('createFigmaNode', () => {
    it('should create a Figma node', () => {
      const node = createFigmaNode({
        id: 'node-1',
        name: 'Button',
        type: 'BUTTON',
      });

      expect(node.id).toBe('node-1');
      expect(node.name).toBe('Button');
      expect(node.type).toBe('BUTTON');
    });

    it('should create a node with children', () => {
      const child = createFigmaNode({
        id: 'child-1',
        name: 'Text',
        type: 'TEXT',
      });

      const parent = createFigmaNode({
        id: 'parent',
        name: 'Frame',
        type: 'FRAME',
        children: [child],
      });

      expect(parent.children).toHaveLength(1);
      expect(parent.children![0]).toEqual(child);
    });
  });

  describe('extractNodesByType', () => {
    it('should extract nodes of specific type', () => {
      const button1 = createFigmaNode({
        id: 'btn-1',
        name: 'Button 1',
        type: 'BUTTON',
      });

      const button2 = createFigmaNode({
        id: 'btn-2',
        name: 'Button 2',
        type: 'BUTTON',
      });

      const text = createFigmaNode({
        id: 'text-1',
        name: 'Text',
        type: 'TEXT',
      });

      const root = createFigmaNode({
        id: 'root',
        name: 'Root',
        type: 'FRAME',
        children: [button1, text, button2],
      });

      const buttons = extractNodesByType(root, 'BUTTON');
      expect(buttons).toHaveLength(2);
      expect(buttons[0].id).toBe('btn-1');
      expect(buttons[1].id).toBe('btn-2');
    });

    it('should extract nodes from nested structure', () => {
      const deepButton = createFigmaNode({
        id: 'deep-btn',
        name: 'Deep Button',
        type: 'BUTTON',
      });

      const frame = createFigmaNode({
        id: 'frame',
        name: 'Frame',
        type: 'FRAME',
        children: [deepButton],
      });

      const root = createFigmaNode({
        id: 'root',
        name: 'Root',
        type: 'DOCUMENT',
        children: [frame],
      });

      const buttons = extractNodesByType(root, 'BUTTON');
      expect(buttons).toHaveLength(1);
      expect(buttons[0].id).toBe('deep-btn');
    });
  });

  describe('extractInteractiveComponents', () => {
    it('should extract interactive components', () => {
      const button = createFigmaNode({
        id: 'btn',
        name: 'Button',
        type: 'BUTTON',
      });

      const input = createFigmaNode({
        id: 'input',
        name: 'Input',
        type: 'INPUT',
      });

      const text = createFigmaNode({
        id: 'text',
        name: 'Text',
        type: 'TEXT',
      });

      const root = createFigmaNode({
        id: 'root',
        name: 'Root',
        type: 'FRAME',
        children: [button, input, text],
      });

      const file = createFigmaFile({
        name: 'Test',
        lastModified: '2024-01-01',
        thumbnailUrl: '',
        version: '1.0',
        document: root,
      });

      const interactive = extractInteractiveComponents(file);
      expect(interactive.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('findNodeById', () => {
    it('should find node by id', () => {
      const target = createFigmaNode({
        id: 'target',
        name: 'Target',
        type: 'BUTTON',
      });

      const other = createFigmaNode({
        id: 'other',
        name: 'Other',
        type: 'TEXT',
      });

      const root = createFigmaNode({
        id: 'root',
        name: 'Root',
        type: 'FRAME',
        children: [other, target],
      });

      const found = findNodeById(root, 'target');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('target');
    });

    it('should return null if node not found', () => {
      const root = createFigmaNode({
        id: 'root',
        name: 'Root',
        type: 'FRAME',
      });

      const found = findNodeById(root, 'nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findPrototypeStartNode', () => {
    it('should find prototype start node', () => {
      const startNode = createFigmaNode({
        id: 'start',
        name: 'Start Screen',
        type: 'FRAME',
      });

      const root = createFigmaNode({
        id: 'root',
        name: 'Root',
        type: 'DOCUMENT',
        children: [startNode],
        prototypeStartNodeID: 'start',
      });

      const file = createFigmaFile({
        name: 'Test',
        lastModified: '2024-01-01',
        thumbnailUrl: '',
        version: '1.0',
        document: root,
      });

      const found = findPrototypeStartNode(file);
      expect(found).not.toBeNull();
      expect(found!.id).toBe('start');
    });

    it('should return null if no prototype start node', () => {
      const root = createFigmaNode({
        id: 'root',
        name: 'Root',
        type: 'DOCUMENT',
      });

      const file = createFigmaFile({
        name: 'Test',
        lastModified: '2024-01-01',
        thumbnailUrl: '',
        version: '1.0',
        document: root,
      });

      const found = findPrototypeStartNode(file);
      expect(found).toBeNull();
    });
  });

  describe('countNodes', () => {
    it('should count single node', () => {
      const node = createFigmaNode({
        id: 'node',
        name: 'Node',
        type: 'FRAME',
      });

      expect(countNodes(node)).toBe(1);
    });

    it('should count nodes with children', () => {
      const child1 = createFigmaNode({
        id: 'child1',
        name: 'Child 1',
        type: 'TEXT',
      });

      const child2 = createFigmaNode({
        id: 'child2',
        name: 'Child 2',
        type: 'TEXT',
      });

      const parent = createFigmaNode({
        id: 'parent',
        name: 'Parent',
        type: 'FRAME',
        children: [child1, child2],
      });

      expect(countNodes(parent)).toBe(3);
    });
  });
});

describe('Integration Models - Export', () => {
  describe('createJiraExport', () => {
    it('should create Jira export from stories and epics', () => {
      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
      });

      const epic = createEpic({
        title: 'Test Epic',
        description: 'Descripción épica',
        businessValue: 'Valor',
      });

      const jiraExport = createJiraExport([story], [epic], 'PROJ');

      expect(jiraExport.issueUpdates).toHaveLength(2);
      expect(jiraExport.issueUpdates[0].fields.issuetype.name).toBe('Epic');
      expect(jiraExport.issueUpdates[1].fields.issuetype.name).toBe('Story');
    });
  });

  describe('convertToCsvRows', () => {
    it('should convert stories and epics to CSV rows', () => {
      const criterion = createAcceptanceCriterion({
        given: 'precondición',
        when: 'acción',
        then: 'resultado',
        type: 'positive',
      });

      const story = createStory({
        title: 'Test Story',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
        acceptanceCriteria: [criterion],
        components: ['auth'],
      });

      const epic = createEpic({
        title: 'Test Epic',
        description: 'Descripción épica',
        businessValue: 'Valor',
      });

      const rows = convertToCsvRows([story], [epic]);

      expect(rows).toHaveLength(2);
      expect(rows[0]['Issue Type']).toBe('Epic');
      expect(rows[1]['Issue Type']).toBe('Story');
      expect(rows[1]['Components']).toBe('auth');
    });
  });

  describe('formatAcceptanceCriteriaForCsv', () => {
    it('should format acceptance criteria for CSV', () => {
      const criterion1 = createAcceptanceCriterion({
        given: 'precondición 1',
        when: 'acción 1',
        then: 'resultado 1',
        type: 'positive',
      });

      const criterion2 = createAcceptanceCriterion({
        given: 'precondición 2',
        when: 'acción 2',
        then: 'resultado 2',
        type: 'negative',
      });

      const formatted = formatAcceptanceCriteriaForCsv([criterion1, criterion2]);

      expect(formatted).toContain('[1] Dado que precondición 1');
      expect(formatted).toContain('[2] Dado que precondición 2');
      expect(formatted).toContain('|');
    });
  });

  describe('convertCsvRowsToString', () => {
    it('should convert CSV rows to string', () => {
      const rows = [
        {
          'Issue Type': 'Story',
          'Summary': 'Test Story',
          'Description': 'Description',
          'Acceptance Criteria': 'Criteria',
          'Components': 'auth',
          'Epic Link': '',
        },
      ];

      const csv = convertCsvRowsToString(rows);

      expect(csv).toContain('Issue Type,Summary,Description');
      expect(csv).toContain('Story,Test Story,Description');
    });

    it('should escape commas in values', () => {
      const rows = [
        {
          'Issue Type': 'Story',
          'Summary': 'Test, Story',
          'Description': 'Description',
          'Acceptance Criteria': 'Criteria',
          'Components': 'auth, api',
          'Epic Link': '',
        },
      ];

      const csv = convertCsvRowsToString(rows);

      expect(csv).toContain('"Test, Story"');
      expect(csv).toContain('"auth, api"');
    });
  });

  describe('filterStoriesByIds', () => {
    it('should filter stories by selected IDs', () => {
      const story1 = createStory({
        title: 'Story 1',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
      });

      const story2 = createStory({
        title: 'Story 2',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
      });

      const story3 = createStory({
        title: 'Story 3',
        role: 'usuario',
        action: 'hacer algo',
        value: 'obtener valor',
        description: 'Descripción',
      });

      const filtered = filterStoriesByIds([story1, story2, story3], [story1.id, story3.id]);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe(story1.id);
      expect(filtered[1].id).toBe(story3.id);
    });
  });

  describe('filterEpicsByStories', () => {
    it('should filter epics that contain selected stories', () => {
      const story1Id = 'story-1';
      const story2Id = 'story-2';
      const story3Id = 'story-3';

      const epic1 = createEpic({
        title: 'Epic 1',
        description: 'Descripción',
        businessValue: 'Valor',
        stories: [story1Id, story2Id],
      });

      const epic2 = createEpic({
        title: 'Epic 2',
        description: 'Descripción',
        businessValue: 'Valor',
        stories: [story3Id],
      });

      const filtered = filterEpicsByStories([epic1, epic2], [story1Id]);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(epic1.id);
    });
  });

  describe('validateJiraExport', () => {
    it('should validate correct Jira export', () => {
      const jiraExport = {
        issueUpdates: [
          {
            fields: {
              project: { key: 'PROJ' },
              issuetype: { name: 'Story' },
              summary: 'Test Story',
              description: 'Description',
            },
          },
        ],
      };

      const result = validateJiraExport(jiraExport);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty Jira export', () => {
      const jiraExport = {
        issueUpdates: [],
      };

      const result = validateJiraExport(jiraExport);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('JiraExport debe contener al menos un issue');
    });

    it('should reject issue without project key', () => {
      const jiraExport = {
        issueUpdates: [
          {
            fields: {
              project: { key: '' },
              issuetype: { name: 'Story' },
              summary: 'Test Story',
              description: 'Description',
            },
          },
        ],
      };

      const result = validateJiraExport(jiraExport);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('project key'))).toBe(true);
    });
  });

  describe('validateCsvRows', () => {
    it('should validate correct CSV rows', () => {
      const rows = [
        {
          'Issue Type': 'Story',
          'Summary': 'Test Story',
          'Description': 'Description',
          'Acceptance Criteria': 'Criteria',
          'Components': 'auth',
          'Epic Link': '',
        },
      ];

      const result = validateCsvRows(rows);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty CSV rows', () => {
      const result = validateCsvRows([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CSV debe contener al menos una fila');
    });

    it('should reject row without Issue Type', () => {
      const rows = [
        {
          'Issue Type': '',
          'Summary': 'Test Story',
          'Description': 'Description',
          'Acceptance Criteria': 'Criteria',
          'Components': 'auth',
          'Epic Link': '',
        },
      ];

      const result = validateCsvRows(rows);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Issue Type'))).toBe(true);
    });

    it('should reject row without Summary', () => {
      const rows = [
        {
          'Issue Type': 'Story',
          'Summary': '',
          'Description': 'Description',
          'Acceptance Criteria': 'Criteria',
          'Components': 'auth',
          'Epic Link': '',
        },
      ];

      const result = validateCsvRows(rows);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Summary'))).toBe(true);
    });
  });
});
