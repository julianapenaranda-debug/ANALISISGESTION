import { ChangeHistory, Change } from '../../../src/storage/change-history';
import { Story } from '../../../src/core/models';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ChangeHistory', () => {
  let history: ChangeHistory;
  let testStorePath: string;
  const workspaceId = 'test-workspace';

  beforeEach(() => {
    testStorePath = path.join(os.tmpdir(), `po-ai-test-${Date.now()}`);
    history = new ChangeHistory(workspaceId, testStorePath);
  });

  afterEach(async () => {
    try {
      await fs.rm(testStorePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createTestStory = (): Story => ({
    id: 'story-1',
    title: 'Original Title',
    role: 'usuario',
    action: 'crear tarea',
    value: 'organizar trabajo',
    description: 'Original description',
    acceptanceCriteria: [],
    components: ['backend'],
    investScore: {
      independent: 1,
      negotiable: 1,
      valuable: 1,
      estimable: 1,
      small: 1,
      testable: 1,
      overall: 1
    },
    metadata: {
      created: new Date(),
      modified: new Date(),
      source: 'generated'
    }
  });

  describe('recordChange', () => {
    it('should record a change', async () => {
      const change: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Old Title',
        newValue: 'New Title',
        author: 'user-1'
      };

      await history.recordChange('story-1', change);
      const changes = await history.getHistory('story-1');

      expect(changes).toHaveLength(1);
      expect(changes[0].id).toBe('change-1');
      expect(changes[0].field).toBe('title');
    });

    it('should record multiple changes for same story', async () => {
      const change1: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
        author: 'user-1'
      };

      const change2: Change = {
        id: 'change-2',
        timestamp: new Date(),
        field: 'description',
        oldValue: 'Old desc',
        newValue: 'New desc',
        author: 'user-1'
      };

      await history.recordChange('story-1', change1);
      await history.recordChange('story-1', change2);

      const changes = await history.getHistory('story-1');
      expect(changes).toHaveLength(2);
    });

    it('should record changes for different stories', async () => {
      const change1: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
        author: 'user-1'
      };

      const change2: Change = {
        id: 'change-2',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
        author: 'user-1'
      };

      await history.recordChange('story-1', change1);
      await history.recordChange('story-2', change2);

      const changes1 = await history.getHistory('story-1');
      const changes2 = await history.getHistory('story-2');

      expect(changes1).toHaveLength(1);
      expect(changes2).toHaveLength(1);
    });
  });

  describe('getHistory', () => {
    it('should return empty array for story with no changes', async () => {
      const changes = await history.getHistory('story-1');
      expect(changes).toEqual([]);
    });

    it('should return changes in order', async () => {
      const change1: Change = {
        id: 'change-1',
        timestamp: new Date('2024-01-01'),
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
        author: 'user-1'
      };

      const change2: Change = {
        id: 'change-2',
        timestamp: new Date('2024-01-02'),
        field: 'description',
        oldValue: 'Old',
        newValue: 'New',
        author: 'user-1'
      };

      await history.recordChange('story-1', change1);
      await history.recordChange('story-1', change2);

      const changes = await history.getHistory('story-1');
      expect(changes[0].id).toBe('change-1');
      expect(changes[1].id).toBe('change-2');
    });

    it('should preserve all change fields', async () => {
      const change: Change = {
        id: 'change-1',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        field: 'components',
        oldValue: ['backend'],
        newValue: ['backend', 'frontend'],
        author: 'user-1'
      };

      await history.recordChange('story-1', change);
      const changes = await history.getHistory('story-1');

      expect(changes[0].field).toBe('components');
      expect(changes[0].oldValue).toEqual(['backend']);
      expect(changes[0].newValue).toEqual(['backend', 'frontend']);
      expect(changes[0].author).toBe('user-1');
    });
  });

  describe('revert', () => {
    it('should revert a title change', async () => {
      const story = createTestStory();
      story.title = 'New Title';

      const change: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Original Title',
        newValue: 'New Title',
        author: 'user-1'
      };

      await history.recordChange(story.id, change);
      const reverted = await history.revert(story.id, 'change-1', story);

      expect(reverted.title).toBe('Original Title');
    });

    it('should revert a description change', async () => {
      const story = createTestStory();
      story.description = 'New description';

      const change: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'description',
        oldValue: 'Original description',
        newValue: 'New description',
        author: 'user-1'
      };

      await history.recordChange(story.id, change);
      const reverted = await history.revert(story.id, 'change-1', story);

      expect(reverted.description).toBe('Original description');
    });

    it('should revert acceptance criteria changes', async () => {
      const story = createTestStory();
      const oldCriteria = [{ id: '1', given: 'old', when: 'old', then: 'old', type: 'positive' as const }];
      const newCriteria = [{ id: '2', given: 'new', when: 'new', then: 'new', type: 'positive' as const }];
      
      story.acceptanceCriteria = newCriteria;

      const change: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'acceptanceCriteria',
        oldValue: oldCriteria,
        newValue: newCriteria,
        author: 'user-1'
      };

      await history.recordChange(story.id, change);
      const reverted = await history.revert(story.id, 'change-1', story);

      expect(reverted.acceptanceCriteria).toEqual(oldCriteria);
    });

    it('should revert component changes', async () => {
      const story = createTestStory();
      story.components = ['backend', 'frontend'];

      const change: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'components',
        oldValue: ['backend'],
        newValue: ['backend', 'frontend'],
        author: 'user-1'
      };

      await history.recordChange(story.id, change);
      const reverted = await history.revert(story.id, 'change-1', story);

      expect(reverted.components).toEqual(['backend']);
    });

    it('should revert epic assignment', async () => {
      const story = createTestStory();
      story.epicId = 'epic-2';

      const change: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'epicId',
        oldValue: 'epic-1',
        newValue: 'epic-2',
        author: 'user-1'
      };

      await history.recordChange(story.id, change);
      const reverted = await history.revert(story.id, 'change-1', story);

      expect(reverted.epicId).toBe('epic-1');
    });

    it('should throw error for non-existent change', async () => {
      const story = createTestStory();

      await expect(
        history.revert(story.id, 'non-existent', story)
      ).rejects.toThrow('Change not found: non-existent');
    });

    it('should record the revert as a new change', async () => {
      const story = createTestStory();
      story.title = 'New Title';

      const change: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Original Title',
        newValue: 'New Title',
        author: 'user-1'
      };

      await history.recordChange(story.id, change);
      await history.revert(story.id, 'change-1', story);

      const changes = await history.getHistory(story.id);
      expect(changes).toHaveLength(2);
      expect(changes[1].id).toBe('revert-change-1');
      expect(changes[1].oldValue).toBe('New Title');
      expect(changes[1].newValue).toBe('Original Title');
    });
  });

  describe('clearHistory', () => {
    it('should clear all history for a story', async () => {
      const change: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
        author: 'user-1'
      };

      await history.recordChange('story-1', change);
      await history.clearHistory('story-1');

      const changes = await history.getHistory('story-1');
      expect(changes).toEqual([]);
    });

    it('should not affect other stories', async () => {
      const change1: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
        author: 'user-1'
      };

      const change2: Change = {
        id: 'change-2',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
        author: 'user-1'
      };

      await history.recordChange('story-1', change1);
      await history.recordChange('story-2', change2);
      await history.clearHistory('story-1');

      const changes1 = await history.getHistory('story-1');
      const changes2 = await history.getHistory('story-2');

      expect(changes1).toEqual([]);
      expect(changes2).toHaveLength(1);
    });
  });

  describe('getStoriesWithChanges', () => {
    it('should return empty array when no changes recorded', async () => {
      const stories = await history.getStoriesWithChanges();
      expect(stories).toEqual([]);
    });

    it('should return all stories with changes', async () => {
      const change: Change = {
        id: 'change-1',
        timestamp: new Date(),
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
        author: 'user-1'
      };

      await history.recordChange('story-1', change);
      await history.recordChange('story-2', change);
      await history.recordChange('story-3', change);

      const stories = await history.getStoriesWithChanges();
      expect(stories).toHaveLength(3);
      expect(stories).toContain('story-1');
      expect(stories).toContain('story-2');
      expect(stories).toContain('story-3');
    });
  });
});
