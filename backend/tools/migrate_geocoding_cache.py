#!/usr/bin/env python3
"""
Script para migrar el caché de geocodificación de la base de datos principal
a la base de datos de geocodificación separada.
"""

import sqlite3
import os
import logging
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GeocodingCacheMigrator:
    def __init__(self, main_db_path=None, geocoding_db_path=None):
        # Default paths
        self.main_db_path = main_db_path or "/root/dashcam-v2/data/recordings.db"
        self.geocoding_db_path = geocoding_db_path or "/root/dashcam-v2/data/geocoding_offline.db"
        
    def check_geocoding_table_exists(self, db_path):
        """Check if geocoding_cache table exists in the database"""
        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='geocoding_cache'
                """)
                return cursor.fetchone() is not None
        except Exception as e:
            logger.error(f"Error checking table existence in {db_path}: {e}")
            return False
    
    def get_geocoding_cache_count(self, db_path):
        """Get count of records in geocoding_cache table"""
        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM geocoding_cache")
                return cursor.fetchone()[0]
        except Exception as e:
            logger.error(f"Error counting geocoding cache records in {db_path}: {e}")
            return 0
    
    def migrate_geocoding_cache(self):
        """Migrate geocoding cache from main database to geocoding database"""
        logger.info("Starting geocoding cache migration...")
        
        # Check if main database exists and has geocoding_cache table
        if not os.path.exists(self.main_db_path):
            logger.warning(f"Main database not found: {self.main_db_path}")
            return False
            
        if not self.check_geocoding_table_exists(self.main_db_path):
            logger.info("No geocoding_cache table found in main database. Nothing to migrate.")
            return True
        
        main_cache_count = self.get_geocoding_cache_count(self.main_db_path)
        logger.info(f"Found {main_cache_count} geocoding cache records in main database")
        
        if main_cache_count == 0:
            logger.info("No geocoding cache records to migrate")
            return True
        
        # Ensure geocoding database directory exists
        os.makedirs(os.path.dirname(self.geocoding_db_path), exist_ok=True)
        
        try:
            # Read data from main database
            with sqlite3.connect(self.main_db_path) as main_conn:
                main_cursor = main_conn.cursor()
                main_cursor.execute("""
                    SELECT lat, lon, location_info, timestamp, source 
                    FROM geocoding_cache
                """)
                cache_records = main_cursor.fetchall()
            
            # Write data to geocoding database
            with sqlite3.connect(self.geocoding_db_path) as geo_conn:
                geo_cursor = geo_conn.cursor()
                
                # Create table if it doesn't exist
                geo_cursor.execute('''
                    CREATE TABLE IF NOT EXISTS geocoding_cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        lat REAL NOT NULL,
                        lon REAL NOT NULL,
                        location_info TEXT NOT NULL,
                        timestamp TIMESTAMP NOT NULL,
                        source TEXT NOT NULL DEFAULT 'nominatim'
                    )
                ''')
                
                # Create index for performance
                geo_cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_geocoding_coords 
                    ON geocoding_cache (lat, lon)
                ''')
                
                # Insert records (use INSERT OR IGNORE to avoid duplicates)
                migrated_count = 0
                for record in cache_records:
                    try:
                        geo_cursor.execute("""
                            INSERT OR IGNORE INTO geocoding_cache 
                            (lat, lon, location_info, timestamp, source)
                            VALUES (?, ?, ?, ?, ?)
                        """, record)
                        if geo_cursor.rowcount > 0:
                            migrated_count += 1
                    except Exception as e:
                        logger.error(f"Error inserting record: {e}")
                        continue
                
                geo_conn.commit()
                logger.info(f"Successfully migrated {migrated_count} geocoding cache records")
                
                # Verify migration
                geo_cache_count = self.get_geocoding_cache_count(self.geocoding_db_path)
                logger.info(f"Geocoding database now contains {geo_cache_count} records")
                
                return True
                
        except Exception as e:
            logger.error(f"Error during migration: {e}")
            return False
    
    def cleanup_main_database(self):
        """Remove geocoding_cache table from main database after successful migration"""
        logger.info("Cleaning up geocoding_cache table from main database...")
        
        try:
            with sqlite3.connect(self.main_db_path) as conn:
                cursor = conn.cursor()
                
                # Drop the geocoding_cache table
                cursor.execute("DROP TABLE IF EXISTS geocoding_cache")
                conn.commit()
                
                logger.info("Successfully removed geocoding_cache table from main database")
                return True
                
        except Exception as e:
            logger.error(f"Error cleaning up main database: {e}")
            return False
    
    def run_migration(self, cleanup_main=False):
        """Run the complete migration process"""
        logger.info("=== Geocoding Cache Migration ===")
        logger.info(f"Source (main database): {self.main_db_path}")
        logger.info(f"Target (geocoding database): {self.geocoding_db_path}")
        
        # Step 1: Migrate data
        if not self.migrate_geocoding_cache():
            logger.error("Migration failed!")
            return False
        
        # Step 2: Cleanup main database if requested
        if cleanup_main:
            if not self.cleanup_main_database():
                logger.error("Migration succeeded but cleanup failed!")
                return False
        
        logger.info("=== Migration completed successfully ===")
        return True

def main():
    """Main function"""
    # Check if cleanup flag is provided
    cleanup_main = '--cleanup' in sys.argv
    
    if cleanup_main:
        logger.info("Will cleanup main database after migration")
    else:
        logger.info("Will keep geocoding_cache table in main database (use --cleanup to remove)")
    
    migrator = GeocodingCacheMigrator()
    success = migrator.run_migration(cleanup_main=cleanup_main)
    
    if not success:
        sys.exit(1)
    
    logger.info("Migration completed!")

if __name__ == "__main__":
    main()
