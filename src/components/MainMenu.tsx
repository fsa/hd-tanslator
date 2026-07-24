import { Container, Row, Col, Card } from 'react-bootstrap';

export default function MainMenu() {
  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={6} lg={4}>
          <h2 className="text-center mb-4">Text Translator</h2>
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
