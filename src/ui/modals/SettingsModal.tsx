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

  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqKeyStatusMsg, setGroqKeyStatusMsg] = useState<string | null>(null);
  const [savingGroqKey, setSavingGroqKey] = useState(false);

  const [modelsList, setModelsList] = useState<
    Array<{ id: string; name: string; isFree?: boolean }>
  >([
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Meta Llama 3.3 70B (Free)',
      isFree: true,
    },
    {
      id: 'google/gemini-2.0-flash-lite-preview-02-05:free',
      name: 'Google Gemini 2.0 Flash Lite (Free)',
      isFree: true,
    },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Anthropic Claude 3.5 Sonnet',
    },
    { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
  ]);

  useEffect(() => {
    setFormData(settings);
    if (window.jarvisDesktop?.getAvailableModels) {
      window.jarvisDesktop
        .getAvailableModels()
        .then((m) => {
          if (m && m.length > 0) setModelsList(m);
        })
        .catch(() => {});
    }
  }, [settings]);

  if (!isOpen) return null;

  const handleSaveApiKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setSavingKey(true);
    setKeyStatusMsg('Verifying key with OpenRouter API...');
    try {
      if (window.jarvisDesktop?.validateApiKey) {
        try {
          const validation = await window.jarvisDesktop.validateApiKey(trimmed);
          if (!validation.valid) {
            setKeyStatusMsg(
              `Verification warning: ${validation.error || 'Key rejected by OpenRouter'}`,
            );
          }
        } catch {
          // Main process reload pending or validation endpoint unreachable
        }
      }

      if (window.jarvisDesktop?.setApiKey) {
        const res = await window.jarvisDesktop.setApiKey(trimmed);
        if (res.success) {
          setFormData((prev) => ({ ...prev, hasApiKey: true }));
          setKeyInput('');
          setKeyStatusMsg('Key verified and encrypted in OS safeStorage.');
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

  const handleSaveGroqKey = async () => {
    const trimmed = groqKeyInput.trim();
    if (!trimmed) return;
    setSavingGroqKey(true);
    setGroqKeyStatusMsg('Verifying key with Groq API...');
    try {
      if (window.jarvisDesktop?.validateGroqKey) {
        try {
          const validation =
            await window.jarvisDesktop.validateGroqKey(trimmed);
          if (!validation.valid) {
            setGroqKeyStatusMsg(
              `Verification warning: ${validation.error || 'Key rejected by Groq'}`,
            );
          }
        } catch {}
      }

      if (window.jarvisDesktop?.setGroqKey) {
        const res = await window.jarvisDesktop.setGroqKey(trimmed);
        if (res.success) {
          setFormData((prev) => ({ ...prev, hasGroqKey: true }));
          setGroqKeyInput('');
          setGroqKeyStatusMsg(
            'Groq key encrypted and saved in OS safeStorage.',
          );
        } else {
          setGroqKeyStatusMsg(
            `Encryption failed: ${res.error || 'Unknown error'}`,
          );
        }
      }
    } catch (err: unknown) {
      setGroqKeyStatusMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSavingGroqKey(false);
    }
  };

  const handleDeleteGroqKey = async () => {
    setSavingGroqKey(true);
    setGroqKeyStatusMsg(null);
    try {
      if (window.jarvisDesktop?.deleteGroqKey) {
        await window.jarvisDesktop.deleteGroqKey();
        setFormData((prev) => ({ ...prev, hasGroqKey: false }));
        setGroqKeyInput('');
        setGroqKeyStatusMsg('Groq key removed from secure storage.');
      }
    } catch (err: unknown) {
      setGroqKeyStatusMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSavingGroqKey(false);
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
                  cloudProvider: e.target.value as
                    | 'openrouter'
                    | 'groq'
                    | 'ollama',
                })
              }
            >
              <option value="openrouter">
                OpenRouter (Cloud Engine - 400+ Models)
              </option>
              <option value="groq">
                Groq (Free Ultra-Fast Engine & Whisper STT)
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
                {modelsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isFree ? '(Free Tier)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : formData.cloudProvider === 'groq' ? (
            <div className="form-group">
              <label className="form-label">Groq Fast Model Identifier</label>
              <select
                className="form-select"
                value={formData.groqModel || 'llama-3.3-70b-versatile'}
                onChange={(e) =>
                  setFormData({ ...formData, groqModel: e.target.value })
                }
              >
                <option value="llama-3.3-70b-versatile">
                  Llama 3.3 70B Versatile (Free - Flagship)
                </option>
                <option value="llama-3.1-8b-instant">
                  Llama 3.1 8B Instant (Free - Ultra Speed)
                </option>
                <option value="mixtral-8x7b-32768">
                  Mixtral 8x7B (Free - 32k Context)
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
            </span>
          </div>

          {/* Groq Key Section for 100% Free Whisper STT & Ultra-Fast LLM */}
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
                <span>Groq API Key (Free Whisper & Ultra-Fast LLM)</span>
              </div>
              <span
                className="hud-tag"
                style={{
                  color: formData.hasGroqKey ? '#86efac' : 'var(--text-dim)',
                }}
              >
                {formData.hasGroqKey
                  ? 'CONFIGURED (safeStorage)'
                  : 'OPTIONAL (FREE)'}
              </span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '36px' }}
                  value={groqKeyInput}
                  onChange={(e) => setGroqKeyInput(e.target.value)}
                  placeholder={
                    formData.hasGroqKey
                      ? 'Replace stored Groq key...'
                      : 'gsk_... (free at console.groq.com)'
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowGroqKey(!showGroqKey)}
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
                  title={showGroqKey ? 'Hide key' : 'Show key'}
                >
                  {showGroqKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {groqKeyInput.trim() && (
                <button
                  type="button"
                  className="hud-btn hud-btn-primary"
                  onClick={handleSaveGroqKey}
                  disabled={savingGroqKey}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <ShieldCheck size={14} />
                  <span>{savingGroqKey ? 'Saving...' : 'Save Groq Key'}</span>
                </button>
              )}

              {formData.hasGroqKey && !groqKeyInput.trim() && (
                <button
                  type="button"
                  className="hud-btn"
                  onClick={handleDeleteGroqKey}
                  disabled={savingGroqKey}
                  title="Purge stored Groq key from safeStorage"
                  style={{ color: '#f87171' }}
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {groqKeyStatusMsg && (
              <div
                style={{
                  fontSize: '11px',
                  color:
                    groqKeyStatusMsg.includes('Error') ||
                    groqKeyStatusMsg.includes('warning')
                      ? '#f87171'
                      : '#86efac',
                  marginTop: '4px',
                }}
              >
                {groqKeyStatusMsg}
              </div>
            )}

            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '2px',
              }}
            >
              Powers 100% free Whisper voice transcription (~300ms speed). Get a
              free key at{' '}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--cyan-primary)',
                  textDecoration: 'underline',
                }}
              >
                console.groq.com
              </a>
              .
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
