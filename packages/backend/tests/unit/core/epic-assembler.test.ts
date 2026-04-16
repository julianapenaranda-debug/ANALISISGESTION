/**
 * Unit Tests - Epic Assembler
 * 
 * Pruebas unitarias para el ensamblador de épicas.
 * Valida: Requerimientos 4.1-4.5, 12.4
 */

import { describe, it, expect } from '@jest/globals';
import {
  assembleEpics,
  identifyDependencies,
  reorganizeStories,
} from '../../../src/core/epic-assembler';
import { createStory, createAcceptanceCriterion } from '../../../src/core/models';

describe('Epic Assembler', () => {
  describe('assembleEpics()', () => {
    it('should group related stories by shared components', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'crear tarea',
          value: 'organizar trabajo',
          description: 'Crear tareas',
          components: ['tasks', 'forms'],
        }),
        createStory({
          title: 'Story 2',
          role: 'usuario',
          action: 'editar tarea',
          value: 'actualizar información',
          description: 'Editar tareas',
          components: ['tasks', 'forms'],
        }),
        createStory({
          title: 'Story 3',
          role: 'usuario',
          action: 'ver perfil',
          value: 'revisar información',
          description: 'Ver perfil de usuario',
          components: ['profile', 'display'],
        }),
      ];

      const epics = assembleEpics(stories);

      expect(epics.length).toBeGreaterThan(0);
      // Las primeras dos historias deberían estar en la misma épica
      const epic1 = epics.find(e => 
        e.stories.includes(stories[0].id) && e.stories.includes(stories[1].id)
      );
      expect(epic1).toBeDefined();
    });

    it('should assign descriptive titles to epics', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'crear tarea',
          value: 'organizar trabajo',
          description: 'Crear tareas',
          components: ['tasks'],
        }),
        createStory({
          title: 'Story 2',
          role: 'usuario',
          action: 'editar tarea',
          value: 'actualizar información',
          description: 'Editar tareas',
          components: ['tasks'],
        }),
      ];

      const epics = assembleEpics(stories);

      expect(epics.length).toBeGreaterThan(0);
      expect(epics[0].title).toBeTruthy();
      expect(epics[0].title.length).toBeGreaterThan(5);
    });

    it('should include business value in epics', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'crear tarea',
          value: 'organizar trabajo',
          description: 'Crear tareas',
          components: ['tasks'],
        }),
      ];

      const epics = assembleEpics(stories);

      expect(epics[0].businessValue).toBeTruthy();
      expect(epics[0].businessValue.length).toBeGreaterThan(10);
    });

    it('should decompose large epics with more than 10 stories', () => {
      const stories = Array.from({ length: 15 }, (_, i) =>
        createStory({
          title: `Story ${i}`,
          role: 'usuario',
          action: 'realizar acción',
          value: 'obtener valor',
          description: `Descripción ${i}`,
          components: ['shared-component'], // Mismo componente para agrupar
        })
      );

      const epics = assembleEpics(stories);

      // Debería haber más de una épica debido a la descomposición
      expect(epics.length).toBeGreaterThan(1);
      
      // Cada épica debería tener menos de 10 historias
      for (const epic of epics) {
        expect(epic.stories.length).toBeLessThanOrEqual(10);
      }
    });

    it('should handle empty story array', () => {
      const epics = assembleEpics([]);

      expect(epics).toEqual([]);
    });

    it('should handle single story', () => {
      const stories = [
        createStory({
          title: 'Single Story',
          role: 'usuario',
          action: 'hacer algo',
          value: 'obtener valor',
          description: 'Una historia',
          components: ['core'],
        }),
      ];

      const epics = assembleEpics(stories);

      expect(epics.length).toBe(1);
      expect(epics[0].stories).toContain(stories[0].id);
    });
  });

  describe('identifyDependencies()', () => {
    it('should identify explicit dependencies with keywords', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'iniciar sesión',
          value: 'acceder al sistema',
          description: 'El usuario puede iniciar sesión',
          components: ['authentication'],
          acceptanceCriteria: [
            createAcceptanceCriterion({
              given: 'el usuario tiene credenciales',
              when: 'el usuario inicia sesión',
              then: 'el sistema autentica al usuario',
              type: 'positive',
            }),
          ],
        }),
        createStory({
          title: 'Story 2',
          role: 'usuario',
          action: 'ver perfil',
          value: 'revisar información',
          description: 'Después de iniciar sesión, el usuario puede ver su perfil',
          components: ['profile'],
          acceptanceCriteria: [
            createAcceptanceCriterion({
              given: 'el usuario está autenticado',
              when: 'el usuario accede a su perfil',
              then: 'el sistema muestra la información del perfil',
              type: 'positive',
            }),
          ],
        }),
      ];

      const dependencies = identifyDependencies(stories);

      expect(dependencies.length).toBeGreaterThan(0);
      const dep = dependencies.find(d => 
        d.fromStoryId === stories[1].id && d.toStoryId === stories[0].id
      );
      expect(dep).toBeDefined();
      expect(dep?.type).toBe('requires');
    });

    it('should identify related stories by shared components', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'crear tarea',
          value: 'organizar trabajo',
          description: 'Crear tareas',
          components: ['tasks', 'database'],
        }),
        createStory({
          title: 'Story 2',
          role: 'usuario',
          action: 'editar tarea',
          value: 'actualizar información',
          description: 'Editar tareas',
          components: ['tasks', 'database'],
        }),
      ];

      const dependencies = identifyDependencies(stories);

      expect(dependencies.length).toBeGreaterThan(0);
      const relatedDep = dependencies.find(d => d.type === 'relates');
      expect(relatedDep).toBeDefined();
    });

    it('should handle stories with no dependencies', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'hacer algo',
          value: 'obtener valor',
          description: 'Historia independiente',
          components: ['component-a'],
        }),
        createStory({
          title: 'Story 2',
          role: 'usuario',
          action: 'hacer otra cosa',
          value: 'obtener otro valor',
          description: 'Otra historia independiente',
          components: ['component-b'],
        }),
      ];

      const dependencies = identifyDependencies(stories);

      // Puede haber 0 dependencias o solo relaciones débiles
      expect(dependencies).toBeDefined();
    });

    it('should include reason for each dependency', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'crear cuenta',
          value: 'acceder al sistema',
          description: 'Crear cuenta de usuario',
          components: ['authentication'],
        }),
        createStory({
          title: 'Story 2',
          role: 'usuario',
          action: 'iniciar sesión',
          value: 'acceder al sistema',
          description: 'Requiere que exista una cuenta de usuario',
          components: ['authentication'],
        }),
      ];

      const dependencies = identifyDependencies(stories);

      for (const dep of dependencies) {
        expect(dep.reason).toBeTruthy();
        expect(dep.reason.length).toBeGreaterThan(5);
      }
    });
  });

  describe('reorganizeStories()', () => {
    it('should move story from one epic to another', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'hacer algo',
          value: 'obtener valor',
          description: 'Historia 1',
          components: ['core'],
        }),
        createStory({
          title: 'Story 2',
          role: 'usuario',
          action: 'hacer otra cosa',
          value: 'obtener otro valor',
          description: 'Historia 2',
          components: ['core'],
        }),
      ];

      const epics = assembleEpics(stories);
      expect(epics.length).toBeGreaterThanOrEqual(1);

      // Si hay solo una épica, crear una segunda para la prueba
      if (epics.length === 1) {
        const newEpic = {
          ...epics[0],
          id: 'epic-2',
          title: 'Nueva Épica',
          stories: [],
        };
        epics.push(newEpic);
      }

      const storyToMove = stories[0].id;
      const targetEpicId = epics[1].id;

      const result = reorganizeStories(storyToMove, targetEpicId, epics, stories);

      // Verificar que la historia se movió
      const targetEpic = result.epics.find(e => e.id === targetEpicId);
      expect(targetEpic?.stories).toContain(storyToMove);

      // Verificar que la historia tiene el nuevo epicId
      const movedStory = result.stories.find(s => s.id === storyToMove);
      expect(movedStory?.epicId).toBe(targetEpicId);
    });

    it('should update story metadata when reorganizing', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'hacer algo',
          value: 'obtener valor',
          description: 'Historia 1',
          components: ['core'],
        }),
      ];

      const epics = assembleEpics(stories);
      
      const newEpic = {
        ...epics[0],
        id: 'epic-2',
        title: 'Nueva Épica',
        stories: [],
      };
      epics.push(newEpic);

      const originalModified = stories[0].metadata.modified;
      const storyToMove = stories[0].id;
      const targetEpicId = newEpic.id;

      const result = reorganizeStories(storyToMove, targetEpicId, epics, stories);

      const movedStory = result.stories.find(s => s.id === storyToMove);
      expect(movedStory?.metadata.modified.getTime()).toBeGreaterThanOrEqual(
        originalModified.getTime()
      );
    });

    it('should throw error if target epic does not exist', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'hacer algo',
          value: 'obtener valor',
          description: 'Historia 1',
          components: ['core'],
        }),
      ];

      const epics = assembleEpics(stories);
      const storyToMove = stories[0].id;
      const invalidEpicId = 'non-existent-epic';

      expect(() => {
        reorganizeStories(storyToMove, invalidEpicId, epics, stories);
      }).toThrow();
    });

    it('should remove story from original epic', () => {
      const stories = [
        createStory({
          title: 'Story 1',
          role: 'usuario',
          action: 'hacer algo',
          value: 'obtener valor',
          description: 'Historia 1',
          components: ['core'],
        }),
        createStory({
          title: 'Story 2',
          role: 'usuario',
          action: 'hacer otra cosa',
          value: 'obtener otro valor',
          description: 'Historia 2',
          components: ['other'],
        }),
      ];

      const epics = assembleEpics(stories);
      
      if (epics.length === 1) {
        const newEpic = {
          ...epics[0],
          id: 'epic-2',
          title: 'Nueva Épica',
          stories: [],
        };
        epics.push(newEpic);
      }

      const storyToMove = stories[0].id;
      const originalEpic = epics.find(e => e.stories.includes(storyToMove));
      const targetEpicId = epics.find(e => e.id !== originalEpic?.id)!.id;

      const result = reorganizeStories(storyToMove, targetEpicId, epics, stories);

      // Verificar que la historia ya no está en la épica original
      if (originalEpic) {
        const updatedOriginalEpic = result.epics.find(e => e.id === originalEpic.id);
        expect(updatedOriginalEpic?.stories).not.toContain(storyToMove);
      }
    });
  });
});
