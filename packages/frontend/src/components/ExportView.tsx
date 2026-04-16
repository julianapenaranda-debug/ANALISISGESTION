import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function ExportView() {
  const { stories, epics } = useAppStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState('');

  const toggleAll = () => {
    if (selectedIds.size === stories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stories.map((s) => s.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const getSelected = () => selectedIds.size > 0 ? stories.filter((s) => selectedIds.has(s.id)) : stories;

  const exportJson = () => {
    const selected = getSelected();
    const epicIds = new Set(selected.map((s) => s.epicId).filter(Boolean));
    const selectedEpics = epics.filter((e) => epicIds.has(e.id));
    const issues = [
      ...selectedEpics.map((e) => ({ type: 'Epic', title: e.title, description: e.description })),
      ...selected.map((s) => ({
        type: 'Story',
        title: s.title,
        description: `Como ${s.role}, quiero ${s.action}, para que ${s.value}`,
        acceptanceCriteria: s.acceptanceCriteria.map((c) => `Dado que ${c.given}, cuando ${c.when}, entonces ${c.then}`),
        components: s.components,
      })),
    ];
    const json = JSON.stringify({ issues }, null, 2);
    setPreview(json);
    download(json, 'stories.json', 'application/json');
  };

  const exportCsv = () => {
    const selected = getSelected();
    const epicIds = new Set(selected.map((s) => s.epicId).filter(Boolean));
    const selectedEpics = epics.filter((e) => epicIds.has(e.id));

    const rows = [
      ['Issue Type', 'Summary', 'Description', 'Acceptance Criteria', 'Components', 'Epic Link'],
      ...selectedEpics.map((e) => ['Epic', e.title, e.description, '', '', '']),
      ...selected.map((s) => [
        'Story',
        s.title,
        `Como ${s.role}, quiero ${s.action}, para que ${s.value}`,
        s.acceptanceCriteria.map((c) => `Dado que ${c.given}, cuando ${c.when}, entonces ${c.then}`).join(' | '),
        s.components.join(', '),
        s.epicId || '',
      ]),
    ];

    const csv = rows.map((r) => r.map((v) => v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v).join(',')).join('\n');
    setPreview(csv);
    download(csv, 'stories.csv', 'text/csv');
  };

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (stories.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg">No hay historias para exportar.</p>
        <p className="text-sm mt-1">Genera historias primero.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Exportar Historias</h2>
        <p className="text-sm text-gray-500">Selecciona las historias a exportar y elige el formato.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        <div className="flex items-center gap-3 p-3">
          <input
            type="checkbox"
            checked={selectedIds.size === stories.length}
            onChange={toggleAll}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size === 0 ? 'Todas las historias' : `${selectedIds.size} seleccionadas`}
          </span>
        </div>
        {stories.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3">
            <input
              type="checkbox"
              checked={selectedIds.has(s.id)}
              onChange={() => toggle(s.id)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">{s.title}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={exportJson}
          className="flex-1 border border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Exportar JSON
        </button>
        <button
          onClick={exportCsv}
          className="flex-1 bg-primary text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          Exportar CSV
        </button>
      </div>

      {preview && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Vista previa</p>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 overflow-auto max-h-48">
            {preview.slice(0, 1000)}{preview.length > 1000 ? '\n...' : ''}
          </pre>
        </div>
      )}
    </div>
  );
}
