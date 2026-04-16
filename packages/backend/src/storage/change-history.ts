import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Story } from '../core/models';

/**
 * ChangeHistory - Tracks modifications to stories
 * Validates: Requirements 12.6
 */

export interface Change {
  id: string;
  timestamp: Date;
  field: string;
  oldValue: any;
  newValue: any;
  author: string;
}

interface StoredChange {
  id: string;
  timestamp: string;
  field: string;
  oldValue: any;
  newValue: any;
  author: string;
}

interface HistoryStore {
  [storyId: string]: StoredChange[];
}

export class ChangeHistory {
  private storePath: string;
  private workspaceId: string;

  constructor(workspaceId: string, storePath?: string) {
    this.workspaceId = workspaceId;
    const baseDir = storePath || path.join(os.homedir(), '.po-ai', 'history');
    this.storePath = path.join(baseDir, `${workspaceId}.json`);
  }

  /**
   * Ensures the storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    const dir = path.dirname(this.storePath);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Loads the history store from disk
   */
  private async loadStore(): Promise<HistoryStore> {
    try {
      const data = await fs.readFile(this.storePath, 'utf8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  /**
   * Saves the history store to disk
   */
  private async saveStore(store: HistoryStore): Promise<void> {
    await this.ensureStorageDir();
    await fs.writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf8');
  }

  /**
   * Records a change to a story
   */
  async recordChange(storyId: string, change: Change): Promise<void> {
    const store = await this.loadStore();
    
    if (!store[storyId]) {
      store[storyId] = [];
    }
    
    const storedChange: StoredChange = {
      id: change.id,
      timestamp: change.timestamp.toISOString(),
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      author: change.author
    };
    
    store[storyId].push(storedChange);
    await this.saveStore(store);
  }

  /**
   * Gets the change history for a story
   */
  async getHistory(storyId: string): Promise<Change[]> {
    const store = await this.loadStore();
    const changes = store[storyId] || [];
    
    return changes.map(c => ({
      id: c.id,
      timestamp: new Date(c.timestamp),
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      author: c.author
    }));
  }

  /**
   * Reverts a specific change to a story
   * Returns the story with the change reverted
   */
  async revert(storyId: string, changeId: string, currentStory: Story): Promise<Story> {
    const history = await this.getHistory(storyId);
    const change = history.find(c => c.id === changeId);
    
    if (!change) {
      throw new Error(`Change not found: ${changeId}`);
    }
    
    // Create a new story object with the reverted field
    const revertedStory = { ...currentStory };
    
    // Revert the specific field to its old value
    switch (change.field) {
      case 'title':
        revertedStory.title = change.oldValue;
        break;
      case 'role':
        revertedStory.role = change.oldValue;
        break;
      case 'action':
        revertedStory.action = change.oldValue;
        break;
      case 'value':
        revertedStory.value = change.oldValue;
        break;
      case 'description':
        revertedStory.description = change.oldValue;
        break;
      case 'acceptanceCriteria':
        revertedStory.acceptanceCriteria = change.oldValue;
        break;
      case 'components':
        revertedStory.components = change.oldValue;
        break;
      case 'epicId':
        revertedStory.epicId = change.oldValue;
        break;
      default:
        throw new Error(`Unknown field: ${change.field}`);
    }
    
    // Record the revert as a new change
    await this.recordChange(storyId, {
      id: `revert-${changeId}`,
      timestamp: new Date(),
      field: change.field,
      oldValue: change.newValue,
      newValue: change.oldValue,
      author: 'system'
    });
    
    return revertedStory;
  }

  /**
   * Clears all history for a story
   */
  async clearHistory(storyId: string): Promise<void> {
    const store = await this.loadStore();
    delete store[storyId];
    await this.saveStore(store);
  }

  /**
   * Gets all stories with changes in this workspace
   */
  async getStoriesWithChanges(): Promise<string[]> {
    const store = await this.loadStore();
    return Object.keys(store);
  }
}
