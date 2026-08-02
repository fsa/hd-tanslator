import { useState, useEffect } from 'react';
import { Container, Button, Alert, Spinner, Form, Card } from 'react-bootstrap';

interface ProviderInfo {
  id: string;
  name: string;
}

interface PromptData {
  provider: string;
  current: string;
  default: string;
  user_instructions: string;
  model: string | null;
  base_url: string | null;
}

export default function TranslatorSettings() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      fetchPrompt(selectedProvider);
    }
  }, [selectedProvider]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/translators');
      const data = await response.json();
      setProviders(data.providers || []);
      if (data.providers?.length > 0) {
        setSelectedProvider(data.providers[0].id);
      }
    } catch (err) {
      setError('Failed to load translators');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrompt = async (providerId: string) => {
    setLoadingPrompt(true);
    setError(null);
    try {
      const response = await fetch(`/api/translators/${providerId}/prompt`);
      const data = await response.json();
      setPromptData(data);
      setEditPrompt(data.current || data.default || '');
      setEditInstructions(data.user_instructions || '');
      setEditModel(data.model || '');
      setEditBaseUrl(data.base_url || '');
    } catch (err) {
      setError('Failed to load prompt');
    } finally {
      setLoadingPrompt(false);
    }
  };

  const handleSavePrompt = async () => {
    if (!selectedProvider) return;
    setSaving('prompt');
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/translators/${selectedProvider}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_prompt', value: editPrompt })
      });
      if (response.ok) {
        setSuccess('System prompt saved');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to save prompt');
      }
    } catch (err) {
      setError('Failed to save prompt');
    } finally {
      setSaving(null);
    }
  };

  const handleResetPrompt = async () => {
    if (!selectedProvider || !promptData) return;
    setSaving('prompt');
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/translators/${selectedProvider}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_prompt' })
      });
      if (response.ok) {
        setEditPrompt(promptData.default);
        setSuccess('System prompt reset to default');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to reset prompt');
      }
    } catch (err) {
      setError('Failed to reset prompt');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveInstructions = async () => {
    if (!selectedProvider) return;
    setSaving('instructions');
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/translators/${selectedProvider}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_instructions', value: editInstructions })
      });
      if (response.ok) {
        setSuccess('User instructions saved');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to save instructions');
      }
    } catch (err) {
      setError('Failed to save instructions');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveModel = async () => {
    if (!selectedProvider) return;
    setSaving('model');
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/translators/${selectedProvider}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_model', value: editModel })
      });
      if (response.ok) {
        setSuccess('Model saved');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to save model');
      }
    } catch (err) {
      setError('Failed to save model');
    } finally {
      setSaving(null);
    }
  };

  const handleResetModel = async () => {
    if (!selectedProvider) return;
    setSaving('model');
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/translators/${selectedProvider}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_model' })
      });
      if (response.ok) {
        setEditModel('');
        setSuccess('Model reset to default');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to reset model');
      }
    } catch (err) {
      setError('Failed to reset model');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveBaseUrl = async () => {
    if (!selectedProvider) return;
    setSaving('base_url');
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/translators/${selectedProvider}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_base_url', value: editBaseUrl })
      });
      if (response.ok) {
        setSuccess('Base URL saved');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to save base URL');
      }
    } catch (err) {
      setError('Failed to save base URL');
    } finally {
      setSaving(null);
    }
  };

  const handleResetBaseUrl = async () => {
    if (!selectedProvider) return;
    setSaving('base_url');
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/translators/${selectedProvider}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_base_url' })
      });
      if (response.ok) {
        setEditBaseUrl('');
        setSuccess('Base URL reset to default');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to reset base URL');
      }
    } catch (err) {
      setError('Failed to reset base URL');
    } finally {
      setSaving(null);
    }
  };

  const handleResetInstructions = async () => {
    if (!selectedProvider) return;
    setSaving('instructions');
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/translators/${selectedProvider}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_instructions' })
      });
      if (response.ok) {
        setEditInstructions('');
        setSuccess('User instructions cleared');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to reset instructions');
      }
    } catch (err) {
      setError('Failed to reset instructions');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </div>
    );
  }

  const hasPromptOverride = promptData && promptData.current !== promptData.default;
  const isOllama = selectedProvider === 'ollama';

  return (
    <Container className="py-4">
      <div className="d-flex align-items-center mb-3">
        <a href="/" className="btn btn-outline-secondary btn-sm me-3">&larr; Menu</a>
        <h3 className="mb-0">Auto-Translators</h3>
      </div>
      <hr />

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Provider selector */}
      <Form.Group className="mb-4">
        <Form.Label className="fw-bold">Translator Provider</Form.Label>
        <Form.Select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
        >
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Form.Select>
      </Form.Group>

      {loadingPrompt ? (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" />
        </div>
      ) : selectedProvider && promptData ? (
        <>
          {/* System Prompt */}
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>System Prompt</Card.Title>
              <Card.Text className="text-muted small mb-3">
                This prompt is sent to the AI model before each translation request.
                The default is loaded from <code>prompts/system-default.txt</code> (project root).
                Edit below to customize it for this provider. The file itself is never modified.
              </Card.Text>
              <Form.Group className="mb-3">
                <Form.Control
                  as="textarea"
                  rows={15}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="font-monospace small"
                  style={{ fontSize: '0.85rem' }}
                />
              </Form.Group>
              <div className="d-flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleSavePrompt}
                  disabled={saving === 'prompt'}
                >
                  {saving === 'prompt' ? <Spinner animation="border" size="sm" /> : 'Save Prompt'}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleResetPrompt}
                  disabled={saving === 'prompt' || !hasPromptOverride}
                >
                  Reset to Default
                </Button>
              </div>
              {hasPromptOverride && (
                <Form.Text className="text-warning mt-2 d-block">
                  Custom prompt override is active
                </Form.Text>
              )}
            </Card.Body>
          </Card>

          {/* Model Selection */}
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Model</Card.Title>
              <Card.Text className="text-muted small mb-3">
                {isOllama ? (
                  <>The AI model to use for translations. Default is <code>llama3</code>.
                  You can set any model available in your Ollama instance (e.g. <code>llama3.1</code>, <code>mistral</code>, <code>qwen2.5</code>).</>
                ) : (
                  <>The AI model to use for translations. Default is <code>openrouter/free</code>.
                  You can set any model ID supported by OpenRouter (e.g. <code>openai/gpt-4o-mini</code>, <code>anthropic/claude-3-haiku</code>).</>
                )}
              </Card.Text>
              <Form.Group className="mb-3">
                <Form.Control
                  type="text"
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  placeholder={isOllama ? 'llama3' : 'openrouter/free'}
                />
              </Form.Group>
              <div className="d-flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleSaveModel}
                  disabled={saving === 'model'}
                >
                  {saving === 'model' ? <Spinner animation="border" size="sm" /> : 'Save Model'}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleResetModel}
                  disabled={saving === 'model' || !editModel}
                >
                  Reset to Default
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Base URL (shown for Ollama) */}
          {isOllama && (
            <Card className="mb-4">
              <Card.Body>
                <Card.Title>Base URL</Card.Title>
                <Card.Text className="text-muted small mb-3">
                  The URL of your Ollama instance. Default is <code>http://localhost:11434</code>.
                  For a remote instance, use the full URL (e.g. <code>http://192.168.1.100:11434</code>).
                </Card.Text>
                <Form.Group className="mb-3">
                  <Form.Control
                    type="text"
                    value={editBaseUrl}
                    onChange={(e) => setEditBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                </Form.Group>
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    onClick={handleSaveBaseUrl}
                    disabled={saving === 'base_url'}
                  >
                    {saving === 'base_url' ? <Spinner animation="border" size="sm" /> : 'Save Base URL'}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={handleResetBaseUrl}
                    disabled={saving === 'base_url' || !editBaseUrl}
                  >
                    Reset to Default
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* User Instructions */}
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>User Instructions</Card.Title>
              <Card.Text className="text-muted small mb-3">
                Additional instructions that will be appended to every translation prompt.
                Use this to specify preferences like formality level, terminology, or style.
                These instructions are inserted at the <code>{'{userInstructions}'}</code> placeholder
                in the system prompt.
              </Card.Text>
              <Form.Group className="mb-3">
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="e.g. Use formal language. Keep honorifics untranslated."
                />
              </Form.Group>
              <div className="d-flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleSaveInstructions}
                  disabled={saving === 'instructions'}
                >
                  {saving === 'instructions' ? <Spinner animation="border" size="sm" /> : 'Save Instructions'}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleResetInstructions}
                  disabled={saving === 'instructions' || !editInstructions}
                >
                  Clear
                </Button>
              </div>
            </Card.Body>
          </Card>
        </>
      ) : null}
    </Container>
  );
}