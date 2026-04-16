import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore, Story, Epic } from '../store/useAppStore';
import { apiClient } from '../api/client';

/* ─── helpers ─── */

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStory(epicId?: string): Story {
  return {
    id: genId(),
    title: '',
    role: '',
    action: '',
    value: '',
    description: '',
    acceptanceCriteria: [{ id: genId(), given: '', when: '', then: '', type: 'functional' }],
    components: [],
    epicId,
  };
}

function emptyEpic(): Epic {
  return {
    id: genId(),
    title: '',
    description: '',
    stories: [],
    businessValue: '',
    dependencies: [],
  };
}

/* ─── INVEST badge ─── */

function InvestBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? 'bg-green-100 text-green-700'
      : pct >= 50
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      INVEST {pct}%
    </span>
  );
}


/* ─── Confirm dialog ─── */

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-m p-6 max-w-sm w-full mx-4 space-y-4">
        <p className="text-sm text-grey-800">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary text-xs">
            Cancelar
          </button>
          <button onClick={onConfirm} className="bg-error text-white text-xs px-4 py-2 rounded-lg hover:opacity-90 transition-colors">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Editable criterion row ─── */

function CriterionRow({
  criterion,
  onUpdate,
  onDelete,
}: {
  criterion: { id: string; given: string; when: string; then: string; type: string };
  onUpdate: (c: { id: string; given: string; when: string; then: string; type: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [given, setGiven] = useState(criterion.given);
  const [when, setWhen] = useState(criterion.when);
  const [then_, setThen] = useState(criterion.then);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    onUpdate({ ...criterion, given, when, then: then_ });
    setEditing(false);
  };

  const cancel = () => {
    setGiven(criterion.given);
    setWhen(criterion.when);
    setThen(criterion.then);
    setEditing(false);
  };

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message="¿Eliminar este criterio de aceptación?"
          onConfirm={() => {
            onDelete(criterion.id);
            setConfirmDelete(false);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {editing ? (
        <li className="text-xs bg-grey-200 rounded p-3 space-y-2">
          <div className="flex items-center gap-1">
            <span className="text-grey-600 font-medium w-20 shrink-0">Dado que</span>
            <input className="input-field text-xs py-1" value={given} onChange={(e) => setGiven(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-grey-600 font-medium w-20 shrink-0">Cuando</span>
            <input className="input-field text-xs py-1" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-grey-600 font-medium w-20 shrink-0">Entonces</span>
            <input className="input-field text-xs py-1" value={then_} onChange={(e) => setThen(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} className="text-xs bg-primary text-white px-3 py-1 rounded">Guardar</button>
            <button onClick={cancel} className="text-xs text-grey-600 px-2 py-1">Cancelar</button>
          </div>
        </li>
      ) : (
        <li
          className="text-xs text-grey-700 bg-grey-200 rounded p-2 cursor-pointer hover:bg-grey-300 transition-colors group flex items-start justify-between gap-2"
          onClick={() => setEditing(true)}
        >
          <span>
            <span className="text-grey-500">Dado que</span> {criterion.given},{' '}
            <span className="text-grey-500">cuando</span> {criterion.when},{' '}
            <span className="text-grey-500">entonces</span> {criterion.then}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            className="text-error text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            Eliminar
          </button>
        </li>
      )}
    </>
  );
}


/* ─── New criterion form ─── */

function NewCriterionForm({ onAdd, onCancel }: { onAdd: (c: { id: string; given: string; when: string; then: string; type: string }) => void; onCancel: () => void }) {
  const [given, setGiven] = useState('');
  const [when, setWhen] = useState('');
  const [then_, setThen] = useState('');

  const handleAdd = () => {
    if (!given.trim() && !when.trim() && !then_.trim()) return;
    onAdd({ id: genId(), given: given.trim(), when: when.trim(), then: then_.trim(), type: 'functional' });
  };

  return (
    <li className="text-xs bg-primary/5 border border-primary-light rounded p-3 space-y-2">
      <div className="flex items-center gap-1">
        <span className="text-grey-600 font-medium w-20 shrink-0">Dado que</span>
        <input className="input-field text-xs py-1" value={given} onChange={(e) => setGiven(e.target.value)} placeholder="condición inicial..." />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-grey-600 font-medium w-20 shrink-0">Cuando</span>
        <input className="input-field text-xs py-1" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="acción del usuario..." />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-grey-600 font-medium w-20 shrink-0">Entonces</span>
        <input className="input-field text-xs py-1" value={then_} onChange={(e) => setThen(e.target.value)} placeholder="resultado esperado..." />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={handleAdd} className="text-xs bg-primary text-white px-3 py-1 rounded">Agregar</button>
        <button onClick={onCancel} className="text-xs text-grey-600 px-2 py-1">Cancelar</button>
      </div>
    </li>
  );
}


/* ─── StoryCard — full inline editing ─── */

function StoryCard({ story, epics }: { story: Story; epics: Epic[] }) {
  const { updateStory, removeStory, moveStoryToEpic } = useAppStore();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(story.title);
  const [role, setRole] = useState(story.role);
  const [action, setAction] = useState(story.action);
  const [value, setValue] = useState(story.value);
  const [description, setDescription] = useState(story.description);
  const [criteria, setCriteria] = useState(story.acceptanceCriteria);
  const [addingCriterion, setAddingCriterion] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    updateStory({
      ...story,
      title: title.trim(),
      role: role.trim(),
      action: action.trim(),
      value: value.trim(),
      description: description.trim(),
      acceptanceCriteria: criteria,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setTitle(story.title);
    setRole(story.role);
    setAction(story.action);
    setValue(story.value);
    setDescription(story.description);
    setCriteria(story.acceptanceCriteria);
    setAddingCriterion(false);
    setEditing(false);
  };

  const updateCriterion = (updated: { id: string; given: string; when: string; then: string; type: string }) => {
    const next = criteria.map((c) => (c.id === updated.id ? updated : c));
    setCriteria(next);
    updateStory({ ...story, acceptanceCriteria: next });
  };

  const deleteCriterion = (id: string) => {
    const next = criteria.filter((c) => c.id !== id);
    setCriteria(next);
    updateStory({ ...story, acceptanceCriteria: next });
  };

  const addCriterion = (c: { id: string; given: string; when: string; then: string; type: string }) => {
    const next = [...criteria, c];
    setCriteria(next);
    updateStory({ ...story, acceptanceCriteria: next });
    setAddingCriterion(false);
  };

  const handleEpicChange = (epicId: string) => {
    moveStoryToEpic(story.id, epicId === '' ? null : epicId);
  };

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message={`¿Eliminar la historia "${story.title || 'Sin título'}"?`}
          onConfirm={() => { removeStory(story.id); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div className="bg-white border border-grey-300 rounded-lg p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          {editing ? (
            <input
              className="input-field text-sm font-medium flex-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la historia..."
            />
          ) : (
            <h3 className="font-medium text-grey-900 flex-1">{story.title || <span className="italic text-grey-500">Sin título</span>}</h3>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {story.investScore && <InvestBadge score={story.investScore.overall} />}
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
                Editar
              </button>
            )}
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-error hover:underline">
              Eliminar
            </button>
          </div>
        </div>

        {/* Editable fields */}
        {editing ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-grey-600 font-medium block mb-1">Rol (Como...)</label>
                <input className="input-field text-xs" value={role} onChange={(e) => setRole(e.target.value)} placeholder="usuario, admin..." />
              </div>
              <div>
                <label className="text-xs text-grey-600 font-medium block mb-1">Acción (Quiero...)</label>
                <input className="input-field text-xs" value={action} onChange={(e) => setAction(e.target.value)} placeholder="poder hacer..." />
              </div>
              <div>
                <label className="text-xs text-grey-600 font-medium block mb-1">Valor (Para que...)</label>
                <input className="input-field text-xs" value={value} onChange={(e) => setValue(e.target.value)} placeholder="beneficio..." />
              </div>
            </div>
            <div>
              <label className="text-xs text-grey-600 font-medium block mb-1">Descripción</label>
              <textarea
                className="input-field text-xs"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción adicional..."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} className="btn-primary text-xs">Guardar</button>
              <button onClick={handleCancel} className="btn-secondary text-xs">Cancelar</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-grey-700 italic">
            Como <strong>{story.role}</strong>, quiero <strong>{story.action}</strong>, para que <strong>{story.value}</strong>
          </p>
        )}

        {/* Epic selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-grey-600 font-medium">Épica:</label>
          <select
            className="text-xs border border-grey-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            value={story.epicId ?? ''}
            onChange={(e) => handleEpicChange(e.target.value)}
          >
            <option value="">Sin épica</option>
            {epics.map((ep) => (
              <option key={ep.id} value={ep.id}>{ep.title || 'Épica sin nombre'}</option>
            ))}
          </select>
        </div>

        {/* Acceptance criteria */}
        <div>
          <p className="text-xs font-semibold text-grey-600 uppercase tracking-wide mb-1">Criterios de Aceptación</p>
          <ul className="space-y-1">
            {criteria.map((c) => (
              <CriterionRow key={c.id} criterion={c} onUpdate={updateCriterion} onDelete={deleteCriterion} />
            ))}
            {addingCriterion && (
              <NewCriterionForm onAdd={addCriterion} onCancel={() => setAddingCriterion(false)} />
            )}
          </ul>
          {!addingCriterion && (
            <button
              onClick={() => setAddingCriterion(true)}
              className="text-xs text-primary hover:underline mt-2"
            >
              + Agregar criterio
            </button>
          )}
        </div>

        {/* Components */}
        {story.components.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {story.components.map((c) => (
              <span key={c} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{c}</span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}


/* ─── Epic header — inline editing ─── */

function EpicHeader({
  epic,
  storyCount,
}: {
  epic: Epic;
  storyCount: number;
}) {
  const { updateEpic, removeEpic } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(epic.title);
  const [description, setDescription] = useState(epic.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    updateEpic({ ...epic, title: title.trim(), description: description.trim() });
    setEditing(false);
  };

  const cancel = () => {
    setTitle(epic.title);
    setDescription(epic.description);
    setEditing(false);
  };

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message={`¿Eliminar la épica "${epic.title || 'Sin nombre'}" y desasociar sus ${storyCount} historias?`}
          onConfirm={() => { removeEpic(epic.id); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div className="flex items-start gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0 mt-0.5">
          Épica
        </span>
        {editing ? (
          <div className="flex-1 space-y-2">
            <input
              className="input-field text-sm font-semibold"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre de la épica..."
            />
            <textarea
              className="input-field text-xs"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción de la épica..."
            />
            <div className="flex gap-2">
              <button onClick={save} className="text-xs bg-primary text-white px-3 py-1 rounded">Guardar</button>
              <button onClick={cancel} className="text-xs text-grey-600 px-2 py-1">Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <h3
              className="font-semibold text-grey-900 cursor-pointer hover:text-primary transition-colors"
              onClick={() => setEditing(true)}
              title="Clic para editar"
            >
              {epic.title || <span className="italic text-grey-500">Sin nombre</span>}
            </h3>
            <span className="text-xs text-grey-500 bg-grey-200 px-2 py-0.5 rounded-full shrink-0">
              {storyCount} {storyCount === 1 ? 'historia' : 'historias'}
            </span>
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-error hover:underline shrink-0">
              Eliminar
            </button>
          </>
        )}
      </div>
      {!editing && epic.description && (
        <p className="text-xs text-grey-600 mb-3 ml-14">{epic.description}</p>
      )}
    </>
  );
}


/* ─── New epic form ─── */

function NewEpicForm({ onClose }: { onClose: () => void }) {
  const { addEpic } = useAppStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!title.trim()) return;
    addEpic({
      ...emptyEpic(),
      title: title.trim(),
      description: description.trim(),
    });
    onClose();
  };

  return (
    <div className="bg-primary/5 border border-primary-light rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-grey-800">Nueva Épica</p>
      <input
        className="input-field text-sm"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nombre de la épica..."
        autoFocus
      />
      <textarea
        className="input-field text-xs"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción (opcional)..."
      />
      <div className="flex gap-2">
        <button onClick={handleCreate} className="btn-primary text-xs" disabled={!title.trim()}>
          Crear épica
        </button>
        <button onClick={onClose} className="btn-secondary text-xs">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ─── New story form ─── */

function NewStoryForm({ onClose }: { onClose: () => void }) {
  const { addStory, epics } = useAppStore();
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');
  const [value, setValue] = useState('');
  const [epicId, setEpicId] = useState('');
  const [criteria, setCriteria] = useState([{ id: genId(), given: '', when: '', then: '', type: 'functional' }]);

  const updateCriterionField = useCallback(
    (idx: number, field: 'given' | 'when' | 'then', val: string) => {
      setCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c)));
    },
    [],
  );

  const addCriterionRow = () => {
    setCriteria((prev) => [...prev, { id: genId(), given: '', when: '', then: '', type: 'functional' }]);
  };

  const removeCriterionRow = (idx: number) => {
    if (criteria.length <= 1) return;
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const story: Story = {
      ...emptyStory(epicId || undefined),
      title: title.trim(),
      role: role.trim(),
      action: action.trim(),
      value: value.trim(),
      acceptanceCriteria: criteria.filter((c) => c.given.trim() || c.when.trim() || c.then.trim()),
    };
    if (story.acceptanceCriteria.length === 0) {
      story.acceptanceCriteria = [{ id: genId(), given: '', when: '', then: '', type: 'functional' }];
    }
    addStory(story);
    onClose();
  };

  return (
    <div className="bg-white border-2 border-primary-light rounded-lg p-5 space-y-4">
      <p className="text-sm font-semibold text-grey-800">Nueva Historia de Usuario</p>

      <input className="input-field text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la historia..." autoFocus />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-grey-600 font-medium block mb-1">Rol (Como...)</label>
          <input className="input-field text-xs" value={role} onChange={(e) => setRole(e.target.value)} placeholder="usuario..." />
        </div>
        <div>
          <label className="text-xs text-grey-600 font-medium block mb-1">Acción (Quiero...)</label>
          <input className="input-field text-xs" value={action} onChange={(e) => setAction(e.target.value)} placeholder="poder hacer..." />
        </div>
        <div>
          <label className="text-xs text-grey-600 font-medium block mb-1">Valor (Para que...)</label>
          <input className="input-field text-xs" value={value} onChange={(e) => setValue(e.target.value)} placeholder="beneficio..." />
        </div>
      </div>

      {/* Epic selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-grey-600 font-medium">Épica:</label>
        <select
          className="text-xs border border-grey-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={epicId}
          onChange={(e) => setEpicId(e.target.value)}
        >
          <option value="">Sin épica</option>
          {epics.map((ep) => (
            <option key={ep.id} value={ep.id}>{ep.title || 'Épica sin nombre'}</option>
          ))}
        </select>
      </div>

      {/* Criteria */}
      <div>
        <p className="text-xs font-semibold text-grey-600 uppercase tracking-wide mb-2">Criterios de Aceptación</p>
        <div className="space-y-2">
          {criteria.map((c, idx) => (
            <div key={c.id} className="bg-grey-200 rounded p-3 space-y-1 relative">
              <div className="flex items-center gap-1">
                <span className="text-xs text-grey-600 font-medium w-20 shrink-0">Dado que</span>
                <input className="input-field text-xs py-1" value={c.given} onChange={(e) => updateCriterionField(idx, 'given', e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-grey-600 font-medium w-20 shrink-0">Cuando</span>
                <input className="input-field text-xs py-1" value={c.when} onChange={(e) => updateCriterionField(idx, 'when', e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-grey-600 font-medium w-20 shrink-0">Entonces</span>
                <input className="input-field text-xs py-1" value={c.then} onChange={(e) => updateCriterionField(idx, 'then', e.target.value)} />
              </div>
              {criteria.length > 1 && (
                <button
                  onClick={() => removeCriterionRow(idx)}
                  className="absolute top-2 right-2 text-xs text-error hover:underline"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addCriterionRow} className="text-xs text-primary hover:underline mt-2">
          + Agregar criterio
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleCreate} className="btn-primary text-xs" disabled={!title.trim()}>
          Crear historia
        </button>
        <button onClick={onClose} className="btn-secondary text-xs">
          Cancelar
        </button>
      </div>
    </div>
  );
}


/* ─── Jira project/epic types ─── */

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrl?: string;
}

interface JiraEpicOption {
  id: string;
  key: string;
  summary: string;
}

interface JiraCreationResult {
  localId: string;
  jiraKey: string;
  jiraId: string;
  url: string;
}

interface JiraFailedResult {
  localId: string;
  error: string;
}

/* ─── CreateInJiraPanel ─── */

type JiraStep = 'select-project' | 'select-epic' | 'confirm' | 'creating' | 'results';

function CreateInJiraPanel({ onClose }: { onClose: () => void }) {
  const { stories } = useAppStore();

  // Step state
  const [step, setStep] = useState<JiraStep>('select-project');

  // Project search
  const [projectQuery, setProjectQuery] = useState('');
  const [projectResults, setProjectResults] = useState<JiraProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState<JiraProject | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Epic selection
  const [jiraEpics, setJiraEpics] = useState<JiraEpicOption[]>([]);
  const [loadingEpics, setLoadingEpics] = useState(false);
  const [selectedEpicKey, setSelectedEpicKey] = useState<string>('__new__');
  const [newEpicName, setNewEpicName] = useState('');

  // Creation progress
  const [createdCount, setCreatedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [creationResults, setCreationResults] = useState<JiraCreationResult[]>([]);
  const [creationFailed, setCreationFailed] = useState<JiraFailedResult[]>([]);
  const [creationError, setCreationError] = useState<string | null>(null);

  // Debounced project search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!projectQuery.trim()) {
      setProjectResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingProjects(true);
      try {
        const results = await apiClient.get<JiraProject[]>(
          `/jira/projects?credentialKey=jira-main`
        );
        const q = projectQuery.toLowerCase();
        const filtered = results
          .filter((p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))
          .slice(0, 10);
        setProjectResults(filtered);
      } catch {
        setProjectResults([]);
      } finally {
        setLoadingProjects(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [projectQuery]);

  // Load epics when project selected
  const handleSelectProject = async (project: JiraProject) => {
    setSelectedProject(project);
    setProjectQuery(project.name);
    setProjectResults([]);
    setStep('select-epic');
    setLoadingEpics(true);
    try {
      const epicsData = await apiClient.get<JiraEpicOption[]>(
        `/jira/projects/${project.key}/epics?credentialKey=jira-main`
      );
      setJiraEpics(epicsData);
    } catch {
      setJiraEpics([]);
    } finally {
      setLoadingEpics(false);
    }
  };

  const handleConfirmStep = () => {
    if (selectedEpicKey === '__new__' && !newEpicName.trim()) return;
    setStep('confirm');
  };

  const handleCreate = async () => {
    if (!selectedProject) return;
    setStep('creating');
    setCreationError(null);
    setCreationResults([]);
    setCreationFailed([]);

    const storiesToCreate = stories;
    const total = storiesToCreate.length + (selectedEpicKey === '__new__' ? 1 : 0);
    setTotalCount(total);
    setCreatedCount(0);

    try {
      // Build epics to send: if new epic, include it; otherwise empty
      const epicsToSync = selectedEpicKey === '__new__'
        ? [{ id: '__new-epic__', title: newEpicName.trim(), description: '', stories: storiesToCreate.map((s) => s.id), businessValue: '', dependencies: [] }]
        : [];

      // Map stories to include epicId pointing to the selected/new epic
      const mappedStories = storiesToCreate.map((s) => ({
        ...s,
        epicId: selectedEpicKey === '__new__' ? '__new-epic__' : (selectedEpicKey !== '__none__' ? selectedEpicKey : undefined),
      }));

      const result = await apiClient.post<{ created: JiraCreationResult[]; failed: JiraFailedResult[] }>(
        '/jira/sync',
        {
          credentialKey: 'jira-main',
          projectKey: selectedProject.key,
          stories: mappedStories,
          epics: epicsToSync,
        }
      );

      setCreationResults(result.created);
      setCreationFailed(result.failed);
      setCreatedCount(result.created.length);
      setStep('results');
    } catch (err: any) {
      setCreationError(err.message || 'Error al crear en Jira');
      setStep('results');
    }
  };

  const handleRetryFailed = async () => {
    if (!selectedProject || creationFailed.length === 0) return;
    setStep('creating');
    setCreationError(null);

    const failedIds = new Set(creationFailed.map((f) => f.localId));
    const failedStories = stories.filter((s) => failedIds.has(s.id));

    setTotalCount(failedStories.length);
    setCreatedCount(0);
    setCreationFailed([]);

    try {
      const mappedStories = failedStories.map((s) => ({
        ...s,
        epicId: selectedEpicKey === '__new__' ? undefined : (selectedEpicKey !== '__none__' ? selectedEpicKey : undefined),
      }));

      const result = await apiClient.post<{ created: JiraCreationResult[]; failed: JiraFailedResult[] }>(
        '/jira/sync',
        {
          credentialKey: 'jira-main',
          projectKey: selectedProject.key,
          stories: mappedStories,
          epics: [],
        }
      );

      setCreationResults((prev) => [...prev, ...result.created]);
      setCreationFailed(result.failed);
      setCreatedCount((prev) => prev + result.created.length);
      setStep('results');
    } catch (err: any) {
      setCreationError(err.message || 'Error al reintentar');
      setStep('results');
    }
  };

  const parentEpicLabel =
    selectedEpicKey === '__new__'
      ? `Nueva: "${newEpicName}"`
      : selectedEpicKey === '__none__'
        ? 'Sin épica padre'
        : jiraEpics.find((e) => e.key === selectedEpicKey)?.summary || selectedEpicKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-m w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-grey-300">
          <h3 className="font-semibold text-grey-900">Crear en Jira</h3>
          {step !== 'creating' && (
            <button onClick={onClose} className="text-grey-500 hover:text-grey-800 text-lg leading-none">&times;</button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Step 1: Select project */}
          {step === 'select-project' && (
            <>
              <p className="text-sm text-grey-700">Busca y selecciona el proyecto Jira destino:</p>
              <input
                className="input-field text-sm"
                placeholder="Buscar proyecto por nombre o clave..."
                value={projectQuery}
                onChange={(e) => { setProjectQuery(e.target.value); setSelectedProject(null); }}
                autoFocus
              />
              {loadingProjects && <p className="text-xs text-grey-500">Buscando proyectos...</p>}
              {projectResults.length > 0 && (
                <ul className="border border-grey-300 rounded-lg max-h-48 overflow-y-auto divide-y divide-grey-200">
                  {projectResults.map((p) => (
                    <li
                      key={p.id}
                      className="px-3 py-2 hover:bg-primary/5 cursor-pointer text-sm flex items-center gap-2"
                      onClick={() => handleSelectProject(p)}
                    >
                      <span className="font-medium text-primary">{p.key}</span>
                      <span className="text-grey-700">{p.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Step 2: Select epic */}
          {step === 'select-epic' && selectedProject && (
            <>
              <p className="text-sm text-grey-700">
                Proyecto: <span className="font-medium text-primary">{selectedProject.key}</span> — {selectedProject.name}
              </p>
              <p className="text-sm text-grey-700">Selecciona la épica padre en Jira:</p>
              {loadingEpics ? (
                <p className="text-xs text-grey-500">Cargando épicas...</p>
              ) : (
                <select
                  className="input-field text-sm"
                  value={selectedEpicKey}
                  onChange={(e) => setSelectedEpicKey(e.target.value)}
                >
                  <option value="__new__">Crear nueva épica</option>
                  <option value="__none__">Sin épica padre</option>
                  {jiraEpics.map((ep) => (
                    <option key={ep.key} value={ep.key}>{ep.key} — {ep.summary}</option>
                  ))}
                </select>
              )}
              {selectedEpicKey === '__new__' && (
                <input
                  className="input-field text-sm"
                  placeholder="Nombre de la nueva épica..."
                  value={newEpicName}
                  onChange={(e) => setNewEpicName(e.target.value)}
                />
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setStep('select-project'); setSelectedProject(null); setProjectQuery(''); }} className="btn-secondary text-xs">
                  Atrás
                </button>
                <button
                  onClick={handleConfirmStep}
                  className="btn-primary text-xs"
                  disabled={selectedEpicKey === '__new__' && !newEpicName.trim()}
                >
                  Continuar
                </button>
              </div>
            </>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && selectedProject && (
            <>
              <p className="text-sm font-semibold text-grey-800">Resumen de creación</p>
              <div className="bg-grey-200 rounded-lg p-3 space-y-1 text-sm">
                <p><span className="text-grey-600">Historias a crear:</span> <span className="font-medium">{stories.length}</span></p>
                <p><span className="text-grey-600">Proyecto destino:</span> <span className="font-medium text-primary">{selectedProject.key}</span> — {selectedProject.name}</p>
                <p><span className="text-grey-600">Épica padre:</span> <span className="font-medium">{parentEpicLabel}</span></p>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep('select-epic')} className="btn-secondary text-xs">
                  Atrás
                </button>
                <button onClick={handleCreate} className="btn-primary text-xs">
                  Confirmar y crear
                </button>
              </div>
            </>
          )}

          {/* Step 4: Creating — progress */}
          {step === 'creating' && (
            <>
              <p className="text-sm text-grey-700">Creando issues en Jira...</p>
              <div className="w-full bg-grey-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-300"
                  style={{ width: totalCount > 0 ? `${Math.round((createdCount / totalCount) * 100)}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-grey-500 text-center">
                {createdCount} / {totalCount}
              </p>
            </>
          )}

          {/* Step 5: Results */}
          {step === 'results' && (
            <>
              {creationError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {creationError}
                </div>
              )}
              {creationResults.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-green-700">
                    ✓ {creationResults.length} issue{creationResults.length !== 1 ? 's' : ''} creado{creationResults.length !== 1 ? 's' : ''}
                  </p>
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {creationResults.map((r) => (
                      <li key={r.jiraKey} className="text-sm flex items-center gap-2">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          {r.jiraKey}
                        </a>
                        <span className="text-grey-500 text-xs truncate">
                          {stories.find((s) => s.id === r.localId)?.title || r.localId}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {creationFailed.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-red-700">
                    ✗ {creationFailed.length} fallido{creationFailed.length !== 1 ? 's' : ''}
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {creationFailed.map((f) => (
                      <li key={f.localId} className="text-xs text-red-600">
                        {stories.find((s) => s.id === f.localId)?.title || f.localId}: {f.error}
                      </li>
                    ))}
                  </ul>
                  <button onClick={handleRetryFailed} className="btn-primary text-xs">
                    Reintentar fallidos
                  </button>
                </>
              )}
              <div className="pt-2">
                <button onClick={onClose} className="btn-secondary text-xs w-full">
                  Cerrar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── Main view ─── */

export default function StoriesView() {
  const { stories, epics, connections } = useAppStore();
  const [showNewStory, setShowNewStory] = useState(false);
  const [showNewEpic, setShowNewEpic] = useState(false);
  const [showJiraPanel, setShowJiraPanel] = useState(false);

  if (stories.length === 0 && !showNewStory) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16 text-grey-500">
          <p className="text-lg">No hay historias generadas aún.</p>
          <p className="text-sm mt-1">Ve a "Generar" para crear historias de usuario.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => setShowNewStory(true)} className="btn-primary text-sm">
            + Agregar Historia
          </button>
          <button onClick={() => setShowNewEpic(true)} className="btn-secondary text-sm">
            + Crear épica
          </button>
        </div>
        {showNewEpic && <NewEpicForm onClose={() => setShowNewEpic(false)} />}
        {showNewStory && <NewStoryForm onClose={() => setShowNewStory(false)} />}
      </div>
    );
  }

  // Group stories by epic
  const epicMap = new Map(epics.map((e) => [e.id, e]));
  const storiesByEpic = new Map<string, Story[]>();
  const unassigned: Story[] = [];

  for (const story of stories) {
    if (story.epicId && epicMap.has(story.epicId)) {
      const list = storiesByEpic.get(story.epicId) || [];
      list.push(story);
      storiesByEpic.set(story.epicId, list);
    } else {
      unassigned.push(story);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-grey-900">
          Historias de Usuario{' '}
          <span className="text-grey-500 font-normal text-base">({stories.length})</span>
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setShowNewEpic(true)} className="btn-secondary text-xs">
            + Crear épica
          </button>
          {connections.jira === 'connected' && stories.length > 0 && (
            <button onClick={() => setShowJiraPanel(true)} className="btn-primary text-xs">
              Crear en Jira
            </button>
          )}
        </div>
      </div>

      {/* New epic form */}
      {showNewEpic && <NewEpicForm onClose={() => setShowNewEpic(false)} />}

      {/* Epics with stories */}
      {epics.map((epic) => {
        const epicStories = storiesByEpic.get(epic.id) || [];
        return (
          <div key={epic.id}>
            <EpicHeader epic={epic} storyCount={epicStories.length} />
            <div className="space-y-3 ml-4">
              {epicStories.map((s) => (
                <StoryCard key={s.id} story={s} epics={epics} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Unassigned stories */}
      {unassigned.length > 0 && (
        <div>
          {epics.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wide text-grey-600 bg-grey-200 px-2 py-0.5 rounded">
                Sin épica
              </span>
              <span className="text-xs text-grey-500 bg-grey-200 px-2 py-0.5 rounded-full">
                {unassigned.length} {unassigned.length === 1 ? 'historia' : 'historias'}
              </span>
            </div>
          )}
          <div className="space-y-3">
            {unassigned.map((s) => (
              <StoryCard key={s.id} story={s} epics={epics} />
            ))}
          </div>
        </div>
      )}

      {/* Add story button */}
      <div className="pt-2">
        {showNewStory ? (
          <NewStoryForm onClose={() => setShowNewStory(false)} />
        ) : (
          <button onClick={() => setShowNewStory(true)} className="btn-primary text-sm w-full">
            + Agregar Historia
          </button>
        )}
      </div>

      {/* Jira creation panel */}
      {showJiraPanel && <CreateInJiraPanel onClose={() => setShowJiraPanel(false)} />}
    </div>
  );
}
