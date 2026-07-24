import { useState, useEffect } from 'react';
import { Container, Button, Alert, Spinner, Form, InputGroup } from 'react-bootstrap';

interface Settings {
  ORIGINALS_DIR: string;
  TRANSLATIONS_DIR: string;
  OPENROUTER_API_KEY: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [editValues, setEditValues] = useState<Settings>({ ORIGINALS_DIR: '', TRANSLATIONS_DIR: '', OPENROUTER_API_KEY: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<{ added: number; updated: number; removed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data.settings);
      setDefaults(data.defaults);
      setEditValues(data.settings);
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: keyof Settings) => {
    setSaving(key);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', key, value: editValues[key] })
      });
      if (response.ok) {
        setSettings(prev => prev ? { ...prev, [key]: editValues[key] } : prev);
        setSuccess(`${key} saved`);
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to save');
      }
    } catch (err) {
      setError('Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (key: keyof Settings) => {
    setSaving(key);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', key })
      });
      if (response.ok) {
        const defaultVal = defaults?.[key] || '';
        setEditValues(prev => ({ ...prev, [key]: defaultVal }));
        setSettings(prev => prev ? { ...prev, [key]: defaultVal } : prev);
        setSuccess(`${key} reset to default`);
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to reset');
      }
    } catch (err) {
      setError('Failed to reset');
    } finally {
      setSaving(null);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setReindexResult(null);
    setError(null);
    try {
      const response = await fetch('/api/reindex', { method: 'POST' });
      const data = await response.json();
      setReindexResult(data);
    } catch (err) {
      setError('Failed to run reindex');
    } finally {
      setReindexing(false);
    }
  };

  const renderSetting = (key: keyof Settings, label: string, type: string = 'text') => {
    const isSaving = saving === key;
    const defaultValue = defaults?.[key] || '';
    const hasOverride = settings?.[key] !== defaults?.[key];

    return (
      <div className="mb-4">
        <Form.Label className="fw-bold">{label}</Form.Label>
        <InputGroup>
          <Form.Control
            type={type}
            value={editValues[key]}
            onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
            placeholder={defaultValue || 'Not set'}
          />
          <Button
            variant="outline-primary"
            onClick={() => handleSave(key)}
            disabled={isSaving || editValues[key] === settings?.[key]}
          >
            {isSaving ? <Spinner animation="border" size="sm" /> : 'Save'}
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => handleReset(key)}
            disabled={isSaving || !hasOverride}
          >
            Reset
          </Button>
        </InputGroup>
        <Form.Text className="text-muted">
          Default: {defaultValue || '(empty)'}
          {hasOverride && <span className="text-warning ms-2">(overridden)</span>}
        </Form.Text>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex align-items-center mb-3">
        <a href="/" className="btn btn-outline-secondary btn-sm me-3">&larr; Menu</a>
        <h3 className="mb-0">Settings</h3>
      </div>
      <hr />

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <h5>File Paths</h5>
      {renderSetting('ORIGINALS_DIR', 'Originals Directory')}
      {renderSetting('TRANSLATIONS_DIR', 'Translations Directory')}

      <h5 className="mt-4">API Keys</h5>
      {renderSetting('OPENROUTER_API_KEY', 'OpenRouter API Key', 'password')}

      <hr className="my-4" />

      <h5>File Reindex</h5>
      <p className="text-muted">
        Scan the originals and translations directories and update the database index.
      </p>
      <Button
        variant="primary"
        onClick={handleReindex}
        disabled={reindexing}
      >
        {reindexing ? (
          <>
            <Spinner animation="border" size="sm" className="me-2" />
            Reindexing...
          </>
        ) : 'Reindex Files'}
      </Button>
      {reindexResult && (
        <Alert variant="success" className="mt-3">
          Done! Added: {reindexResult.added}, Updated: {reindexResult.updated}, Removed: {reindexResult.removed}. Total: {reindexResult.total}
        </Alert>
      )}
    </Container>
  );
}
