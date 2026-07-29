from app.infrastructure.database import initialize_database


def pytest_sessionstart(session):
    initialize_database()
