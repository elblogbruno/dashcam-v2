#!/usr/bin/env python3
"""
Migration script to convert existing trip_logger data to new schema

This script migrates data from the old SQLite database to the new 
SQLAlchemy-based schema while preserving all existing data.
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from trip_logger_package.utils.migration import DataMigrator
from trip_logger_package.logging import init_logging, LogLevel


def setup_logging(verbose: bool = False):
    """Setup logging for migration"""
    level = LogLevel.DEBUG if verbose else LogLevel.INFO
    log_manager = init_logging(level=level)
    return log_manager.get_logger('migration_script')


def find_existing_database():
    """Find existing database file"""
    possible_paths = [
        os.environ.get('DASHCAM_DB_PATH'),
        os.path.join(os.environ.get('DASHCAM_DATA_PATH', ''), 'recordings.db'),
        os.path.join(backend_dir, 'data', 'recordings.db'),
        os.path.join(backend_dir.parent, 'data', 'recordings.db'),
        os.path.join(backend_dir.parent, 'recordings.db')
    ]
    
    for path in possible_paths:
        if path and os.path.exists(path):
            return path
    
    return None


def backup_database(db_path: str) -> str:
    """Create backup of existing database"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = f"{db_path}.backup_migration_{timestamp}"
    
    import shutil
    shutil.copy2(db_path, backup_path)
    return backup_path


def main():
    parser = argparse.ArgumentParser(
        description='Migrate trip_logger data to new SQLAlchemy schema'
    )
    parser.add_argument(
        '--legacy-db', 
        type=str,
        help='Path to legacy database file (auto-detected if not provided)'
    )
    parser.add_argument(
        '--new-db', 
        type=str,
        help='Path for new database file (optional, uses same location as legacy)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=1000,
        help='Batch size for migration (default: 1000)'
    )
    parser.add_argument(
        '--backup',
        action='store_true',
        help='Create backup of legacy database before migration'
    )
    parser.add_argument(
        '--verify-only',
        action='store_true', 
        help='Only verify existing migration, do not migrate'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force migration even if target database exists'
    )
    
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logging(args.verbose)
    logger.info("Starting trip_logger data migration")
    
    # Find legacy database
    legacy_db_path = args.legacy_db
    if not legacy_db_path:
        legacy_db_path = find_existing_database()
        if not legacy_db_path:
            logger.error("Could not find existing database. Please specify --legacy-db")
            return 1
        logger.info(f"Auto-detected legacy database: {legacy_db_path}")
    
    if not os.path.exists(legacy_db_path):
        logger.error(f"Legacy database not found: {legacy_db_path}")
        return 1
    
    # Determine new database path
    new_db_path = args.new_db
    if not new_db_path:
        new_db_path = legacy_db_path  # Migrate in place
    
    # Check if target database already has data
    if new_db_path != legacy_db_path and os.path.exists(new_db_path) and not args.force:
        logger.error(f"Target database already exists: {new_db_path}")
        logger.error("Use --force to overwrite or specify a different path")
        return 1
    
    # Create backup if requested
    backup_path = None
    if args.backup:
        try:
            backup_path = backup_database(legacy_db_path)
            logger.info(f"Created backup: {backup_path}")
        except Exception as e:
            logger.error(f"Failed to create backup: {str(e)}")
            return 1
    
    try:
        if args.verify_only:
            # Only run verification
            from trip_logger_package.utils.migration import DataMigrator
            migrator = DataMigrator(legacy_db_path, new_db_path)
            verification_results = migrator.verify_migration()
            
            logger.info("Migration Verification Results:")
            for table, results in verification_results.items():
                status = "✓" if results['match'] else "✗"
                logger.info(f"  {status} {table}: legacy={results['legacy_count']}, new={results['new_count']}")
        else:
            # Run full migration
            logger.info(f"Migrating from {legacy_db_path} to {new_db_path}")
            logger.info(f"Batch size: {args.batch_size}")
            
            results = run_migration(
                legacy_db_path=legacy_db_path,
                new_db_path=new_db_path if new_db_path != legacy_db_path else None,
                batch_size=args.batch_size
            )
            
            # Print results
            logger.info("\nMigration completed!")
            logger.info(results['summary'])
            
            # Print verification results
            logger.info("\nVerification Results:")
            for table, verification in results['verification_results'].items():
                status = "✓" if verification['match'] else "✗"
                logger.info(f"  {status} {table}: {verification['migrated']} migrated, {verification['failed']} failed")
            
            # Check if all migrations were successful
            total_failed = sum(stats['failed'] for stats in results['migration_stats'].values())
            if total_failed > 0:
                logger.warning(f"Migration completed with {total_failed} failed records")
                return 2
            else:
                logger.info("Migration completed successfully with no failures!")
    
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        if args.verbose:
            import traceback
            logger.error(traceback.format_exc())
        
        # Restore backup if migration failed and we created one
        if backup_path and os.path.exists(backup_path):
            try:
                import shutil
                shutil.copy2(backup_path, legacy_db_path)
                logger.info(f"Restored backup due to migration failure")
            except Exception as restore_error:
                logger.error(f"Failed to restore backup: {str(restore_error)}")
        
        return 1
    
    logger.info("Migration script completed")
    return 0


if __name__ == '__main__':
    sys.exit(main())
