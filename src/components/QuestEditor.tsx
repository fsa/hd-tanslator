import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, ButtonGroup, Badge, Spinner, Modal, ListGroup, Form } from 'react-bootstrap';
import CodeEditor from './CodeEditor';
import TranslationEditor from './TranslationEditor';

interface QuestFile {
  id: number;
  name: string;
  file_id: string;
  original_filename: string;
  translation_filename: string | null;
  has_translation: boolean;
  approved: boolean;
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
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);

  // Unsaved changes confirmation state
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmContext, setConfirmContext] = useState<'navigate' | 'paste'>('navigate');
  const pendingActionRef = useRef<(() => void) | null>(null);

  // File list modal state
  const [showFileList, setShowFileList] = useState(false);

  // Hide-diff toggle (persisted in localStorage)
  const [hideDiff, setHideDiff] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('questEditor_hideDiff') === 'true';
    }
    return false;
  });

  const hasUnsavedChanges = translationContent !== savedTranslation;

  // ---- beforeunload handler: browser close / refresh / external nav ----
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // ---- helper: guard navigation with confirmation ----
  const guardNav = useCallback((action: () => void) => {
    if (hasUnsavedChanges) {
      pendingActionRef.current = action;
      setConfirmContext('navigate');
      setShowConfirm(true);
    } else {
      action();
    }
  }, [hasUnsavedChanges]);

  const confirmDiscard = useCallback(() => {
    setShowConfirm(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

  const cancelNav = useCallback(() => {
    setShowConfirm(false);
    pendingActionRef.current = null;
  }, []);

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
      const [origResponse, transResponse, metadataResponse] = await Promise.all([
        fetch(`/api/files/${fileName}/orig`),
        fetch(`/api/files/${fileName}/trans`),
        fetch(`/api/files/${fileName}/metadata`)
      ]);

      if (origResponse.ok) {
        setOriginalContent(await origResponse.text());
      } else {
        setOriginalContent('');
      }

      if (transResponse.ok) {
        const text = await transResponse.text();
        const isMissing = transResponse.headers.get('X-Translation-Status') === 'missing';

        if (isMissing) {
          // No translation file yet — use original as starting point for diff
          setTranslationContent(text);
          setSavedTranslation(text);
        } else {
          // Existing translation
          setTranslationContent(text);
          setSavedTranslation(text);
        }
      } else {
        setTranslationContent('');
        setSavedTranslation('');
      }

      // Load metadata
      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json();
        setApproved(metadata.approved);
      } else {
        setApproved(false);
      }
    } catch (err) {
      console.error('Failed to load content:', err);
      setError('Failed to load file content');
    } finally {
      setContentLoading(false);
    }
  };

  const goToFile = useCallback((index: number) => {
    setShowFileList(false);
    if (index === currentIndex) return;
    guardNav(() => setCurrentIndex(index));
  }, [currentIndex, guardNav]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      guardNav(() => setCurrentIndex(currentIndex - 1));
    }
  }, [currentIndex, guardNav]);

  const goNext = useCallback(() => {
    if (currentIndex < files.length - 1) {
      guardNav(() => setCurrentIndex(currentIndex + 1));
    }
  }, [currentIndex, files.length, guardNav]);

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
        // Update savedTranslation so diff shows changes from this point
        setSavedTranslation(translationContent);
        setFiles(prev => prev.map((f, i) =>
          i === currentIndex ? { ...f, has_translation: true, translation_filename: `${f.name}.txt` } : f
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
    if (hasUnsavedChanges) {
      // Show confirmation before overwriting unsaved changes
      pendingActionRef.current = async () => {
        const text = await navigator.clipboard.readText();
        setTranslationContent(text);
      };
      setConfirmContext('paste');
      setShowConfirm(true);
    } else {
      const text = await navigator.clipboard.readText();
      setTranslationContent(text);
    }
  };

  const handleToggleApproved = async () => {
    if (files.length === 0) return;
    const currentFile = files[currentIndex];
    const newApproved = !approved;

    setApproving(true);

    // Save first if there are unsaved changes
    if (hasUnsavedChanges) {
      try {
        const saveResponse = await fetch(`/api/files/${currentFile.name}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: translationContent })
        });
        if (saveResponse.ok) {
          setSavedTranslation(translationContent);
          setFiles(prev => prev.map((f, i) =>
            i === currentIndex ? { ...f, has_translation: true, translation_filename: `${f.name}.txt` } : f
          ));
        } else {
          setError('Failed to save before approving');
          setApproving(false);
          return;
        }
      } catch (err) {
        setError('Failed to save before approving');
        setApproving(false);
        return;
      }
    }

    try {
      const response = await fetch(`/api/files/${currentFile.name}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: newApproved })
      });

      if (response.ok) {
        setApproved(newApproved);
        // Also update the files list so the modal reflects the change
        setFiles(prev => prev.map((f, i) =>
          i === currentIndex ? { ...f, approved: newApproved } : f
        ));
      } else {
        setError('Failed to update approval status');
      }
    } catch (err) {
      setError('Failed to update approval status');
    } finally {
      setApproving(false);
    }
  };

  const handleQuestsClick = useCallback((e: React.MouseEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      guardNav(() => { window.location.href = '/quests'; });
    }
    // If no unsaved changes, let the <a> navigate normally
  }, [hasUnsavedChanges, guardNav]);

  // ---- Ctrl+S / Cmd+S keyboard shortcut ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  // ---- Hide-diff toggle handler ----
  const handleToggleHideDiff = useCallback(() => {
    setHideDiff(prev => {
      const next = !prev;
      localStorage.setItem('questEditor_hideDiff', String(next));
      return next;
    });
  }, []);

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
          <a
            href="/quests"
            className="btn btn-outline-secondary btn-sm"
            onClick={handleQuestsClick}
          >
            &larr; Quests
          </a>
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
            <Button
              variant="outline-secondary"
              onClick={() => setShowFileList(true)}
            >
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
          <Button variant="outline-secondary" size="sm" onClick={handleRefresh}>
            Refresh
          </Button>
        </div>
      </div>
      {error && (
        <div className="alert alert-danger m-2 py-1" role="alert">
          {error}
          <button type="button" className="btn-close btn-sm float-end" onClick={() => setError(null)} />
        </div>
      )}
      <div className="d-flex flex-grow-1" style={{ minHeight: 0 }}>
        <div className="d-flex flex-column border-end" style={{ flex: '1 1 45%', minWidth: 0 }}>
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
        <div className="d-flex flex-column" style={{ flex: '1 1 55%', minWidth: 0, overflow: 'hidden' }}>
          <div className="p-2 border-bottom bg-light d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <strong>Translation</strong>
              <span className="text-muted" style={{ fontSize: '0.85em' }}>
                {currentFile?.translation_filename || '(not created)'}
              </span>
              <Form.Check
                type="switch"
                id="hide-diff-switch"
                label="diff"
                checked={!hideDiff}
                onChange={handleToggleHideDiff}
                style={{ fontSize: '0.8em' }}
              />
            </div>
            <div className="d-flex align-items-center gap-2">
              <Button
                variant={approved ? 'success' : 'danger'}
                size="sm"
                onClick={handleToggleApproved}
                disabled={approving}
              >
                {approving ? (
                  <Spinner animation="border" size="sm" />
                ) : approved ? (
                  <>&#10003; Approved</>
                ) : (
                  <>&#10007; Unapproved</>
                )}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handlePaste}
              >
                Paste
              </Button>
            </div>
          </div>
          {contentLoading ? (
            <div className="d-flex justify-content-center align-items-center flex-grow-1">
              <Spinner animation="border" size="sm" />
            </div>
          ) : (
            <TranslationEditor
              value={translationContent}
              original={savedTranslation}
              onChange={setTranslationContent}
              className="flex-grow-1"
              style={{ minHeight: '300px' }}
              hideDiff={hideDiff}
            />
          )}
        </div>
      </div>

      {/* Unsaved changes confirmation modal */}
      <Modal show={showConfirm} onHide={cancelNav} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Unsaved changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmContext === 'paste' ? (
            <p>Pasting will overwrite your unsaved changes. What would you like to do?</p>
          ) : (
            <p>You have unsaved changes to the translation. What would you like to do?</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger" onClick={confirmDiscard}>
            {confirmContext === 'paste' ? 'Paste and lose changes' : 'Discard changes'}
          </Button>
          <Button variant="primary" onClick={cancelNav}>
            {confirmContext === 'paste' ? 'Cancel paste' : 'Stay and save'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* File list navigation modal */}
      <Modal show={showFileList} onHide={() => setShowFileList(false)} size="lg" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Quest files — {quest}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <ListGroup variant="flush">
            {files.map((file, index) => (
              <ListGroup.Item
                key={file.name}
                action
                active={index === currentIndex}
                onClick={() => goToFile(index)}
                className="d-flex align-items-center justify-content-between py-2 px-3"
              >
                <div className="d-flex align-items-center gap-2">
                  <span className="text-muted" style={{ minWidth: '2em' }}>{file.file_id}.</span>
                  <span>{file.original_filename}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {file.has_translation ? (
                    <Badge bg="success">translated</Badge>
                  ) : (
                    <Badge bg="secondary">original</Badge>
                  )}
                  {file.approved ? (
                    <Badge bg="success">&#10003; approved</Badge>
                  ) : (
                    <Badge bg="danger">&#10007; unapproved</Badge>
                  )}
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Modal.Body>
      </Modal>
    </div>
  );
}
