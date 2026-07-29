import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button, ButtonGroup, Badge, Spinner, Modal, ListGroup, Form, Dropdown } from 'react-bootstrap';
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

interface ProviderInfo {
  id: string;
  name: string;
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

  // Auto-translate state
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('openrouter');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [showTranslateModal, setShowTranslateModal] = useState(false);

  // Unsaved changes confirmation state
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmContext, setConfirmContext] = useState<'navigate' | 'paste' | 'translate'>('navigate');
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

  // Render whitespace toggle (persisted in localStorage)
  const [renderWhitespace, setRenderWhitespace] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('questEditor_renderWhitespace') === 'true';
    }
    return false;
  });

  // Hidden textarea ref for paste without browser permission prompt
  const hiddenInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Quest-level stats
  const translatedCount = useMemo(() => files.filter(f => f.has_translation).length, [files]);
  const approvedCount = useMemo(() => files.filter(f => f.approved).length, [files]);

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
    fetchProviders();
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

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/translators');
      const data = await response.json();
      setProviders(data.providers || []);
      if (data.providers?.length > 0) {
        setSelectedProvider(data.providers[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch providers:', err);
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

  // ---- Auto-translate handler ----
  const handleTranslate = useCallback(async () => {
    if (!originalContent) return;

    setTranslating(true);
    setTranslateError(null);
    setShowTranslateModal(true);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalContent,
          provider: selectedProvider,
          sourceLang: 'en',
          targetLang: 'ru',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTranslationContent(data.translated_text);
        setShowTranslateModal(false);
      } else {
        setTranslateError(data.error || 'Translation failed');
      }
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : 'Translation request failed');
    } finally {
      setTranslating(false);
    }
  }, [originalContent, selectedProvider]);

  const guardTranslate = useCallback(() => {
    if (hasUnsavedChanges) {
      pendingActionRef.current = handleTranslate;
      setConfirmContext('translate');
      setShowConfirm(true);
    } else {
      handleTranslate();
    }
  }, [hasUnsavedChanges, handleTranslate]);

  const handleToggleApproved = async () => {
    if (files.length === 0) return;
    const currentFile = files[currentIndex];
    const newApproved = !approved;

    setApproving(true);

    // When unapproving, just remove the mark — don't touch the file or editor
    if (newApproved) {
      // Approving: save first if there are unsaved changes
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

  // ---- Render whitespace toggle handler ----
  const handleToggleRenderWhitespace = useCallback(() => {
    setRenderWhitespace(prev => {
      const next = !prev;
      localStorage.setItem('questEditor_renderWhitespace', String(next));
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
          {files.length > 0 && (
            <>
              <Badge
                bg={translatedCount === files.length ? 'success' : translatedCount === 0 ? 'secondary' : 'primary'}
              >
                {translatedCount === files.length ? 'translated' : `${translatedCount}/${files.length}`}
              </Badge>
              <Badge
                bg={approvedCount === files.length ? 'success' : approvedCount === 0 ? 'danger' : 'warning'}
              >
                {approvedCount === files.length ? 'approved' : approvedCount === 0 ? 'unapproved' : `${approvedCount}/${files.length}`}
              </Badge>
            </>
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
            <div className="d-flex gap-1">
              <Dropdown as={ButtonGroup}>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={guardTranslate}
                  disabled={!originalContent || translating}
                  title="Translate original text and replace translation"
                >
                  {translating ? <Spinner animation="border" size="sm" /> : 'Translate'}
                </Button>
                <Dropdown.Toggle
                  split
                  variant="outline-primary"
                  size="sm"
                  id="translate-dropdown"
                  title="Select translation provider"
                />
                <Dropdown.Menu>
                  {providers.length === 0 ? (
                    <Dropdown.Item disabled>No providers</Dropdown.Item>
                  ) : (
                    providers.map(p => (
                      <Dropdown.Item
                        key={p.id}
                        active={selectedProvider === p.id}
                        onClick={() => setSelectedProvider(p.id)}
                      >
                        {p.name}
                      </Dropdown.Item>
                    ))
                  )}
                </Dropdown.Menu>
              </Dropdown>
              <Button variant="outline-secondary" size="sm" onClick={handleCopyOriginal}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
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
                style={{ fontSize: '0.8em', marginBottom: 0 }}
                className="d-inline-flex align-items-center m-0"
              />
              <Form.Check
                type="switch"
                id="render-whitespace-switch"
                label="&#182;"
                checked={renderWhitespace}
                onChange={handleToggleRenderWhitespace}
                style={{ fontSize: '0.8em', marginBottom: 0 }}
                className="d-inline-flex align-items-center m-0"
                title="Show whitespace characters"
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
              renderWhitespace={renderWhitespace}
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
          {confirmContext === 'paste' && (
            <p>Pasting will overwrite your unsaved changes. What would you like to do?</p>
          )}
          {confirmContext === 'translate' && (
            <p>Auto-translate will overwrite your unsaved changes. What would you like to do?</p>
          )}
          {confirmContext === 'navigate' && (
            <p>You have unsaved changes to the translation. What would you like to do?</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger" onClick={confirmDiscard}>
            {confirmContext === 'paste' && 'Paste and lose changes'}
            {confirmContext === 'translate' && 'Translate and lose changes'}
            {confirmContext === 'navigate' && 'Discard changes'}
          </Button>
          <Button variant="primary" onClick={cancelNav}>
            {confirmContext === 'paste' && 'Cancel paste'}
            {confirmContext === 'translate' && 'Cancel translate'}
            {confirmContext === 'navigate' && 'Stay and save'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Translation status modal */}
      <Modal show={showTranslateModal} onHide={() => { if (!translating) setShowTranslateModal(false); }} centered backdrop="static">
        <Modal.Header closeButton={!translating}>
          <Modal.Title>
            {translating ? 'Translating...' : translateError ? 'Translation failed' : 'Translation complete'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {translating && (
            <div className="text-center py-3">
              <Spinner animation="border" className="mb-3" />
              <p className="mb-0 text-muted">
                Translating via <strong>{providers.find(p => p.id === selectedProvider)?.name || selectedProvider}</strong>...
              </p>
            </div>
          )}
          {!translating && translateError && (
            <div className="py-2">
              <p className="text-danger mb-1">An error occurred during translation:</p>
              <p className="mb-0 font-monospace small bg-light p-2 rounded">{translateError}</p>
            </div>
          )}
        </Modal.Body>
        {!translating && (
          <Modal.Footer>
            <Button variant="primary" onClick={() => setShowTranslateModal(false)}>
              {translateError ? 'Close' : 'OK'}
            </Button>
          </Modal.Footer>
        )}
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
