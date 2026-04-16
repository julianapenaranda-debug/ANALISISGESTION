import { WorkspaceStore, Workspace } from '../../../src/storage/workspace-store';
import { Story, Epic } from '../../../src/core/models';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('WorkspaceStore', () => {
  let store: WorkspaceStore;
  let testStorePath: string;

  beforeEach(() => {
    testStorePath = path.join(os.tmpdir(), `po-ai-test-${Date.now()}`);
    store = new WorkspaceStore(testStorePath);
  });

  afterEach(async () => {
    try {
      await fs.rm(testStorePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createTestWorkspace = (id: string = 'test-workspace'): Workspace => ({
    id,
    name: 'Test Workspace',
    projectKey: 'TEST',
    stories: [],
    epics: [],
    metadata: {
      created: new Date('2024-01-01'),
      modified: new Date('2024-01-01'),
      syncStatus: 'pending'
    }
  });

  describe('saveWorkspace and loadWorkspace', () => {
    it('should save and load a workspace', async () => {
      const workspace = createTestWorkspace();
      
      await store.saveWorkspace(workspace);
      const loaded = await store.loadWorkspace(workspace.id);
      
      expect(loaded.id).toBe(workspace.id);
      expect(loaded.name).toBe(workspace.name);
      expect(loaded.projectKey).toBe(workspace.projectKey);
      expect(loaded.metadata.syncStatus).toBe('pending');
    });

    it('should save workspace with stories and epics', async () => {
      const story: Story = {
        id: 'story-1',
        title: 'Test Story',
        role: 'usuario',
        action: 'crear tarea',
        value: 'organizar trabajo',
        description: 'Como usuario, quiero crear tarea, para que organizar trabajo',
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
      };

      const epic: Epic = {
        id: 'epic-1',
        title: 'Test Epic',
        description: 'Epic description',
        businessValue: 'Business value',
        stories: ['story-1'],
        dependencies: [],
        metadata: {
          created: new Date(),
          modified: new Date()
        }
      };

      const workspace = createTestWorkspace();
      workspace.stories = [story];
      workspace.epics = [epic];
      
      await store.saveWorkspace(workspace);
      const loaded = await store.loadWorkspace(workspace.id);
      
      expect(loaded.stories).toHaveLength(1);
      expect(loaded.stories[0].id).toBe('story-1');
      expect(loaded.epics).toHaveLength(1);
      expect(loaded.epics[0].id).toBe('epic-1');
    });

    it('should update modified timestamp on save', async () => {
      const workspace = createTestWorkspace();
      const originalModified = workspace.metadata.modified;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await store.saveWorkspace(workspace);
      const loaded = await store.loadWorkspace(workspace.id);
      
      expect(loaded.metadata.modified.getTime()).toBeGreaterThan(originalModified.getTime());
    });

    it('should throw error when loading non-existent workspace', async () => {
      await expect(store.loadWorkspace('non-existent')).rejects.toThrow(
        'Workspace not found: non-existent'
      );
    });

    it('should overwrite existing workspace on save', async () => {
      const workspace = createTestWorkspace();
      workspace.name = 'Original Name';
      
      await store.saveWorkspace(workspace);
      
      workspace.name = 'Updated Name';
      await store.saveWorkspace(workspace);
      
      const loaded = await store.loadWorkspace(workspace.id);
      expect(loaded.name).toBe('Updated Name');
    });
  });

  describe('listWorkspaces', () => {
    it('should return empty array when no workspaces exist', async () => {
      const workspaces = await store.listWorkspaces();
      expect(workspaces).toEqual([]);
    });

    it('should list all saved workspaces', async () => {
      const workspace1 = createTestWorkspace('ws-1');
      const workspace2 = createTestWorkspace('ws-2');
      const workspace3 = createTestWorkspace('ws-3');
      
      await store.saveWorkspace(workspace1);
      await store.saveWorkspace(workspace2);
      await store.saveWorkspace(workspace3);
      
      const workspaces = await store.listWorkspaces();
      expect(workspaces).toHaveLength(3);
    });

    it('should return workspace metadata', async () => {
      const workspace = createTestWorkspace();
      workspace.metadata.syncStatus = 'synced';
      workspace.metadata.jiraProjectKey = 'PROJ';
      
      await store.saveWorkspace(workspace);
      
      const workspaces = await store.listWorkspaces();
      expect(workspaces[0].syncStatus).toBe('synced');
      expect(workspaces[0].jiraProjectKey).toBe('PROJ');
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete an existing workspace', async () => {
      const workspace = createTestWorkspace();
      
      await store.saveWorkspace(workspace);
      await store.deleteWorkspace(workspace.id);
      
      await expect(store.loadWorkspace(workspace.id)).rejects.toThrow();
    });

    it('should throw error when deleting non-existent workspace', async () => {
      await expect(store.deleteWorkspace('non-existent')).rejects.toThrow(
        'Workspace not found: non-existent'
      );
    });

    it('should remove workspace from index', async () => {
      const workspace = createTestWorkspace();
      
      await store.saveWorkspace(workspace);
      await store.deleteWorkspace(workspace.id);
      
      const workspaces = await store.listWorkspaces();
      expect(workspaces).toHaveLength(0);
    });

    it('should not affect other workspaces', async () => {
      const workspace1 = createTestWorkspace('ws-1');
      const workspace2 = createTestWorkspace('ws-2');
      
      await store.saveWorkspace(workspace1);
      await store.saveWorkspace(workspace2);
      await store.deleteWorkspace('ws-1');
      
      const loaded = await store.loadWorkspace('ws-2');
      expect(loaded.id).toBe('ws-2');
      
      const workspaces = await store.listWorkspaces();
      expect(workspaces).toHaveLength(1);
    });
  });

  describe('exists', () => {
    it('should return true for existing workspace', async () => {
      const workspace = createTestWorkspace();
      
      await store.saveWorkspace(workspace);
      const exists = await store.exists(workspace.id);
      
      expect(exists).toBe(true);
    });

    it('should return false for non-existent workspace', async () => {
      const exists = await store.exists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('index management', () => {
    it('should maintain index across multiple saves', async () => {
      const workspace = createTestWorkspace();
      
      await store.saveWorkspace(workspace);
      workspace.name = 'Updated';
      await store.saveWorkspace(workspace);
      
      const workspaces = await store.listWorkspaces();
      expect(workspaces).toHaveLength(1);
    });

    it('should handle multiple workspaces in index', async () => {
      for (let i = 0; i < 5; i++) {
        const workspace = createTestWorkspace(`ws-${i}`);
        await store.saveWorkspace(workspace);
      }
      
      const workspaces = await store.listWorkspaces();
      expect(workspaces).toHaveLength(5);
    });
  });
});
