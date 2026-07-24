import { useState, useEffect, useCallback } from 'react';
import { Button, ButtonGroup, Badge, Spinner } from 'react-bootstrap';

interface QuestFile {
  id: number;
  name: string;
  file_id: string;
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
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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
        setTranslationContent(await transResponse.text());
      } else {
        setTranslationContent('');
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev, goNext]);

  const handleSave = async () => {
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
  };

  const handleDownload = () => {
    if (files.length === 0) return;
    window.open(`/api/files/${files[currentIndex].name}/download`, '_blank');
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
    <div className="d-flex flex-column vh-100">
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
            <Button variant="secondary" onClick={handleDownload}>
              Download
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
      <div className="flex-grow-1 overflow-hidden d-flex">
        <div className="d-flex flex-column border-end overflow-auto" style={{ flex: '1 1 50%', minWidth: 0 }}>
          <div className="p-2 border-bottom bg-light">
            <strong>Original</strong>
          </div>
          {contentLoading ? (
            <div className="d-flex justify-content-center align-items-center flex-grow-1">
              <Spinner animation="border" size="sm" />
            </div>
          ) : (
            <pre
              className="flex-grow-1 overflow-auto p-3 mb-0"
              style={{
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                backgroundColor: '#f8f9fa',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            >
              {originalContent || 'No content'}
            </pre>
          )}
        </div>
        <div className="d-flex flex-column overflow-auto" style={{ flex: '1 1 50%', minWidth: 0 }}>
          <div className="p-2 border-bottom bg-light">
            <strong>Translation</strong>
          </div>
          {contentLoading ? (
            <div className="d-flex justify-content-center align-items-center flex-grow-1">
              <Spinner animation="border" size="sm" />
            </div>
          ) : (
            <textarea
              value={translationContent}
              onChange={(e) => setTranslationContent(e.target.value)}
              className="flex-grow-1 border-0 rounded-0 form-control"
              style={{
                fontFamily: 'monospace',
                resize: 'none',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
