// Tipos para exportación de artefactos

import { Story, Epic } from './domain';

/**
 * ExportFormat formato de exportación
 */
export type ExportFormat = 'json' | 'csv';

/**
 * ExportOptions opciones para exportación
 */
export interface ExportOptions {
  format: ExportFormat;
  selectedStoryIds?: string[];
  includeEpics?: boolean;
  projectKey: string;
}

/**
 * ExportResult resultado de exportación
 */
export interface ExportResult {
  format: ExportFormat;
  content: string;
  filename: string;
  size: number;
}
