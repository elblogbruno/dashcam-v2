"""
Migration utilities for converting legacy trip_logger data to new schema
"""

import sqlite3
import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from ..database.connection import get_database_manager
from ..database.repository import (
    TripRepository, GpsRepository, LandmarkRepository, 
    VideoRepository, QualityUpgradeRepository
)
from ..models.db_models import (
    Trip as TripModel, GpsCoordinate as GpsModel, 
    LandmarkEncounter as LandmarkModel, VideoClip as VideoModel,
    ExternalVideo as ExternalVideoModel, QualityUpgrade as QualityModel
)
from ..models.schemas import (
    TripCreateRequest, GpsCoordinateRequest, LandmarkEncounterRequest,
    VideoClipRequest, ExternalVideoRequest, LandmarkType, VideoQuality
)
from ..logging import get_logger

logger = get_logger('migration')


class DataMigrator:
    """Migrates data from legacy trip_logger to new schema"""
    
    def __init__(self, legacy_db_path: str, new_db_path: Optional[str] = None):
        """Initialize migrator
        
        Args:
            legacy_db_path: Path to legacy SQLite database
            new_db_path: Path for new database (optional)
        """
        self.legacy_db_path = legacy_db_path
        self.db_manager = get_database_manager(new_db_path)
        self.migration_stats = {
            'trips': {'migrated': 0, 'failed': 0},
            'gps_coordinates': {'migrated': 0, 'failed': 0},
            'landmark_encounters': {'migrated': 0, 'failed': 0},
            'video_clips': {'migrated': 0, 'failed': 0},
            'external_videos': {'migrated': 0, 'failed': 0},
            'quality_upgrades': {'migrated': 0, 'failed': 0}
        }
    
    def migrate_all_data(self, batch_size: int = 1000) -> Dict[str, Any]:
        """Migrate all data from legacy database
        
        Args:
            batch_size: Number of records to process per batch
            
        Returns:
            Migration statistics
        """
        logger.info("Starting full data migration")
        
        try:
            # Migrate in dependency order
            self.migrate_trips(batch_size)
            self.migrate_gps_coordinates(batch_size)
            self.migrate_landmark_encounters(batch_size)
            self.migrate_video_clips(batch_size)
            self.migrate_external_videos(batch_size)
            self.migrate_quality_upgrades(batch_size)
            
            logger.info("Data migration completed successfully")
            return self.migration_stats
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}")
            raise
    
    def migrate_trips(self, batch_size: int = 1000) -> int:
        """Migrate trips table"""
        logger.info("Migrating trips...")
        
        try:
            legacy_conn = sqlite3.connect(self.legacy_db_path)
            legacy_conn.row_factory = sqlite3.Row
            legacy_cursor = legacy_conn.cursor()
            
            # Get total count
            legacy_cursor.execute("SELECT COUNT(*) FROM trips")
            total_trips = legacy_cursor.fetchone()[0]
            logger.info(f"Found {total_trips} trips to migrate")
            
            # Migrate in batches
            offset = 0
            with self.db_manager.session_scope() as session:
                trip_repo = TripRepository(session)
                
                while offset < total_trips:
                    legacy_cursor.execute("""
                        SELECT * FROM trips 
                        ORDER BY id 
                        LIMIT ? OFFSET ?
                    """, (batch_size, offset))
                    
                    trips = legacy_cursor.fetchall()
                    
                    for legacy_trip in trips:
                        try:
                            # Create new trip model directly
                            new_trip = TripModel(
                                id=legacy_trip['id'],  # Preserve original ID
                                start_time=self._parse_datetime(legacy_trip['start_time']),
                                end_time=self._parse_datetime(legacy_trip['end_time']),
                                start_lat=legacy_trip.get('start_lat'),
                                start_lon=legacy_trip.get('start_lon'),
                                end_lat=legacy_trip.get('end_lat'),
                                end_lon=legacy_trip.get('end_lon'),
                                distance_km=legacy_trip.get('distance_km'),
                                video_files=legacy_trip.get('video_files'),
                                summary_file=legacy_trip.get('summary_file')
                            )
                            
                            session.merge(new_trip)  # Use merge to handle existing IDs
                            self.migration_stats['trips']['migrated'] += 1
                            
                        except Exception as e:
                            logger.error(f"Failed to migrate trip {legacy_trip['id']}: {str(e)}")
                            self.migration_stats['trips']['failed'] += 1
                    
                    offset += batch_size
                    logger.info(f"Migrated {min(offset, total_trips)}/{total_trips} trips")
            
            legacy_conn.close()
            return self.migration_stats['trips']['migrated']
            
        except Exception as e:
            logger.error(f"Error migrating trips: {str(e)}")
            raise
    
    def migrate_gps_coordinates(self, batch_size: int = 1000) -> int:
        """Migrate GPS coordinates table"""
        logger.info("Migrating GPS coordinates...")
        
        try:
            legacy_conn = sqlite3.connect(self.legacy_db_path)
            legacy_conn.row_factory = sqlite3.Row
            legacy_cursor = legacy_conn.cursor()
            
            # Check if table exists
            legacy_cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='gps_coordinates'
            """)
            if not legacy_cursor.fetchone():
                logger.info("No GPS coordinates table found in legacy database")
                return 0
            
            # Get total count
            legacy_cursor.execute("SELECT COUNT(*) FROM gps_coordinates")
            total_coords = legacy_cursor.fetchone()[0]
            logger.info(f"Found {total_coords} GPS coordinates to migrate")
            
            # Migrate in batches
            offset = 0
            with self.db_manager.session_scope() as session:
                while offset < total_coords:
                    legacy_cursor.execute("""
                        SELECT * FROM gps_coordinates 
                        ORDER BY id 
                        LIMIT ? OFFSET ?
                    """, (batch_size, offset))
                    
                    coordinates = legacy_cursor.fetchall()
                    
                    for legacy_coord in coordinates:
                        try:
                            new_coord = GpsModel(
                                id=legacy_coord['id'],
                                trip_id=legacy_coord.get('trip_id'),
                                timestamp=self._parse_datetime(legacy_coord['timestamp']),
                                latitude=legacy_coord['latitude'],
                                longitude=legacy_coord['longitude'],
                                altitude=legacy_coord.get('altitude'),
                                speed=legacy_coord.get('speed'),
                                heading=legacy_coord.get('heading'),
                                satellites=legacy_coord.get('satellites'),
                                fix_quality=legacy_coord.get('fix_quality')
                            )
                            
                            session.merge(new_coord)
                            self.migration_stats['gps_coordinates']['migrated'] += 1
                            
                        except Exception as e:
                            logger.error(f"Failed to migrate GPS coordinate {legacy_coord['id']}: {str(e)}")
                            self.migration_stats['gps_coordinates']['failed'] += 1
                    
                    offset += batch_size
                    logger.info(f"Migrated {min(offset, total_coords)}/{total_coords} GPS coordinates")
            
            legacy_conn.close()
            return self.migration_stats['gps_coordinates']['migrated']
            
        except Exception as e:
            logger.error(f"Error migrating GPS coordinates: {str(e)}")
            raise
    
    def migrate_landmark_encounters(self, batch_size: int = 1000) -> int:
        """Migrate landmark encounters table"""
        logger.info("Migrating landmark encounters...")
        
        try:
            legacy_conn = sqlite3.connect(self.legacy_db_path)
            legacy_conn.row_factory = sqlite3.Row
            legacy_cursor = legacy_conn.cursor()
            
            # Check if table exists
            legacy_cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='landmark_encounters'
            """)
            if not legacy_cursor.fetchone():
                logger.info("No landmark encounters table found in legacy database")
                return 0
            
            # Get total count
            legacy_cursor.execute("SELECT COUNT(*) FROM landmark_encounters")
            total_landmarks = legacy_cursor.fetchone()[0]
            logger.info(f"Found {total_landmarks} landmark encounters to migrate")
            
            # Migrate in batches
            offset = 0
            with self.db_manager.session_scope() as session:
                while offset < total_landmarks:
                    legacy_cursor.execute("""
                        SELECT * FROM landmark_encounters 
                        ORDER BY id 
                        LIMIT ? OFFSET ?
                    """, (batch_size, offset))
                    
                    landmarks = legacy_cursor.fetchall()
                    
                    for legacy_landmark in landmarks:
                        try:
                            new_landmark = LandmarkModel(
                                id=legacy_landmark['id'],
                                trip_id=legacy_landmark.get('trip_id'),
                                landmark_id=legacy_landmark.get('landmark_id'),
                                landmark_name=legacy_landmark.get('landmark_name'),
                                lat=legacy_landmark.get('lat'),
                                lon=legacy_landmark.get('lon'),
                                encounter_time=self._parse_datetime(legacy_landmark['encounter_time']),
                                landmark_type=legacy_landmark.get('landmark_type', 'standard'),
                                is_priority_landmark=bool(legacy_landmark.get('is_priority_landmark', False))
                            )
                            
                            session.merge(new_landmark)
                            self.migration_stats['landmark_encounters']['migrated'] += 1
                            
                        except Exception as e:
                            logger.error(f"Failed to migrate landmark encounter {legacy_landmark['id']}: {str(e)}")
                            self.migration_stats['landmark_encounters']['failed'] += 1
                    
                    offset += batch_size
                    logger.info(f"Migrated {min(offset, total_landmarks)}/{total_landmarks} landmark encounters")
            
            legacy_conn.close()
            return self.migration_stats['landmark_encounters']['migrated']
            
        except Exception as e:
            logger.error(f"Error migrating landmark encounters: {str(e)}")
            raise
    
    def migrate_video_clips(self, batch_size: int = 1000) -> int:
        """Migrate video clips table"""
        logger.info("Migrating video clips...")
        
        try:
            legacy_conn = sqlite3.connect(self.legacy_db_path)
            legacy_conn.row_factory = sqlite3.Row
            legacy_cursor = legacy_conn.cursor()
            
            # Check if table exists
            legacy_cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='video_clips'
            """)
            if not legacy_cursor.fetchone():
                logger.info("No video clips table found in legacy database")
                return 0
            
            # Get total count
            legacy_cursor.execute("SELECT COUNT(*) FROM video_clips")
            total_clips = legacy_cursor.fetchone()[0]
            logger.info(f"Found {total_clips} video clips to migrate")
            
            # Migrate in batches
            offset = 0
            with self.db_manager.session_scope() as session:
                while offset < total_clips:
                    legacy_cursor.execute("""
                        SELECT * FROM video_clips 
                        ORDER BY id 
                        LIMIT ? OFFSET ?
                    """, (batch_size, offset))
                    
                    clips = legacy_cursor.fetchall()
                    
                    for legacy_clip in clips:
                        try:
                            new_clip = VideoModel(
                                id=legacy_clip['id'],
                                trip_id=legacy_clip.get('trip_id'),
                                start_time=self._parse_datetime(legacy_clip['start_time']),
                                end_time=self._parse_datetime(legacy_clip['end_time']),
                                start_lat=legacy_clip.get('start_lat'),
                                start_lon=legacy_clip.get('start_lon'),
                                end_lat=legacy_clip.get('end_lat'),
                                end_lon=legacy_clip.get('end_lon'),
                                sequence_num=legacy_clip.get('sequence_num'),
                                quality=legacy_clip.get('quality'),
                                road_video_file=legacy_clip.get('road_video_file'),
                                interior_video_file=legacy_clip.get('interior_video_file'),
                                near_landmark=bool(legacy_clip.get('near_landmark', False)),
                                landmark_id=legacy_clip.get('landmark_id'),
                                landmark_type=legacy_clip.get('landmark_type'),
                                location=legacy_clip.get('location')
                            )
                            
                            session.merge(new_clip)
                            self.migration_stats['video_clips']['migrated'] += 1
                            
                        except Exception as e:
                            logger.error(f"Failed to migrate video clip {legacy_clip['id']}: {str(e)}")
                            self.migration_stats['video_clips']['failed'] += 1
                    
                    offset += batch_size
                    logger.info(f"Migrated {min(offset, total_clips)}/{total_clips} video clips")
            
            legacy_conn.close()
            return self.migration_stats['video_clips']['migrated']
            
        except Exception as e:
            logger.error(f"Error migrating video clips: {str(e)}")
            raise
    
    def migrate_external_videos(self, batch_size: int = 1000) -> int:
        """Migrate external videos table"""
        logger.info("Migrating external videos...")
        
        try:
            legacy_conn = sqlite3.connect(self.legacy_db_path)
            legacy_conn.row_factory = sqlite3.Row
            legacy_cursor = legacy_conn.cursor()
            
            # Check if table exists
            legacy_cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='external_videos'
            """)
            if not legacy_cursor.fetchone():
                logger.info("No external videos table found in legacy database")
                return 0
            
            # Get total count
            legacy_cursor.execute("SELECT COUNT(*) FROM external_videos")
            total_videos = legacy_cursor.fetchone()[0]
            logger.info(f"Found {total_videos} external videos to migrate")
            
            # Migrate in batches
            offset = 0
            with self.db_manager.session_scope() as session:
                while offset < total_videos:
                    legacy_cursor.execute("""
                        SELECT * FROM external_videos 
                        ORDER BY id 
                        LIMIT ? OFFSET ?
                    """, (batch_size, offset))
                    
                    videos = legacy_cursor.fetchall()
                    
                    for legacy_video in videos:
                        try:
                            new_video = ExternalVideoModel(
                                id=legacy_video['id'],
                                date=self._parse_datetime(legacy_video.get('date')),
                                file_path=legacy_video.get('file_path'),
                                lat=legacy_video.get('lat'),
                                lon=legacy_video.get('lon'),
                                source=legacy_video.get('source'),
                                tags=legacy_video.get('tags'),
                                upload_time=self._parse_datetime(legacy_video.get('upload_time')) or datetime.utcnow()
                            )
                            
                            session.merge(new_video)
                            self.migration_stats['external_videos']['migrated'] += 1
                            
                        except Exception as e:
                            logger.error(f"Failed to migrate external video {legacy_video['id']}: {str(e)}")
                            self.migration_stats['external_videos']['failed'] += 1
                    
                    offset += batch_size
                    logger.info(f"Migrated {min(offset, total_videos)}/{total_videos} external videos")
            
            legacy_conn.close()
            return self.migration_stats['external_videos']['migrated']
            
        except Exception as e:
            logger.error(f"Error migrating external videos: {str(e)}")
            raise
    
    def migrate_quality_upgrades(self, batch_size: int = 1000) -> int:
        """Migrate quality upgrades table"""
        logger.info("Migrating quality upgrades...")
        
        try:
            legacy_conn = sqlite3.connect(self.legacy_db_path)
            legacy_conn.row_factory = sqlite3.Row
            legacy_cursor = legacy_conn.cursor()
            
            # Check if table exists
            legacy_cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='quality_upgrades'
            """)
            if not legacy_cursor.fetchone():
                logger.info("No quality upgrades table found in legacy database")
                return 0
            
            # Get total count
            legacy_cursor.execute("SELECT COUNT(*) FROM quality_upgrades")
            total_upgrades = legacy_cursor.fetchone()[0]
            logger.info(f"Found {total_upgrades} quality upgrades to migrate")
            
            # Migrate in batches
            offset = 0
            with self.db_manager.session_scope() as session:
                while offset < total_upgrades:
                    legacy_cursor.execute("""
                        SELECT * FROM quality_upgrades 
                        ORDER BY id 
                        LIMIT ? OFFSET ?
                    """, (batch_size, offset))
                    
                    upgrades = legacy_cursor.fetchall()
                    
                    for legacy_upgrade in upgrades:
                        try:
                            new_upgrade = QualityModel(
                                id=legacy_upgrade['id'],
                                trip_id=legacy_upgrade.get('trip_id'),
                                timestamp=self._parse_datetime(legacy_upgrade['timestamp']),
                                landmark_id=legacy_upgrade.get('landmark_id'),
                                landmark_name=legacy_upgrade.get('landmark_name'),
                                distance_meters=legacy_upgrade.get('distance_meters'),
                                reason=legacy_upgrade.get('reason')
                            )
                            
                            session.merge(new_upgrade)
                            self.migration_stats['quality_upgrades']['migrated'] += 1
                            
                        except Exception as e:
                            logger.error(f"Failed to migrate quality upgrade {legacy_upgrade['id']}: {str(e)}")
                            self.migration_stats['quality_upgrades']['failed'] += 1
                    
                    offset += batch_size
                    logger.info(f"Migrated {min(offset, total_upgrades)}/{total_upgrades} quality upgrades")
            
            legacy_conn.close()
            return self.migration_stats['quality_upgrades']['migrated']
            
        except Exception as e:
            logger.error(f"Error migrating quality upgrades: {str(e)}")
            raise
    
    def _parse_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        """Parse datetime string to datetime object"""
        if not dt_str:
            return None
        
        try:
            # Try ISO format first
            return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            try:
                # Try common formats
                for fmt in [
                    '%Y-%m-%d %H:%M:%S.%f',
                    '%Y-%m-%d %H:%M:%S',
                    '%Y-%m-%dT%H:%M:%S.%f',
                    '%Y-%m-%dT%H:%M:%S'
                ]:
                    return datetime.strptime(dt_str, fmt)
            except ValueError:
                logger.warning(f"Could not parse datetime: {dt_str}")
                return None
    
    def verify_migration(self) -> Dict[str, Any]:
        """Verify migration results by comparing record counts"""
        logger.info("Verifying migration results...")
        
        verification_results = {}
        
        try:
            legacy_conn = sqlite3.connect(self.legacy_db_path)
            legacy_cursor = legacy_conn.cursor()
            
            with self.db_manager.session_scope() as session:
                # Check each table
                tables = [
                    'trips', 'gps_coordinates', 'landmark_encounters', 
                    'video_clips', 'external_videos', 'quality_upgrades'
                ]
                
                for table in tables:
                    # Get legacy count
                    try:
                        legacy_cursor.execute(f"SELECT COUNT(*) FROM {table}")
                        legacy_count = legacy_cursor.fetchone()[0]
                    except sqlite3.OperationalError:
                        legacy_count = 0  # Table doesn't exist
                    
                    # Get new count
                    if table == 'trips':
                        new_count = session.query(TripModel).count()
                    elif table == 'gps_coordinates':
                        new_count = session.query(GpsModel).count()
                    elif table == 'landmark_encounters':
                        new_count = session.query(LandmarkModel).count()
                    elif table == 'video_clips':
                        new_count = session.query(VideoModel).count()
                    elif table == 'external_videos':
                        new_count = session.query(ExternalVideoModel).count()
                    elif table == 'quality_upgrades':
                        new_count = session.query(QualityModel).count()
                    else:
                        new_count = 0
                    
                    verification_results[table] = {
                        'legacy_count': legacy_count,
                        'new_count': new_count,
                        'match': legacy_count == new_count,
                        'migrated': self.migration_stats[table]['migrated'],
                        'failed': self.migration_stats[table]['failed']
                    }
            
            legacy_conn.close()
            
            logger.info("Migration verification completed")
            return verification_results
            
        except Exception as e:
            logger.error(f"Error verifying migration: {str(e)}")
            return {}
    
    def get_migration_summary(self) -> str:
        """Get a human-readable migration summary"""
        total_migrated = sum(stats['migrated'] for stats in self.migration_stats.values())
        total_failed = sum(stats['failed'] for stats in self.migration_stats.values())
        
        summary = f"""
Migration Summary:
=================
Total Records Migrated: {total_migrated}
Total Records Failed: {total_failed}

Details:
--------
"""
        
        for table, stats in self.migration_stats.items():
            summary += f"{table}: {stats['migrated']} migrated, {stats['failed']} failed\n"
        
        return summary


def run_migration(legacy_db_path: str, new_db_path: Optional[str] = None, 
                 batch_size: int = 1000) -> Dict[str, Any]:
    """
    Run complete migration from legacy database
    
    Args:
        legacy_db_path: Path to legacy database
        new_db_path: Path for new database (optional)
        batch_size: Batch size for migration
        
    Returns:
        Migration results and verification
    """
    migrator = DataMigrator(legacy_db_path, new_db_path)
    
    # Run migration
    migration_stats = migrator.migrate_all_data(batch_size)
    
    # Verify results
    verification_results = migrator.verify_migration()
    
    # Get summary
    summary = migrator.get_migration_summary()
    
    logger.info(summary)
    
    return {
        'migration_stats': migration_stats,
        'verification_results': verification_results,
        'summary': summary
    }
