import { Container, Row, Col, Card } from 'react-bootstrap';
import { useState, useEffect } from 'react';

interface Stats {
  total_files: number;
  translated_files: number;
  approved_files: number;
  total_quests: number;
  ready_quests: number;
}

export default function MainMenu() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const translatedPct = stats && stats.total_files > 0 ? Math.round((stats.translated_files / stats.total_files) * 100) : 0;
  const approvedPct = stats && stats.total_files > 0 ? Math.round((stats.approved_files / stats.total_files) * 100) : 0;
  const readyPct = stats && stats.total_quests > 0 ? Math.round((stats.ready_quests / stats.total_quests) * 100) : 0;

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <h2 className="text-center mb-4">Text Translator</h2>

          {/* Statistics Card */}
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <Card.Title className="mb-3">
                <span className="me-2">&#128202;</span>
                Translation Statistics
              </Card.Title>
              {loading ? (
                <p className="text-muted mb-0">Loading statistics...</p>
              ) : stats ? (
                <>
                  {/* Files summary row */}
                  <h6 className="text-muted mb-2">Files</h6>
                  <Row className="text-center mb-3 g-2">
                    <Col xs={4}>
                      <div className="fs-3 fw-bold text-primary">{stats.total_files}</div>
                      <div className="small text-muted">Total</div>
                    </Col>
                    <Col xs={4}>
                      <div className="fs-3 fw-bold text-success">{stats.translated_files}</div>
                      <div className="small text-muted">Translated</div>
                    </Col>
                    <Col xs={4}>
                      <div className="fs-3 fw-bold text-warning">{stats.approved_files}</div>
                      <div className="small text-muted">Approved</div>
                    </Col>
                  </Row>

                  {/* File progress bars */}
                  <div className="mb-2">
                    <div className="d-flex justify-content-between small mb-1">
                      <span>Translated</span>
                      <span className="text-success fw-semibold">{translatedPct}%</span>
                    </div>
                    <div className="progress" style={{ height: '20px' }}>
                      <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        style={{ width: `${translatedPct}%` }}
                        aria-valuenow={translatedPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        {translatedPct > 10 ? `${translatedPct}%` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between small mb-1">
                      <span>Approved</span>
                      <span className="text-warning fw-semibold">{approvedPct}%</span>
                    </div>
                    <div className="progress" style={{ height: '20px' }}>
                      <div
                        className="progress-bar bg-warning"
                        role="progressbar"
                        style={{ width: `${approvedPct}%` }}
                        aria-valuenow={approvedPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        {approvedPct > 10 ? `${approvedPct}%` : ''}
                      </div>
                    </div>
                  </div>

                  <hr />

                  {/* Quests summary row */}
                  <h6 className="text-muted mb-2">Quests</h6>
                  <Row className="text-center mb-3 g-2">
                    <Col xs={6}>
                      <div className="fs-3 fw-bold text-primary">{stats.total_quests}</div>
                      <div className="small text-muted">Total</div>
                    </Col>
                    <Col xs={6}>
                      <div className="fs-3 fw-bold text-success">{stats.ready_quests}</div>
                      <div className="small text-muted">Ready</div>
                    </Col>
                  </Row>

                  {/* Quest progress bar */}
                  <div className="mb-2">
                    <div className="d-flex justify-content-between small mb-1">
                      <span>Ready (all files translated & approved)</span>
                      <span className="text-success fw-semibold">{readyPct}%</span>
                    </div>
                    <div className="progress" style={{ height: '20px' }}>
                      <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        style={{ width: `${readyPct}%` }}
                        aria-valuenow={readyPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        {readyPct > 10 ? `${readyPct}%` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Remaining summary */}
                  {stats.total_files > 0 && (
                    <div className="mt-3 small text-muted">
                      {stats.total_quests - stats.ready_quests > 0 ? (
                        <span>{stats.total_quests - stats.ready_quests} quest{stats.total_quests - stats.ready_quests !== 1 ? 's' : ''} remaining to complete</span>
                      ) : (
                        <span className="text-success fw-semibold">All quests completed!</span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted mb-0">No data available. Run reindex first.</p>
              )}
            </Card.Body>
          </Card>

          {/* Navigation cards */}
          <div className="d-grid gap-3">
            <a href="/quests" className="text-decoration-none">
              <Card className="h-100 shadow-sm">
                <Card.Body className="d-flex align-items-center">
                  <div className="me-3 fs-1">&#128214;</div>
                  <div>
                    <Card.Title className="mb-1">Quests</Card.Title>
                    <Card.Text className="text-muted mb-0">
                      View and edit quest translations
                    </Card.Text>
                  </div>
                </Card.Body>
              </Card>
            </a>
            <a href="/translators" className="text-decoration-none">
              <Card className="h-100 shadow-sm">
                <Card.Body className="d-flex align-items-center">
                  <div className="me-3 fs-1">&#129302;</div>
                  <div>
                    <Card.Title className="mb-1">Auto-Translators</Card.Title>
                    <Card.Text className="text-muted mb-0">
                      Configure AI translation providers and prompts
                    </Card.Text>
                  </div>
                </Card.Body>
              </Card>
            </a>
            <a href="/settings" className="text-decoration-none">
              <Card className="h-100 shadow-sm">
                <Card.Body className="d-flex align-items-center">
                  <div className="me-3 fs-1">&#9881;</div>
                  <div>
                    <Card.Title className="mb-1">Settings</Card.Title>
                    <Card.Text className="text-muted mb-0">
                      Reindex files and manage data
                    </Card.Text>
                  </div>
                </Card.Body>
              </Card>
            </a>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
