import os
import shutil
import logging
import sqlite3
import json
import psutil
import time
from datetime import datetime, timedelta
import subprocess
from pathlib import Path
from typing import Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levellevel)s - %(message)s'
)
logger = logging.getLogger('disk_manager')

class DiskManager:
    def __init__(self, 
                 data_path=None, 
                 db_path=None,
                 settings_path=None):
        """
        Initialize the DiskManager with configurable paths.
        
        Args:
            data_path: Path to store data files. If None, uses environment variable 
                      DASHCAM_DATA_PATH or defaults to [current_working_dir]/data
            db_path: Path to the SQLite database. If None, will be derived from data_path
            settings_path: Path to the storage settings JSON file. If None, will be derived from data_path
        """
        # Get base data path - use environment variable, or default to a directory in current location
        self.data_path = data_path or os.environ.get('DASHCAM_DATA_PATH') or os.path.join(os.getcwd(), 'data')
        
        # Make sure we use absolute paths
        self.data_path = os.path.abspath(self.data_path)
        
        # Derive other paths if not explicitly provided
        self.db_path = db_path or os.environ.get('DASHCAM_DB_PATH') or os.path.join(self.data_path, "recordings.db")
        self.settings_path = settings_path or os.environ.get('DASHCAM_SETTINGS_PATH') or os.path.join(self.data_path, "storage_settings.json")
        self.video_path = os.path.join(self.data_path, "videos")
        
        # Create directories if they don't exist
        os.makedirs(self.video_path, exist_ok=True)
        
        # Initialize settings with defaults if file doesn't exist
        if not os.path.exists(self.settings_path):
            self.settings = {
                "autoCleanEnabled": False,
                "autoCleanThreshold": 90,
                "autoCleanDays": 30,
                "mainDrive": "/dev/sda1",
                "mountPoint": "/mnt/dashcam_storage"
            }
            self.save_settings()
        else:
            self.load_settings()
            
    def load_settings(self):
        """Load storage settings from file"""
        try:
            with open(self.settings_path, 'r') as f:
                self.settings = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load settings: {str(e)}")
            # Initialize with defaults
            self.settings = {
                "autoCleanEnabled": False,
                "autoCleanThreshold": 90,
                "autoCleanDays": 30,
                "mainDrive": "/dev/sda1",
                "mountPoint": "/mnt/dashcam_storage"
            }
            
    def save_settings(self):
        """Save storage settings to file"""
        try:
            with open(self.settings_path, 'w') as f:
                json.dump(self.settings, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Failed to save settings: {str(e)}")
            return False
            
    def apply_settings(self, settings: Dict[str, Any]):
        """
        Apply storage settings received from the settings manager
        
        Args:
            settings: Dictionary containing storage settings from the settings manager
        """
        try:
            settings_changed = False
            drive_changed = False
            mount_point_changed = False
            
            # Update auto-clean enabled status if provided
            if "autoCleanEnabled" in settings and settings["autoCleanEnabled"] != self.settings.get("autoCleanEnabled"):
                self.settings["autoCleanEnabled"] = settings["autoCleanEnabled"]
                settings_changed = True
                logger.info(f"Auto-clean enabled set to {settings['autoCleanEnabled']}")
                
            # Update auto-clean threshold if provided
            if "autoCleanThreshold" in settings and settings["autoCleanThreshold"] != self.settings.get("autoCleanThreshold"):
                self.settings["autoCleanThreshold"] = settings["autoCleanThreshold"]
                settings_changed = True
                logger.info(f"Auto-clean threshold set to {settings['autoCleanThreshold']}%")
                
            # Update auto-clean days if provided
            if "autoCleanDays" in settings and settings["autoCleanDays"] != self.settings.get("autoCleanDays"):
                self.settings["autoCleanDays"] = settings["autoCleanDays"]
                settings_changed = True
                logger.info(f"Auto-clean days set to {settings['autoCleanDays']} days")
                
            # Update main drive if provided
            if "mainDrive" in settings and settings["mainDrive"] != self.settings.get("mainDrive"):
                self.settings["mainDrive"] = settings["mainDrive"]
                drive_changed = True
                settings_changed = True
                logger.info(f"Main drive set to {settings['mainDrive']}")
                
            # Update mount point if provided
            if "mountPoint" in settings and settings["mountPoint"] != self.settings.get("mountPoint"):
                self.settings["mountPoint"] = settings["mountPoint"]
                mount_point_changed = True
                settings_changed = True
                logger.info(f"Mount point set to {settings['mountPoint']}")
                
            # If settings changed, save to file
            if settings_changed:
                self.save_settings()
                
            # Handle drive/mount point changes
            if drive_changed or mount_point_changed:
                # If currently mounted, try to unmount and remount with new settings
                disk_info = self.get_disk_info()
                if disk_info["mounted"]:
                    logger.info("Drive is currently mounted. Unmounting to apply new settings...")
                    if self.unmount_drive():
                        logger.info("Remounting drive with new settings...")
                        self.mount_drive()
                
            # Check storage status if auto-clean is enabled
            if self.settings.get("autoCleanEnabled", False):
                self.check_storage_status()
                
            logger.info("Storage settings applied successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error applying storage settings: {str(e)}")
            return False
            
    def get_disk_info(self):
        """Get information about the storage disk"""
        mount_point = self.settings.get("mountPoint", "/mnt/dashcam_storage")
        
        try:
            # Check if disk is mounted
            mounted = os.path.ismount(mount_point)
            
            if not mounted:
                return {
                    "mounted": False,
                    "total": 0,
                    "used": 0,
                    "free": 0,
                    "percent": 0,
                    "device": self.settings.get("mainDrive", ""),
                    "path": mount_point
                }
            
            # Get disk usage information
            disk_usage = shutil.disk_usage(mount_point)
            
            # Get device name
            device = ""
            try:
                partitions = psutil.disk_partitions()
                for p in partitions:
                    if p.mountpoint == mount_point:
                        device = p.device
                        break
            except:
                device = self.settings.get("mainDrive", "")
            
            return {
                "mounted": True,
                "total": disk_usage.total,
                "used": disk_usage.used,
                "free": disk_usage.free,
                "percent": int(disk_usage.used * 100 / disk_usage.total),
                "device": device,
                "path": mount_point
            }
        except Exception as e:
            logger.error(f"Error getting disk info: {str(e)}")
            return {
                "mounted": False,
                "total": 0,
                "used": 0,
                "free": 0,
                "percent": 0,
                "device": "",
                "path": mount_point,
                "error": str(e)
            }
            
    def mount_drive(self):
        """Attempt to mount the storage drive"""
        try:
            drive = self.settings.get("mainDrive")
            mount_point = self.settings.get("mountPoint")
            
            # Check if the mount point exists, if not try to create it
            if not os.path.exists(mount_point):
                try:
                    os.makedirs(mount_point, exist_ok=True)
                except PermissionError:
                    logger.error(f"Permission denied when creating mount point {mount_point}. Try creating it manually with: sudo mkdir -p {mount_point}")
                    return False
            
            # Check if already mounted
            if os.path.ismount(mount_point):
                logger.info(f"Drive {drive} is already mounted at {mount_point}")
                return True
                
            # First try mounting without sudo
            try:
                result = subprocess.run(
                    ["mount", drive, mount_point], 
                    capture_output=True, 
                    text=True
                )
                
                if result.returncode == 0:
                    logger.info(f"Successfully mounted {drive} at {mount_point}")
                    return True
            except Exception as mount_error:
                logger.warning(f"Standard mount failed: {str(mount_error)}")
            
            # If that fails, try with sudo
            try:
                result = subprocess.run(
                    ["sudo", "mount", drive, mount_point], 
                    capture_output=True, 
                    text=True
                )
                
                if result.returncode == 0:
                    logger.info(f"Successfully mounted {drive} at {mount_point}")
                    return True
                else:
                    logger.error(f"Failed to mount drive with sudo: {result.stderr}")
                    logger.info("To fix permission issues, consider adding an entry to /etc/fstab or setting up sudo permissions")
                    return False
            except Exception as sudo_error:
                logger.error(f"Sudo mount command failed: {str(sudo_error)}")
                return False
                
        except Exception as e:
            logger.error(f"Error mounting drive: {str(e)}")
            return False
            
    def unmount_drive(self):
        """Safely unmount the storage drive"""
        try:
            mount_point = self.settings.get("mountPoint")
            
            # Check if mounted
            if not os.path.ismount(mount_point):
                logger.info(f"Drive is not mounted at {mount_point}")
                return True
                
            # First try unmounting without sudo
            try:
                result = subprocess.run(
                    ["umount", mount_point], 
                    capture_output=True, 
                    text=True
                )
                
                if result.returncode == 0:
                    logger.info(f"Successfully unmounted drive from {mount_point}")
                    return True
            except Exception as unmount_error:
                logger.warning(f"Standard unmount failed: {str(unmount_error)}")
                
            # If that fails, try with sudo
            try:
                result = subprocess.run(
                    ["sudo", "umount", mount_point], 
                    capture_output=True, 
                    text=True
                )
                
                if result.returncode == 0:
                    logger.info(f"Successfully unmounted drive from {mount_point}")
                    return True
                else:
                    logger.error(f"Failed to unmount drive with sudo: {result.stderr}")
                    return False
            except Exception as sudo_error:
                logger.error(f"Sudo unmount command failed: {str(sudo_error)}")
                return False
                
        except Exception as e:
            logger.error(f"Error unmounting drive: {str(e)}")
            return False
    
    def get_video_stats(self):
        """Get statistics about stored videos"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get total video count
            cursor.execute("SELECT COUNT(*) FROM recordings")
            total_count = cursor.fetchone()[0]
            
            # Get total video size
            cursor.execute("SELECT SUM(file_size) FROM recordings")
            total_size = cursor.fetchone()[0] or 0
            
            # Get oldest and newest video dates
            cursor.execute("SELECT MIN(start_time), MAX(start_time) FROM recordings")
            oldest, newest = cursor.fetchone()
            
            # Get size by month
            cursor.execute("""
                SELECT 
                    strftime('%Y-%m', start_time) as month,
                    SUM(file_size) as total_size
                FROM recordings
                GROUP BY month
                ORDER BY month DESC
                LIMIT 12
            """)
            by_month = [{"month": row[0], "size": row[1]} for row in cursor.fetchall()]
            
            conn.close()
            
            return {
                "totalVideos": total_count,
                "totalSize": total_size,
                "oldestVideo": oldest,
                "newestVideo": newest,
                "byMonth": by_month
            }
            
        except Exception as e:
            logger.error(f"Error getting video stats: {str(e)}")
            return {
                "totalVideos": 0,
                "totalSize": 0,
                "oldestVideo": None,
                "newestVideo": None,
                "byMonth": []
            }
    
    def clean_old_videos(self, days=30):
        """Delete videos older than specified days"""
        try:
            # Calculate cutoff date
            cutoff_date = datetime.now() - timedelta(days=days)
            cutoff_str = cutoff_date.strftime("%Y-%m-%d %H:%M:%S")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get list of files to delete
            cursor.execute("""
                SELECT id, file_path, file_size FROM recordings
                WHERE start_time < ?
            """, (cutoff_str,))
            
            videos_to_delete = cursor.fetchall()
            
            if not videos_to_delete:
                conn.close()
                return {"deleted": 0, "freedSpace": 0}
            
            deleted_count = 0
            freed_space = 0
            
            for video_id, file_path, file_size in videos_to_delete:
                full_path = os.path.join(self.data_path, file_path)
                if os.path.exists(full_path):
                    os.remove(full_path)
                    deleted_count += 1
                    freed_space += file_size
                
                # Delete record from database
                cursor.execute("DELETE FROM recordings WHERE id = ?", (video_id,))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Cleaned {deleted_count} videos, freed {freed_space} bytes")
            return {"deleted": deleted_count, "freedSpace": freed_space}
            
        except Exception as e:
            logger.error(f"Error cleaning old videos: {str(e)}")
            return {"deleted": 0, "freedSpace": 0, "error": str(e)}
    
    def backup_videos(self, destination):
        """Backup videos to external location"""
        try:
            if not os.path.exists(destination):
                os.makedirs(destination, exist_ok=True)
                
            # Create a timestamp-based backup folder
            backup_folder = os.path.join(
                destination, 
                f"dashcam_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            )
            os.makedirs(backup_folder, exist_ok=True)
            
            # Get list of video files
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT file_path, file_size FROM recordings")
            videos = cursor.fetchall()
            conn.close()
            
            if not videos:
                return {"copied": 0, "totalSize": 0}
                
            copied_count = 0
            total_size = 0
            
            for file_path, file_size in videos:
                source_path = os.path.join(self.data_path, file_path)
                dest_path = os.path.join(backup_folder, os.path.basename(file_path))
                
                if os.path.exists(source_path):
                    shutil.copy2(source_path, dest_path)
                    copied_count += 1
                    total_size += file_size
            
            logger.info(f"Backed up {copied_count} videos to {backup_folder}")
            return {
                "copied": copied_count, 
                "totalSize": total_size,
                "backupLocation": backup_folder
            }
            
        except Exception as e:
            logger.error(f"Error backing up videos: {str(e)}")
            return {
                "copied": 0, 
                "totalSize": 0, 
                "error": str(e)
            }
    
    def archive_videos(self, archive_type="standard"):
        """Compress old videos to save space"""
        try:
            # Get videos older than 60 days
            cutoff_date = datetime.now() - timedelta(days=60)
            cutoff_str = cutoff_date.strftime("%Y-%m-%d %H:%M:%S")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, file_path, file_size FROM recordings
                WHERE start_time < ? AND archived = 0
            """, (cutoff_str,))
            
            videos_to_archive = cursor.fetchall()
            
            if not videos_to_archive:
                conn.close()
                return {"archived": 0, "savedSpace": 0}
            
            archive_count = 0
            saved_space = 0
            
            for video_id, file_path, original_size in videos_to_archive:
                full_path = os.path.join(self.data_path, file_path)
                if not os.path.exists(full_path):
                    continue
                    
                # Create archive filename
                archive_path = full_path + ".mp4"
                
                # Determine compression quality based on archive type
                crf = "28" if archive_type == "standard" else "32"
                
                # Compress the video using ffmpeg
                result = subprocess.run([
                    "ffmpeg", "-i", full_path, 
                    "-c:v", "libx264", "-crf", crf, 
                    "-preset", "medium", 
                    "-c:a", "aac", "-b:a", "128k",
                    "-y", archive_path
                ], capture_output=True)
                
                if result.returncode == 0 and os.path.exists(archive_path):
                    # Get new file size
                    new_size = os.path.getsize(archive_path)
                    
                    # If archive is smaller, replace the original
                    if new_size < original_size:
                        os.remove(full_path)
                        os.rename(archive_path, full_path)
                        
                        # Update the database
                        space_saved = original_size - new_size
                        cursor.execute("""
                            UPDATE recordings 
                            SET file_size = ?, archived = 1 
                            WHERE id = ?
                        """, (new_size, video_id))
                        
                        archive_count += 1
                        saved_space += space_saved
                    else:
                        # Archive not smaller, delete it
                        os.remove(archive_path)
            
            conn.commit()
            conn.close()
            
            logger.info(f"Archived {archive_count} videos, saved {saved_space} bytes")
            return {"archived": archive_count, "savedSpace": saved_space}
            
        except Exception as e:
            logger.error(f"Error archiving videos: {str(e)}")
            return {"archived": 0, "savedSpace": 0, "error": str(e)}
    
    def check_storage_status(self):
        """Check storage status and perform cleanup if needed"""
        disk_info = self.get_disk_info()
        
        if not disk_info["mounted"]:
            logger.warning("Storage drive is not mounted")
            # Try to mount the drive
            self.mount_drive()
            return False
            
        # Check if auto-clean is enabled
        if not self.settings.get("autoCleanEnabled", False):
            return True
            
        # Check if storage usage exceeds threshold
        threshold = self.settings.get("autoCleanThreshold", 90)
        if disk_info["percent"] >= threshold:
            logger.warning(f"Storage usage ({disk_info['percent']}%) exceeds threshold ({threshold}%)")
            
            # Perform auto cleanup
            days = self.settings.get("autoCleanDays", 30)
            result = self.clean_old_videos(days)
            
            logger.info(f"Auto cleanup: deleted {result['deleted']} videos, freed {result['freedSpace']} bytes")
            
        return True
    
    def get_storage_settings(self):
        """Get current storage settings"""
        return {
            "autoCleanEnabled": self.settings.get("autoCleanEnabled", False),
            "autoCleanThreshold": self.settings.get("autoCleanThreshold", 90),
            "autoCleanDays": self.settings.get("autoCleanDays", 30),
            "mainDrive": self.settings.get("mainDrive", "/dev/sda1"),
            "mountPoint": self.settings.get("mountPoint", "/mnt/dashcam_storage")
        }
    
    def update_storage_settings(self, settings):
        """Update storage settings"""
        try:
            # Use apply_settings for the actual implementation
            return self.apply_settings(settings)
        except Exception as e:
            logger.error(f"Error updating settings: {str(e)}")
            return False

    def cleanup(self):
        """Clean up resources properly before shutdown"""
        logger.info("Cleaning up DiskManager resources")
        
        # Save any pending settings
        try:
            self.save_settings()
            logger.info("Settings saved successfully during cleanup")
        except Exception as e:
            logger.error(f"Error saving settings during cleanup: {str(e)}")
        
        # Check if we need to unmount the drive on shutdown
        try:
            disk_info = self.get_disk_info()
            if disk_info["mounted"]:
                logger.info("Unmounting drive during cleanup...")
                self.unmount_drive()
        except Exception as e:
            logger.error(f"Error unmounting drive during cleanup: {str(e)}")
            
        logger.info("DiskManager cleanup completed")