import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Cpu,
  Volume2,
  Save,
  Eye,
  EyeOff,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
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
  const [formData, setFormData] = useState<JarvisSettings>(settings);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatusMsg, setKeyStatusMsg] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleSaveApiKey = async () => {
    if (!keyInput.trim()) return;
    setSavingKey(true);
    setKeyStatusMsg(null);
    try {
      if (window.jarvisDesktop?.setApiKey) {
        const res = await window.jarvisDesktop.setApiKey(keyInput.trim());
        if (res.success) {
          setFormData((prev) => ({ ...prev, hasApiKey: true }));
          setKeyInput('');
          setKeyStatusMsg('Key encrypted and stored via OS safeStorage.');
        } else {
          setKeyStatusMsg(`Encryption failed: ${res.error || 'Unknown error'}`);
        }
      }
    } catch (err: unknown) {
      setKeyStatusMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    setSavingKey(true);
    setKeyStatusMsg(null);
    try {
      if (window.jarvisDesktop?.deleteApiKey) {
        await window.jarvisDesktop.deleteApiKey();
        setFormData((prev) => ({ ...prev, hasApiKey: false }));
        setKeyInput('');
        setKeyStatusMsg('API key removed from secure storage.');
      }
    } catch (err: unknown) {
      setKeyStatusMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSavingKey(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="hud-panel modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">SYSTEM CONFIGURATION // SETTINGS</div>
          <button
            className="hud-btn hud-btn-icon"
            onClick={onClose}
            style={{ width: '28px', height: '28px' }}
          >
            <X size={14} />
          </button>
        </div>

        <form
          onSubmit={handleSave}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div className="form-group">
            <label
              className="form-label"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Cpu size={14} color="var(--cyan-primary)" />
              <span>AI Provider Engine</span>
            </label>
            <select
              className="form-select"
              value={formData.cloudProvider}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cloudProvider: e.target.value as 'openrouter' | 'ollama',
                })
              }
            >
              <option value="openrouter">
                OpenRouter (Cloud Engine - Recommended)
              </option>
              <option value="ollama">
                Ollama (Local Engine - Optional Stage 7)
              </option>
            </select>
          </div>

          {formData.cloudProvider === 'openrouter' ? (
            <div className="form-group">
              <label className="form-label">OpenRouter Primary Model</label>
              <select
                className="form-select"
                value={formData.openRouterModel}
                onChange={(e) =>
                  setFormData({ ...formData, openRouterModel: e.target.value })
                }
              >
                <option value="anthropic/claude-3.5-sonnet">
                  Anthropic Claude 3.5 Sonnet
                </option>
                <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                <option value="meta-llama/llama-3.3-70b-instruct">
                  Meta Llama 3.3 70B Instruct
                </option>
                <option value="google/gemini-2.0-flash">
                  Google Gemini 2.0 Flash
                </option>
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">
                Ollama Local Model Identifier
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.ollamaModel}
                onChange={(e) =>
                  setFormData({ ...formData, ollamaModel: e.target.value })
                }
                placeholder="e.g. llama3.2:3b, mistral:7b"
              />
            </div>
          )}

          <div className="form-group">
            <label
              className="form-label"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Key size={14} color="var(--cyan-primary)" />
                <span>OpenRouter API Key</span>
              </div>
              <span
                className="hud-tag"
                style={{
                  color: formData.hasApiKey
                    ? '#86efac'
                    : 'var(--state-thinking)',
                }}
              >
                {formData.hasApiKey ? 'CONFIGURED (safeStorage)' : 'MOCK MODE'}
              </span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '36px' }}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={
                    formData.hasApiKey
                      ? 'Replace stored API key...'
                      : 'sk-or-v1-...'
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {keyInput.trim() && (
                <button
                  type="button"
                  className="hud-btn hud-btn-primary"
                  onClick={handleSaveApiKey}
                  disabled={savingKey}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <ShieldCheck size={14} />
                  <span>{savingKey ? 'Encrypting...' : 'Save Key'}</span>
                </button>
              )}

              {formData.hasApiKey && !keyInput.trim() && (
                <button
                  type="button"
                  className="hud-btn"
                  onClick={handleDeleteApiKey}
                  disabled={savingKey}
                  title="Purge stored API key from safeStorage"
                  style={{ color: '#f87171' }}
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {keyStatusMsg && (
              <div
                style={{
                  fontSize: '11px',
                  color: keyStatusMsg.includes('Error') ? '#f87171' : '#86efac',
                  marginTop: '4px',
                }}
              >
                {keyStatusMsg}
              </div>
            )}

            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '2px',
              }}
            >
              Encrypted in OS credential store via Electron safeStorage (DPAPI).
              Never accessible in frontend bundles.
            </span>
          </div>

          <div className="form-group">
            <label
              className="form-label"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Volume2 size={14} color="var(--cyan-primary)" />
              <span>Voice Synthesis & Audio</span>
            </label>
            <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.speechEnabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      speechEnabled: e.target.checked,
                    })
                  }
                />
                <span>Enable Speech Output</span>
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.soundEffects}
                  onChange={(e) =>
                    setFormData({ ...formData, soundEffects: e.target.checked })
                  }
                />
                <span>HUD Sound Effects</span>
              </label>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '12px',
            }}
          >
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
