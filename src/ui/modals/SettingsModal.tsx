import React from 'react';
import { X, Key, Cpu, Volume2, Save } from 'lucide-react';
import type { JarvisSettings } from '../../types/hud';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: JarvisSettings;
  onSaveSettings: (newSettings: JarvisSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = React.useState<JarvisSettings>(settings);

  React.useEffect(() => {
    setFormData(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="hud-panel modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">SYSTEM CONFIGURATION // SETTINGS</div>
          <button className="hud-btn hud-btn-icon" onClick={onClose} style={{ width: '28px', height: '28px' }}>
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} color="var(--cyan-primary)" />
              <span>AI Provider Engine</span>
            </label>
            <select
              className="form-select"
              value={formData.cloudProvider}
              onChange={(e) => setFormData({ ...formData, cloudProvider: e.target.value as 'openrouter' | 'ollama' })}
            >
              <option value="openrouter">OpenRouter (Cloud Engine - Recommended)</option>
              <option value="ollama">Ollama (Local Engine - Optional Stage 7)</option>
            </select>
          </div>

          {formData.cloudProvider === 'openrouter' ? (
            <div className="form-group">
              <label className="form-label">OpenRouter Primary Model</label>
              <select
                className="form-select"
                value={formData.openRouterModel}
                onChange={(e) => setFormData({ ...formData, openRouterModel: e.target.value })}
              >
                <option value="anthropic/claude-3.5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                <option value="meta-llama/llama-3.3-70b-instruct">Meta Llama 3.3 70B Instruct</option>
                <option value="google/gemini-2.0-flash">Google Gemini 2.0 Flash</option>
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Ollama Local Model Identifier</label>
              <input
                type="text"
                className="form-input"
                value={formData.ollamaModel}
                onChange={(e) => setFormData({ ...formData, ollamaModel: e.target.value })}
                placeholder="e.g. llama3.2:3b, mistral:7b"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} color="var(--cyan-primary)" />
              <span>OpenRouter API Key Status</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="password"
                className="form-input"
                style={{ flex: 1 }}
                placeholder="••••••••••••••••••••••••••••••••"
                readOnly
              />
              <span className="hud-tag" style={{ color: formData.hasApiKey ? '#86efac' : 'var(--state-thinking)' }}>
                {formData.hasApiKey ? 'CONFIGURED (safeStorage)' : 'MOCK MODE'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Encrypted in OS credential store via Electron safeStorage. Never exposed to renderer code.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Volume2 size={14} color="var(--cyan-primary)" />
              <span>Voice Synthesis & Audio</span>
            </label>
            <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={formData.speechEnabled}
                  onChange={(e) => setFormData({ ...formData, speechEnabled: e.target.checked })}
                />
                <span>Enable Speech Output</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={formData.soundEffects}
                  onChange={(e) => setFormData({ ...formData, soundEffects: e.target.checked })}
                />
                <span>HUD Sound Effects</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" className="hud-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="hud-btn hud-btn-primary">
              <Save size={14} />
              <span>Save Preferences</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
