import { useState, useEffect, useCallback } from 'react';
import { Button, ButtonGroup, Badge, Spinner } from 'react-bootstrap';
import CodeEditor from './CodeEditor';

interface QuestFile {
  id: number;
  name: string;
  file_id: string;
  original_filename: string;
  translation_filename: string | null;
  has_translation: boolean;
}

interface QuestEditorProps {
  quest: string;
}

export default function QuestEditor({ quest }: QuestEditorProps) {
  const [files, setFiles] = useState<QuestFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [originalContent, setOriginalContent] = useState('');
  const [translationContent, setTranslationContent] = useState('');
  const [savedTranslation, setSavedTranslation] = useState('');
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [quest]);

  useEffect(() => {
    if (files.length > 0) {
      loadContent(files[currentIndex].name);
    }
  }, [currentIndex, files]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/quests/${quest}/files`);
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error('Failed to fetch quest files:', err);
      setError('Failed to load quest files');
    } finally {
      setLoading(false);
    }
  };

  const loadContent = async (fileName: string) => {
    setContentLoading(true);
    setError(null);
    try {
      const [origResponse, transResponse] = await Promise.all([
        fetch(`/api/files/${fileName}/orig`),
        fetch(`/api/files/${fileName}/trans`)
      ]);

      if (origResponse.ok) {
        setOriginalContent(await origResponse.text());
      } else {
        setOriginalContent('');
      }

      if (transResponse.ok) {
        const text = await transResponse.text();
        setTranslationContent(text);
        setSavedTranslation(text);
      } else {
        setTranslationContent('');
        setSavedTranslation('');
      }
    } catch (err) {
      console.error('Failed to load content:', err);
      setError('Failed to load file content');
    } finally {
      setContentLoading(false);
    }
  };

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, files.length]);

  const handleSave = useCallback(async () => {
    if (files.length === 0) return;
    const currentFile = files[currentIndex];

    setSaveStatus('saving');
    try {
      const response = await fetch(`/api/files/${currentFile.name}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: translationContent })
      });

      if (response.ok) {
        setSaveStatus('saved');
        setFiles(prev => prev.map((f, i) =>
          i === currentIndex ? { ...f, has_translation: true } : f
        ));
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setError('Failed to save');
      }
    } catch (err) {
      setSaveStatus('error');
      setError('Failed to save');
    }
  }, [files, currentIndex, translationContent]);

  const handleRefresh = () => {
    if (files.length === 0) return;
    loadContent(files[currentIndex].name);
  };

  const handleCopyOriginal = async () => {
    await navigator.clipboard.writeText(originalContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    setTranslationContent(text);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </div>
    );
  }

  const currentFile = files[currentIndex];

  return (
    <div className="d-flex flex-column" style={{ height: '100vh' }}>
      <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom bg-light">
        <div className="d-flex align-items-center gap-2">
          <a href="/quests" className="btn btn-outline-secondary btn-sm">&larr; Quests</a>
          <h5 className="mb-0">{quest}</h5>
        </div>
        <div className="d-flex align-items-center gap-2">
          <ButtonGroup size="sm">
            <Button
              variant="outline-secondary"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              &larr; Prev
            </Button>
            <Button variant="outline-secondary" disabled>
              {currentIndex + 1} / {files.length}
            </Button>
            <Button
              variant="outline-secondary"
              onClick={goNext}
              disabled={currentIndex >= files.length - 1}
            >
              Next &rarr;
            </Button>
          </ButtonGroup>
          {currentFile && (
            <Badge bg={currentFile.has_translation ? 'success' : 'secondary'}>
              {currentFile.has_translation ? 'translated' : 'original'}
            </Badge>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          <ButtonGroup size="sm">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline-secondary" onClick={handleRefresh}>
              Refresh
            </Button>
          </ButtonGroup>
          {saveStatus === 'saved' && <Badge bg="success">Saved</Badge>}
        </div>
      </div>
      {error && (
        <div className="alert alert-danger m-2 py-1" role="alert">
          {error}
          <button type="button" className="btn-close btn-sm float-end" onClick={() => setError(null)} />
        </div>
      )}
      <div className="d-flex flex-grow-1" style={{ minHeight: 0 }}>
        <div className="d-flex flex-column border-end" style={{ flex: '1 1 50%', minWidth: 0 }}>
          <div className="p-2 border-bottom bg-light d-flex justify-content-between align-items-center">
            <div>
              <strong>Original</strong>
              <span className="text-muted ms-2" style={{ fontSize: '0.85em' }}>
                {currentFile?.original_filename}
              </span>
            </div>
            <Button variant="outline-secondary" size="sm" onClick={handleCopyOriginal}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          {contentLoading ? (
            <div className="d-flex justify-content-center align-items-center flex-grow-1">
              <Spinner animation="border" size="sm" />
            </div>
          ) : (
            <CodeEditor
              value={originalContent || 'No content'}
              onChange={() => {}}
              readOnly
              className="flex-grow-1"
              style={{ flex: 1 }}
            />
          )}
        </div>
        <div className="d-flex flex-column" style={{ flex: '1 1 50%', minWidth: 0, overflow: 'hidden' }}>
          <div className="p-2 border-bottom bg-light d-flex justify-content-between align-items-center">
            <div>
              <strong>Translation</strong>
              <span className="text-muted ms-2" style={{ fontSize: '0.85em' }}>
                {currentFile?.translation_filename || '(not created)'}
              </span>
            </div>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handlePaste}
            >
              Paste
            </Button>
          </div>
          {contentLoading ? (
            <div className="d-flex justify-content-center align-items-center flex-grow-1">
              <Spinner animation="border" size="sm" />
            </div>
          ) : (
            <CodeEditor
              value={translationContent}
              original={savedTranslation}
              onChange={setTranslationContent}
              placeholder="Type translation here..."
              className="flex-grow-1"
              style={{ minHeight: '300px' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
