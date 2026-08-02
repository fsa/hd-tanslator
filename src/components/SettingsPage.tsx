import { useState, useEffect, useRef } from 'react';
import { Container, Button, Alert, Spinner, Form, InputGroup } from 'react-bootstrap';

interface Settings {
  ORIGINALS_DIR: string;
  TRANSLATIONS_DIR: string;
  OPENROUTER_API_KEY: string;
  PROXY_SERVER: string;
  LANG: string;
  AUTHOR: string;
  METADATA_EXPORT_DIR: string;
}

interface DuplicateInfo {
  checksum: string;
  files: string[];
  size: number;
}

interface ReindexResult {
  added: number;
  updated: number;
  removed: number;
  total: number;
  warnings?: string[];
  duplicates?: DuplicateInfo[];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [editValues, setEditValues] = useState<Settings>({ ORIGINALS_DIR: '', TRANSLATIONS_DIR: '', OPENROUTER_API_KEY: '', PROXY_SERVER: '', LANG: '', AUTHOR: '', METADATA_EXPORT_DIR: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<ReindexResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<number | null>(null);
  const [directories, setDirectories] = useState<string[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');
  const [loadingDirs, setLoadingDirs] = useState(false);
  const [browserDownload, setBrowserDownload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      fetchDirectories();
    }
  }, [settings]);

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

  const fetchDirectories = async () => {
    setLoadingDirs(true);
    try {
      const response = await fetch('/api/metadata/directories');
      const data = await response.json();
      setDirectories(data.directories || []);
      setSelectedDirectory(data.current || '');
    } catch (err) {
      console.error('Failed to load directories:', err);
    } finally {
      setLoadingDirs(false);
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

  const handleExportMetadata = async () => {
    if (!selectedDirectory) return;
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        directory: selectedDirectory,
        browser_download: String(browserDownload),
      });
      const response = await fetch(`/api/metadata/export?${params}`);

      if (browserDownload) {
        // Browser download: get the blob and trigger download
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Export failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const datePart = `-${new Date().toISOString().slice(0, 10)}`;
        a.download = `${selectedDirectory}-metadata${datePart}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccess('Metadata exported successfully');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        // Local save: read JSON response
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Export failed');
        }

        const result = await response.json();
        setSuccess(`Metadata exported successfully: ${result.filename} (${result.record_count} records)`);
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export metadata');
    } finally {
      setExporting(false);
    }
  };

  const handleImportMetadata = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch('/api/metadata/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        setImportResult(result.imported);
        setSuccess(`Imported ${result.imported} metadata records`);
        setTimeout(() => setSuccess(null), 3000);
        // Refresh directories after import
        fetchDirectories();
      } else {
        const errData = await response.json();
        setError(errData.error || 'Import failed');
      }
    } catch (err) {
      setError('Failed to import metadata: invalid JSON file');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      {renderSetting('METADATA_EXPORT_DIR', 'Metadata Export Directory')}

      <h5 className="mt-4">Translation Info</h5>
      {renderSetting('LANG', 'Language')}
      {renderSetting('AUTHOR', 'Author')}

      <h5 className="mt-4">API Keys</h5>
      {renderSetting('OPENROUTER_API_KEY', 'OpenRouter API Key', 'password')}

      <h5 className="mt-4">Proxy</h5>
      {renderSetting('PROXY_SERVER', 'Proxy Server')}

      <hr className="my-4" />

      <h5>File Reindex</h5>
      <p className="text-muted">
        Scan the originals and translations directories and update the database index.
        If an original file has changed (different checksum), its translation approval will be reset.
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
        <div className="mt-3">
          <Alert variant="success" className="mb-2">
            Done! Added: {reindexResult.added}, Updated: {reindexResult.updated}, Removed: {reindexResult.removed}. Total: {reindexResult.total}
          </Alert>
          {reindexResult.warnings && reindexResult.warnings.length > 0 && (
            <Alert variant="warning" className="mb-2">
              <strong>Warnings:</strong>
              <ul className="mb-0 mt-1">
                {reindexResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      )}

      <hr className="my-4" />

      <h5>Translation Metadata</h5>
      <p className="text-muted">
        Export or import translation approval metadata. This is useful for backing up
        which translations have been reviewed and approved, or restoring after a database reset.
      </p>

      <Form.Group className="mb-3">
        <Form.Label className="fw-bold">Translation Directory</Form.Label>
        {loadingDirs ? (
          <Spinner animation="border" size="sm" />
        ) : (
          <Form.Select
            value={selectedDirectory}
            onChange={(e) => setSelectedDirectory(e.target.value)}
          >
            {directories.length === 0 && <option value="">No directories available</option>}
            {directories.map(dir => (
              <option key={dir} value={dir}>{dir}</option>
            ))}
          </Form.Select>
        )}
        <Form.Text className="text-muted">
          Select which translation directory to export metadata for.
        </Form.Text>
      </Form.Group>

      <Form.Check
        type="switch"
        id="browser-download-switch"
        label="Download via browser"
        checked={browserDownload}
        onChange={(e) => setBrowserDownload(e.target.checked)}
        className="mb-3"
      />

      <div className="d-flex gap-2">
        <Button
          variant="primary"
          onClick={handleExportMetadata}
          disabled={exporting || !selectedDirectory}
        >
          {exporting ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Exporting...
            </>
          ) : 'Export Metadata'}
        </Button>
        <Button
          variant="outline-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Importing...
            </>
          ) : 'Import Metadata'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportMetadata}
        />
      </div>
      {importResult !== null && (
        <Alert variant="success" className="mt-3">
          Successfully imported {importResult} metadata records.
        </Alert>
      )}
    </Container>
  );
}
