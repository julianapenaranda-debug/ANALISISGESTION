import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Story, Epic } from '../core/models';

/**
 * WorkspaceStore - Persistence for stories, epics, and workspace state
 * Uses JSON file storage with workspace indexing
 * Validates: Requirements 12.1-12.4
 */

export interface WorkspaceMetadata {
  created: Date;
  modified: Date;
  syncStatus: 'pending' | 'synced' | 'modified';
  jiraProjectKey?: string;
}

export interface Workspace {
  id: string;
  name: string;
  projectKey: string;
  stories: Story[];
  epics: Epic[];
  metadata: WorkspaceMetadata;
}

interface WorkspaceIndex {
  workspaces: Array<{
    id: string;
    name: string;
    projectKey: string;
    created: string;
    modified: string;
    syncStatus: string;
  }>;
}

export class WorkspaceStore {
  private storePath: string;
  private indexPath: string;

  constructor(storePath?: string) {
    const baseDir = storePath || path.join(os.homedir(), '.po-ai', 'workspaces');
    this.storePath = baseDir;
    this.indexPath = path.join(baseDir, 'index.json');
  }

  /**
   * Ensures the storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    await fs.mkdir(this.storePath, { recursive: true });
  }

  /**
   * Loads the workspace index
   */
  private async loadIndex(): Promise<WorkspaceIndex> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { workspaces: [] };
      }
      throw error;
    }
  }

  /**
   * Saves the workspace index
   */
  private async saveIndex(index: WorkspaceIndex): Promise<void> {
    await this.ensureStorageDir();
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf8');
  }

  /**
   * Gets the file path for a workspace
   */
  private getWorkspacePath(workspaceId: string): string {
    return path.join(this.storePath, `${workspaceId}.json`);
  }

  /**
   * Saves a workspace to disk
   */
  async saveWorkspace(workspace: Workspace): Promise<void> {
    await this.ensureStorageDir();
    
    // Update modified timestamp
    workspace.metadata.modified = new Date();
    
    // Save workspace file
    const workspacePath = this.getWorkspacePath(workspace.id);
    await fs.writeFile(workspacePath, JSON.stringify(workspace, null, 2), 'utf8');
    
    // Update index
    const index = await this.loadIndex();
    const existingIndex = index.workspaces.findIndex(w => w.id === workspace.id);
    
    const indexEntry = {
      id: workspace.id,
      name: workspace.name,
      projectKey: workspace.projectKey,
      created: workspace.metadata.created.toISOString(),
      modified: workspace.metadata.modified.toISOString(),
      syncStatus: workspace.metadata.syncStatus
    };
    
    if (existingIndex >= 0) {
      index.workspaces[existingIndex] = indexEntry;
    } else {
      index.workspaces.push(indexEntry);
    }
    
    await this.saveIndex(index);
  }

  /**
   * Loads a workspace from disk
   */
  async loadWorkspace(workspaceId: string): Promise<Workspace> {
    const workspacePath = this.getWorkspacePath(workspaceId);
    
    try {
      const data = await fs.readFile(workspacePath, 'utf8');
      const workspace = JSON.parse(data);
      
      // Convert date strings back to Date objects
      workspace.metadata.created = new Date(workspace.metadata.created);
      workspace.metadata.modified = new Date(workspace.metadata.modified);
      
      return workspace;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }
      throw error;
    }
  }

  /**
   * Lists all workspaces
   */
  async listWorkspaces(): Promise<WorkspaceMetadata[]> {
    const index = await this.loadIndex();
    
    return index.workspaces.map(w => ({
      created: new Date(w.created),
      modified: new Date(w.modified),
      syncStatus: w.syncStatus as 'pending' | 'synced' | 'modified',
      jiraProjectKey: w.projectKey
    }));
  }

  /**
   * Deletes a workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspacePath = this.getWorkspacePath(workspaceId);
    
    try {
      await fs.unlink(workspacePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }
      throw error;
    }
    
    // Update index
    const index = await this.loadIndex();
    index.workspaces = index.workspaces.filter(w => w.id !== workspaceId);
    await this.saveIndex(index);
  }

  /**
   * Checks if a workspace exists
   */
  async exists(workspaceId: string): Promise<boolean> {
    const workspacePath = this.getWorkspacePath(workspaceId);
    try {
      await fs.access(workspacePath);
      return true;
    } catch {
      return false;
    }
  }
}
