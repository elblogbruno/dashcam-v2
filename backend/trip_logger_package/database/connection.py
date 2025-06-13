"""
Database connection and session management
"""

import os
import logging
from typing import Generator
from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager

from ..models.db_models import Base, create_all_tables

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database connections and sessions"""
    
    def __init__(self, db_path: str = None):
        """Initialize database manager
        
        Args:
            db_path: Path to SQLite database file
        """
        # Set database path - prioritize explicit path, then env var, then fallback to default
        self.db_path = db_path or os.environ.get('DASHCAM_DB_PATH') or os.path.join(
            os.environ.get('DASHCAM_DATA_PATH', os.path.join(os.path.dirname(__file__), '../../data')), 
            'recordings.db'
        )
        
        # Ensure directory exists (skip for in-memory databases)
        if self.db_path != ':memory:':
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # Create SQLAlchemy engine
        self.engine = self._create_engine()
        
        # Create session factory
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Initialize database
        self._init_database()
        
    def _create_engine(self) -> Engine:
        """Create SQLAlchemy engine"""
        try:
            # SQLite connection string
            database_url = f"sqlite:///{self.db_path}"
            
            # Engine configuration for SQLite
            engine = create_engine(
                database_url,
                poolclass=StaticPool,
                connect_args={
                    "check_same_thread": False,  # SQLite specific
                    "timeout": 10  # 10 second timeout
                },
                echo=False  # Set to True for SQL query logging
            )
            
            logger.info(f"Database engine created for: {self.db_path}")
            return engine
            
        except Exception as e:
            logger.error(f"Error creating database engine: {str(e)}")
            raise
    
    def _init_database(self):
        """Initialize database tables"""
        try:
            create_all_tables(self.engine)
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}")
            raise
    
    def get_session(self) -> Session:
        """Get a new database session"""
        return self.SessionLocal()
    
    @contextmanager
    def session_scope(self) -> Generator[Session, None, None]:
        """Provide a transactional scope around a series of operations"""
        session = self.get_session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {str(e)}")
            raise
        finally:
            session.close()
    
    def test_connection(self) -> bool:
        """Test database connection"""
        try:
            with self.session_scope() as session:
                # Simple query to test connection
                session.execute("SELECT 1")
                logger.info("Database connection test successful")
                return True
        except Exception as e:
            logger.error(f"Database connection test failed: {str(e)}")
            return False
    
    def close(self):
        """Close database connections"""
        try:
            self.engine.dispose()
            logger.info("Database connections closed")
        except Exception as e:
            logger.error(f"Error closing database connections: {str(e)}")


# Global database manager instance
_db_manager: DatabaseManager = None


def get_database_manager(db_path: str = None) -> DatabaseManager:
    """Get the global database manager instance"""
    global _db_manager
    
    if _db_manager is None:
        _db_manager = DatabaseManager(db_path)
    
    return _db_manager


def get_db_session() -> Generator[Session, None, None]:
    """Dependency for FastAPI to get database session"""
    db_manager = get_database_manager()
    with db_manager.session_scope() as session:
        yield session


def init_database(db_path: str = None):
    """Initialize the database (for use in main.py)"""
    db_manager = get_database_manager(db_path)
    return db_manager
