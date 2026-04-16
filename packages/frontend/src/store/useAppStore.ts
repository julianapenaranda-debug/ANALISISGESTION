import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ConnectionStatus, ConnectionStatusResponse } from '@po-ai/shared';
import { apiClient } from '../api/client';

export interface Story {
  id: string;
  title: string;
  role: string;
  action: string;
  value: string;
  description: string;
  acceptanceCriteria: Array<{ id: string; given: string; when: string; then: string; type: string }>;
  components: string[];
  epicId?: string;
  investScore?: { overall: number; independent: number; negotiable: number; valuable: number; estimable: number; small: number; testable: number };
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  stories: string[];
  businessValue: string;
  dependencies: any[];
}

export interface Ambiguity {
  id: string;
  type: string;
  location: string;
  term: string;
  question: string;
  suggestions: string[];
}

export interface ConnectionState {
  jira: ConnectionStatus;
  figma: ConnectionStatus;
  datadog: ConnectionStatus;
}

type View = 'generate' | 'stories' | 'jira' | 'metrics' | 'export' | 'workspaces' | 'support' | 'workload' | 'connections' | 'flow-metrics';

interface AppState {
  // Navigation
  currentView: View;
  setCurrentView: (view: View) => void;

  // Workspace
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;

  // Stories & Epics
  stories: Story[];
  epics: Epic[];
  setStories: (stories: Story[]) => void;
  setEpics: (epics: Epic[]) => void;
  updateStory: (story: Story) => void;
  addStory: (story: Story) => void;
  removeStory: (storyId: string) => void;
  updateEpic: (epic: Epic) => void;
  addEpic: (epic: Epic) => void;
  removeEpic: (epicId: string) => void;
  moveStoryToEpic: (storyId: string, targetEpicId: string | null) => void;

  // Ambiguities
  ambiguities: Ambiguity[];
  setAmbiguities: (ambiguities: Ambiguity[]) => void;

  // Jira credentials key
  jiraCredentialKey: string | null;
  setJiraCredentialKey: (key: string | null) => void;

  // Selected Jira project (set from JiraView)
  selectedProjectKey: string | null;
  setSelectedProjectKey: (key: string | null) => void;

  // UI
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;

  // Connections
  connections: ConnectionState;
  setConnectionStatus: (service: string, status: ConnectionStatus) => void;
  fetchConnectionStatus: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      currentView: 'generate',
      setCurrentView: (view) => set({ currentView: view }),

      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),

      stories: [],
      epics: [],
      setStories: (stories) => set({ stories }),
      setEpics: (epics) => set({ epics }),
      updateStory: (story) =>
        set((state) => ({
          stories: state.stories.map((s) => (s.id === story.id ? story : s)),
        })),
      addStory: (story) =>
        set((state) => ({
          stories: [...state.stories, story],
        })),
      removeStory: (storyId) =>
        set((state) => ({
          stories: state.stories.filter((s) => s.id !== storyId),
          epics: state.epics.map((e) =>
            e.stories.includes(storyId)
              ? { ...e, stories: e.stories.filter((sid) => sid !== storyId) }
              : e
          ),
        })),
      updateEpic: (epic) =>
        set((state) => ({
          epics: state.epics.map((e) => (e.id === epic.id ? epic : e)),
        })),
      addEpic: (epic) =>
        set((state) => ({
          epics: [...state.epics, epic],
        })),
      removeEpic: (epicId) =>
        set((state) => ({
          epics: state.epics.filter((e) => e.id !== epicId),
          stories: state.stories.map((s) =>
            s.epicId === epicId ? { ...s, epicId: undefined } : s
          ),
        })),
      moveStoryToEpic: (storyId, targetEpicId) =>
        set((state) => {
          const story = state.stories.find((s) => s.id === storyId);
          if (!story) return state;
          const oldEpicId = story.epicId;
          return {
            stories: state.stories.map((s) =>
              s.id === storyId
                ? { ...s, epicId: targetEpicId ?? undefined }
                : s
            ),
            epics: state.epics.map((e) => {
              if (e.id === oldEpicId) {
                return { ...e, stories: e.stories.filter((sid) => sid !== storyId) };
              }
              if (targetEpicId && e.id === targetEpicId) {
                return { ...e, stories: [...e.stories, storyId] };
              }
              return e;
            }),
          };
        }),

      ambiguities: [],
      setAmbiguities: (ambiguities) => set({ ambiguities }),

      jiraCredentialKey: null,
      setJiraCredentialKey: (key) => set({ jiraCredentialKey: key }),

      selectedProjectKey: null,
      setSelectedProjectKey: (key) => set({ selectedProjectKey: key }),

      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      connections: { jira: 'disconnected', figma: 'disconnected', datadog: 'disconnected' },
      setConnectionStatus: (service, status) =>
        set((state) => {
          const connections = { ...state.connections, [service]: status };
          return {
            connections,
            jiraCredentialKey: connections.jira === 'connected' ? 'jira-main' : null,
          };
        }),
      fetchConnectionStatus: async () => {
        try {
          const data = await apiClient.get<ConnectionStatusResponse>('/connections/status');
          set({
            connections: { jira: data.jira, figma: data.figma, datadog: data.datadog },
            jiraCredentialKey: data.jira === 'connected' ? 'jira-main' : null,
          });
        } catch {
          // Keep current state on fetch failure
        }
      },
    }),
    { name: 'AppStore' }
  )
);
