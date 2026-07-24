import { useState, useEffect, useMemo } from 'react';
import { Container, Form, Spinner, Badge, Nav } from 'react-bootstrap';

interface QuestItem {
  name: string;
  character: string;
  section: number;
  quest: number;
  file_count: number;
  translated_count: number;
}

export default function QuestList() {
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCharacter, setActiveCharacter] = useState<string | null>(null);

  useEffect(() => {
    fetchQuests();
  }, []);

  const fetchQuests = async (query?: string) => {
    setLoading(true);
    try {
      const url = query ? `/api/quests?q=${encodeURIComponent(query)}` : '/api/quests';
      const response = await fetch(url);
      const data = await response.json();
      setQuests(data.quests || []);
    } catch (err) {
      console.error('Failed to fetch quests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    fetchQuests(q);
  };

  const characters = useMemo(() => {
    const chars = new Set(quests.map(q => q.character));
    return [...Array.from(chars).sort(), 'ALL'];
  }, [quests]);

  const effectiveCharacter = activeCharacter || characters[0] || 'ALL';

  const filteredQuests = useMemo(() => {
    if (effectiveCharacter === 'ALL') return quests;
    return quests.filter(q => q.character === effectiveCharacter);
  }, [quests, effectiveCharacter]);

  const handleOpen = (questName: string) => {
    window.location.href = `/editor/${questName}`;
  };

  return (
    <Container className="py-4">
      <div className="d-flex align-items-center mb-3">
        <a href="/" className="btn btn-outline-secondary btn-sm me-3">&larr; Menu</a>
        <h3 className="mb-0">Quests</h3>
      </div>
      <Form.Control
        type="text"
        placeholder="Search quests..."
        value={searchQuery}
        onChange={handleSearch}
        className="mb-3"
      />
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : quests.length === 0 ? (
        <div className="text-muted text-center py-5">
          No quests found. Try running reindex first.
        </div>
      ) : (
        <>
          <Nav variant="tabs" className="mb-3">
            {characters.map(char => {
              const count = char === 'ALL'
                ? quests.length
                : quests.filter(q => q.character === char).length;
              return (
                <Nav.Item key={char}>
                  <Nav.Link
                    active={effectiveCharacter === char}
                    onClick={() => setActiveCharacter(char)}
                  >
                    {char} <Badge bg="secondary" className="ms-1">{count}</Badge>
                  </Nav.Link>
                </Nav.Item>
              );
            })}
          </Nav>
          <div className="list-group">
            {filteredQuests.map((q) => (
              <button
                key={q.name}
                type="button"
                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                onClick={() => handleOpen(q.name)}
              >
                <span>
                  <strong>{q.character}</strong>
                  <span className="text-muted mx-1">.</span>
                  {q.section}
                  <span className="text-muted mx-1">.</span>
                  {q.quest}
                </span>
                <span>
                  <Badge bg="secondary" className="me-2">
                    {q.translated_count}/{q.file_count}
                  </Badge>
                  <Badge bg={q.translated_count === q.file_count ? 'success' : 'warning'}>
                    {q.translated_count === q.file_count ? 'done' : 'wip'}
                  </Badge>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Container>
  );
}
