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
from typing import Dict, Any, List, Optional

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
                "mountPoint": "/mnt/dashcam_storage",
                "autoDetectDrives": True  # Auto-detect drives by default
            }
            self.save_settings()
        else:
            self.load_settings()
            # Ensure new settings exist
            if "autoDetectDrives" not in self.settings:
                self.settings["autoDetectDrives"] = True
                self.save_settings()
            
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
                "mountPoint": "/mnt/dashcam_storage",
                "autoDetectDrives": True
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
                
            # Update auto-detect drives if provided
            if "autoDetectDrives" in settings and settings["autoDetectDrives"] != self.settings.get("autoDetectDrives"):
                self.settings["autoDetectDrives"] = settings["autoDetectDrives"]
                settings_changed = True
                logger.info(f"Auto-detect drives set to {settings['autoDetectDrives']}")
                
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
        main_drive = self.settings.get("mainDrive", "/dev/sda1")
        auto_detect = self.settings.get("autoDetectDrives", True)
        
        try:
            # Check if auto-detection is enabled
            if auto_detect:
                # Try to find connected USB drives first
                usb_drives = self.detect_usb_drives()
                
                if usb_drives:
                    # Find the first mounted USB drive or the one matching mainDrive setting
                    selected_drive = None
                    
                    # First check if configured main drive is in the list
                    for drive in usb_drives:
                        if drive["name"] == main_drive:
                            selected_drive = drive
                            break
                            
                        # Also check partitions
                        if not selected_drive:
                            for partition in drive.get("partitions", []):
                                if partition["name"] == main_drive:
                                    selected_drive = drive
                                    break
                    
                    # If not found by name, use the first USB drive
                    if not selected_drive and usb_drives:
                        selected_drive = usb_drives[0]
                    
                    # If a drive was found
                    if selected_drive:
                        # Check if it has mounted partitions
                        mounted_partition = None
                        for partition in selected_drive.get("partitions", []):
                            if partition["mounted"]:
                                mounted_partition = partition
                                break
                        
                        # If a partition is mounted, use its info
                        if mounted_partition:
                            # Get detailed info about the partition
                            details = self.get_disk_details(mounted_partition["name"])
                            
                            if details["mounted"]:
                                return {
                                    "mounted": True,
                                    "total": details.get("used", 0) + details.get("free", 0),
                                    "used": details.get("used", 0),
                                    "free": details.get("free", 0),
                                    "percent": details.get("percent", 0),
                                    "device": details["device"],
                                    "path": details["mountpoint"],
                                    "model": details.get("model", "USB Storage"),
                                    "filesystem": details.get("filesystem", "Unknown"),
                                    "label": details.get("label", ""),
                                    "isUsb": True,
                                    "canEject": True
                                }
                        
                        # If drive exists but isn't mounted
                        return {
                            "mounted": False,
                            "total": 0,
                            "used": 0,
                            "free": 0,
                            "percent": 0,
                            "device": selected_drive["name"],
                            "model": selected_drive.get("model", "USB Storage"),
                            "path": mount_point,
                            "isUsb": True,
                            "canEject": False,
                            "needsMount": True,
                            "availablePartitions": [p["name"] for p in selected_drive.get("partitions", [])]
                        }
            
            # Fall back to configured mount point checks if auto-detect is disabled or no USB found
            mounted = os.path.ismount(mount_point)
            
            if not mounted:
                return {
                    "mounted": False,
                    "total": 0,
                    "used": 0,
                    "free": 0,
                    "percent": 0,
                    "device": self.settings.get("mainDrive", ""),
                    "path": mount_point,
                    "isUsb": False,
                    "canEject": False
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
            
            # Check if the device is a USB drive
            is_usb = False
            try:
                # Get device name without /dev/
                dev_name = device.replace("/dev/", "")
                # Check if it's a USB device using sysfs
                if os.path.exists(f"/sys/block/{dev_name}"):
                    removable_path = f"/sys/block/{dev_name}/removable"
                    if os.path.exists(removable_path):
                        with open(removable_path, 'r') as f:
                            if f.read().strip() == '1':
                                is_usb = True
            except:
                pass
            
            return {
                "mounted": True,
                "total": disk_usage.total,
                "used": disk_usage.used,
                "free": disk_usage.free,
                "percent": int(disk_usage.used * 100 / disk_usage.total),
                "device": device,
                "path": mount_point,
                "isUsb": is_usb,
                "canEject": is_usb
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
            
    def mount_drive(self, specific_drive=None):
        """
        Attempt to mount the storage drive
        
        Args:
            specific_drive: Optional specific drive to mount (overrides settings)
            
        Returns:
            bool: True if mounted successfully, False otherwise
        """
        try:
            drive = specific_drive or self.settings.get("mainDrive")
            mount_point = self.settings.get("mountPoint")
            auto_detect = self.settings.get("autoDetectDrives", True)
            
            # Check if the mount point exists, if not try to create it
            if not os.path.exists(mount_point):
                try:
                    os.makedirs(mount_point, exist_ok=True)
                except PermissionError:
                    logger.error(f"Permission denied when creating mount point {mount_point}. Try creating it manually with: sudo mkdir -p {mount_point}")
                    return False
            
            # Check if already mounted
            if os.path.ismount(mount_point):
                logger.info(f"A drive is already mounted at {mount_point}")
                return True
            
            # If auto-detection is enabled and no specific drive was requested
            if auto_detect and not specific_drive:
                # Try to find an available USB drive
                usb_drives = self.detect_usb_drives()
                
                if usb_drives:
                    # Find first unmounted drive or partition
                    for usb_drive in usb_drives:
                        if not usb_drive["mounted"]:
                            # Check if it has partitions
                            if usb_drive["partitions"]:
                                # Try to mount the first partition
                                for partition in usb_drive["partitions"]:
                                    if not partition["mounted"]:
                                        drive = partition["name"]
                                        logger.info(f"Auto-detected USB partition: {drive}")
                                        break
                            else:
                                # Try to mount the whole drive
                                drive = usb_drive["name"]
                                logger.info(f"Auto-detected USB drive: {drive}")
                            
                            break
            
            # Determine filesystem type for better mounting
            fs_type = None
            try:
                result = subprocess.run(
                    ["blkid", "-o", "value", "-s", "TYPE", drive],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0 and result.stdout.strip():
                    fs_type = result.stdout.strip().lower()
                    logger.info(f"Detected filesystem type: {fs_type}")
            except Exception as e:
                logger.warning(f"Could not detect filesystem type: {str(e)}")
            
            # Special handling for NTFS filesystems
            if fs_type == 'ntfs':
                # Check if ntfs-3g is available
                try:
                    subprocess.run(["which", "ntfs-3g"], check=True, capture_output=True)
                    logger.info("ntfs-3g is available for NTFS mounting")
                except subprocess.CalledProcessError:
                    logger.error("ntfs-3g is not installed. Please install it with: sudo apt-get install ntfs-3g")
                    return False
                
                # Try mounting with ntfs-3g directly
                try:
                    mount_cmd = ["sudo", "mount", "-t", "ntfs-3g", drive, mount_point]
                    logger.info(f"Mounting NTFS drive with command: {' '.join(mount_cmd)}")
                    
                    result = subprocess.run(
                        mount_cmd, 
                        capture_output=True, 
                        text=True
                    )
                    
                    if result.returncode == 0:
                        logger.info(f"Successfully mounted NTFS drive {drive} at {mount_point}")
                        return True
                    else:
                        logger.error(f"Failed to mount NTFS drive: {result.stderr}")
                        # Try with additional NTFS options
                        mount_cmd_with_options = ["sudo", "mount", "-t", "ntfs-3g", "-o", "rw,uid=1000,gid=1000,umask=0022", drive, mount_point]
                        logger.info(f"Trying with additional options: {' '.join(mount_cmd_with_options)}")
                        
                        result = subprocess.run(
                            mount_cmd_with_options, 
                            capture_output=True, 
                            text=True
                        )
                        
                        if result.returncode == 0:
                            logger.info(f"Successfully mounted NTFS drive {drive} at {mount_point} with additional options")
                            return True
                        else:
                            logger.error(f"Failed to mount NTFS drive with options: {result.stderr}")
                            return False
                            
                except Exception as ntfs_error:
                    logger.error(f"NTFS mount attempt failed: {str(ntfs_error)}")
                    return False
            
            # For other filesystem types, use standard mounting approach
            # First try mounting without sudo
            try:
                mount_cmd = ["mount"]
                if fs_type and fs_type != 'ntfs':
                    mount_cmd.extend(["-t", fs_type])
                mount_cmd.extend([drive, mount_point])
                
                result = subprocess.run(
                    mount_cmd, 
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
                mount_cmd = ["sudo", "mount"]
                if fs_type and fs_type != 'ntfs':
                    mount_cmd.extend(["-t", fs_type])
                mount_cmd.extend([drive, mount_point])
                
                result = subprocess.run(
                    mount_cmd, 
                    capture_output=True, 
                    text=True
                )
                
                if result.returncode == 0:
                    logger.info(f"Successfully mounted {drive} at {mount_point}")
                    return True
                else:
                    logger.error(f"Failed to mount drive with sudo: {result.stderr}")
                    
                    # Provide helpful error messages based on filesystem type
                    if "unknown filesystem type" in result.stderr.lower():
                        if fs_type:
                            logger.error(f"Filesystem type '{fs_type}' is not supported. You may need to install additional packages.")
                            if fs_type == 'exfat':
                                logger.error("For exFAT support, install: sudo apt-get install exfat-fuse exfat-utils")
                            elif fs_type == 'ntfs':
                                logger.error("For NTFS support, install: sudo apt-get install ntfs-3g")
                        else:
                            logger.error("Unknown filesystem type. Try installing common filesystem support packages.")
                    
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
            
            # Check if recordings table exists and create it if not
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='recordings'
            """)
            if not cursor.fetchone():
                # Create the recordings table if it doesn't exist
                cursor.execute("""
                    CREATE TABLE recordings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        file_path TEXT NOT NULL,
                        file_size INTEGER NOT NULL,
                        duration INTEGER,
                        start_time TIMESTAMP,
                        end_time TIMESTAMP,
                        gps_data TEXT,
                        trip_id TEXT,
                        archived INTEGER DEFAULT 0,
                        backed_up INTEGER DEFAULT 0,
                        backup_path TEXT,
                        is_processed INTEGER DEFAULT 0,
                        thumbnail_path TEXT
                    )
                """)
                conn.commit()
                logger.info("Created recordings table in database")
                # Return empty stats since table was just created
                conn.close()
                return {
                    "totalVideos": 0,
                    "totalSize": 0,
                    "oldestVideo": None,
                    "newestVideo": None,
                    "byMonth": []
                }
            
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
            "mountPoint": self.settings.get("mountPoint", "/mnt/dashcam_storage"),
            "autoDetectDrives": self.settings.get("autoDetectDrives", True)
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
    
    def detect_usb_drives(self) -> List[Dict[str, Any]]:
        """
        Detect and return information about all connected USB storage devices.
        
        Returns:
            List of dictionaries with USB drive information including name, model,
            size, partitions, and mount status.
        """
        try:
            usb_drives = []
            
            # Use lsblk to get all block devices with USB transport
            result = subprocess.run(
                ["lsblk", "-o", "NAME,SIZE,MODEL,TRAN,TYPE,MOUNTPOINT", "-J"], 
                capture_output=True, 
                text=True
            )
            
            if result.returncode != 0:
                logger.error(f"Error running lsblk command: {result.stderr}")
                return []
                
            # Parse JSON output
            try:
                devices_data = json.loads(result.stdout)
                for device in devices_data.get("blockdevices", []):
                    # Check if it's a USB device or a removable device
                    is_usb = device.get("tran") == "usb" and device.get("type") == "disk"
                    
                    # If not detected as USB via lsblk, try checking via sysfs
                    if not is_usb and device.get("type") == "disk":
                        dev_name = device.get("name")
                        if dev_name and os.path.exists(f"/sys/block/{dev_name}"):
                            removable_path = f"/sys/block/{dev_name}/removable"
                            if os.path.exists(removable_path):
                                try:
                                    with open(removable_path, 'r') as f:
                                        if f.read().strip() == '1':
                                            is_usb = True
                                except:
                                    pass
                    
                    if is_usb:
                        model = device.get("model", "")
                        device_info = {
                            "name": f"/dev/{device['name']}",
                            "model": model.strip() if model and isinstance(model, str) else "Dispositivo USB",
                            "size": device.get("size", ""),
                            "mounted": False,
                            "mountpoint": None,
                            "partitions": []
                        }
                        
                        # Check for partitions
                        if "children" in device:
                            for partition in device["children"]:
                                part_info = {
                                    "name": f"/dev/{partition['name']}",
                                    "size": partition.get("size", ""),
                                    "mounted": partition.get("mountpoint") is not None,
                                    "mountpoint": partition.get("mountpoint", None)
                                }
                                # If any partition is mounted, mark the device as mounted
                                # and use the first mounted partition's mountpoint for the device
                                if part_info["mounted"]:
                                    device_info["mounted"] = True
                                    if device_info["mountpoint"] is None:
                                        device_info["mountpoint"] = part_info["mountpoint"]
                                        
                                    # Obtener información de uso del disco para esta partición montada
                                    try:
                                        disk_usage = shutil.disk_usage(part_info["mountpoint"])
                                        part_info["total"] = disk_usage.total
                                        part_info["used"] = disk_usage.used
                                        part_info["free"] = disk_usage.free
                                        
                                        # También añadir esta información al dispositivo principal
                                        if "total" not in device_info:
                                            device_info["total"] = disk_usage.total
                                            device_info["used"] = disk_usage.used
                                            device_info["free"] = disk_usage.free
                                    except Exception as disk_err:
                                        logger.error(f"Error obteniendo información de uso del disco en {part_info['mountpoint']}: {disk_err}")
                                    
                                device_info["partitions"].append(part_info)
                        
                        # If no partitions found, check if the whole device is mounted
                        else:
                            device_info["mounted"] = device.get("mountpoint") is not None
                            device_info["mountpoint"] = device.get("mountpoint", None)
                            
                        usb_drives.append(device_info)
            except json.JSONDecodeError:
                logger.error("Failed to parse lsblk JSON output")
                return []
                
            return usb_drives
                
        except Exception as e:
            logger.error(f"Error detecting USB drives: {str(e)}")
            return []
            
    def get_disk_details(self, device_path) -> Dict[str, Any]:
        """
        Get detailed information about a specific disk device.
        
        Args:
            device_path: Path to the device (e.g., /dev/sda)
            
        Returns:
            Dictionary with detailed disk information
        """
        try:
            # Fix path if it has double slash
            if '//' in device_path:
                device_path = device_path.replace('//', '/')
                
            details = {
                "device": device_path,
                "exists": os.path.exists(device_path),
                "mounted": False,
                "mountpoint": None,
                "size": "Unknown",
                "used": 0,
                "free": 0,
                "percent": 0,
                "filesystem": "Unknown",
                "label": "Unknown",
                "uuid": "Unknown",
                "model": "Unknown",
                "vendor": "Unknown",
                "serial": "Unknown",
                "partitions": []
            }
            
            # Check if device exists
            if not details["exists"]:
                return details
                
            # Get basic device info using lsblk
            try:
                result = subprocess.run(
                    ["lsblk", "-o", "NAME,SIZE,MODEL,VENDOR,SERIAL,FSTYPE,LABEL,UUID,MOUNTPOINT", device_path, "-J"],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    lsblk_data = json.loads(result.stdout)
                    blockdevices = lsblk_data.get("blockdevices", [])
                    
                    if not blockdevices:
                        logger.warning(f"No block device information found for {device_path}")
                        return details
                        
                    device_data = blockdevices[0]
                    details["size"] = device_data.get("size", "Unknown")
                    
                    # Handle potential None values with safe access
                    model = device_data.get("model")
                    details["model"] = model.strip() if model and isinstance(model, str) else "Unknown"
                    
                    vendor = device_data.get("vendor")
                    details["vendor"] = vendor.strip() if vendor and isinstance(vendor, str) else "Unknown"
                    
                    serial = device_data.get("serial")
                    details["serial"] = serial.strip() if serial and isinstance(serial, str) else "Unknown"
                    
                    details["filesystem"] = device_data.get("fstype", "Unknown")
                    details["label"] = device_data.get("label", "Unknown")
                    details["uuid"] = device_data.get("uuid", "Unknown")
                    
                    # Check mount status
                    mount_point = device_data.get("mountpoint")
                    if mount_point:
                        details["mounted"] = True
                        details["mountpoint"] = mount_point
                        
                        # Get disk usage information if mounted
                        try:
                            disk_usage = shutil.disk_usage(mount_point)
                            details["used"] = disk_usage.used
                            details["free"] = disk_usage.free
                            details["percent"] = int(disk_usage.used * 100 / disk_usage.total) if disk_usage.total > 0 else 0
                        except Exception as e:
                            logger.error(f"Error getting disk usage for {mount_point}: {str(e)}")
                    
                    # Check for partitions
                    if "children" in device_data:
                        for partition in device_data["children"]:
                            part_path = f"/dev/{partition['name']}"
                            part_info = {
                                "device": part_path,
                                "size": partition.get("size", "Unknown"),
                                "filesystem": partition.get("fstype", "Unknown"),
                                "label": partition.get("label", "Unknown"),
                                "uuid": partition.get("uuid", "Unknown"),
                                "mounted": False,
                                "mountpoint": None,
                                "used": 0,
                                "free": 0,
                                "percent": 0
                            }
                            
                            # Check mount status for partition
                            mount_point = partition.get("mountpoint")
                            if mount_point:
                                part_info["mounted"] = True
                                part_info["mountpoint"] = mount_point
                                
                                # If this partition is mounted, mark the parent device as mounted too
                                # and use this partition's mountpoint for the device
                                if not details["mounted"]:
                                    details["mounted"] = True
                                    details["mountpoint"] = mount_point
                                
                                # Get usage for mounted partition
                                try:
                                    disk_usage = shutil.disk_usage(mount_point)
                                    part_info["used"] = disk_usage.used
                                    part_info["free"] = disk_usage.free
                                    part_info["percent"] = int(disk_usage.used * 100 / disk_usage.total) if disk_usage.total > 0 else 0
                                    
                                    # Also update device-level usage info if not already set
                                    if details["used"] == 0:
                                        details["used"] = disk_usage.used
                                        details["free"] = disk_usage.free
                                        details["percent"] = int(disk_usage.used * 100 / disk_usage.total) if disk_usage.total > 0 else 0
                                except Exception as e:
                                    logger.error(f"Error getting disk usage for {mount_point}: {str(e)}")
                                    
                            details["partitions"].append(part_info)
            except Exception as e:
                logger.error(f"Error getting detailed disk info: {str(e)}")
            
            return details
                
        except Exception as e:
            logger.error(f"Error getting disk details: {str(e)}")
            return {
                "device": device_path,
                "exists": os.path.exists(device_path),
                "error": str(e)
            }
            
    def safely_eject_drive(self, device_path) -> Dict[str, Any]:
        """
        Safely eject a drive after unmounting all its partitions.
        
        Args:
            device_path: Path to the device (e.g., /dev/sda)
            
        Returns:
            Dictionary with status and message
        """
        try:
            # First, get device details to find all mounted partitions
            details = self.get_disk_details(device_path)
            
            unmount_failed = []
            
            # Unmount the main device if it's mounted
            if details["mounted"]:
                success = self._unmount_device(details["mountpoint"])
                if not success:
                    unmount_failed.append(details["mountpoint"])
            
            # Unmount all partitions
            for partition in details["partitions"]:
                if partition["mounted"]:
                    success = self._unmount_device(partition["mountpoint"])
                    if not success:
                        unmount_failed.append(partition["mountpoint"])
            
            # If any unmount operations failed, return error
            if unmount_failed:
                return {
                    "success": False,
                    "message": f"Failed to unmount points: {', '.join(unmount_failed)}"
                }
            
            # Try to power down the drive with udisks2 (if available)
            try:
                # Get just the device name without /dev/ prefix
                device_name = os.path.basename(device_path)
                result = subprocess.run(
                    ["udisksctl", "power-off", "-b", device_name],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    return {
                        "success": True,
                        "message": f"Drive {device_path} safely ejected and powered down"
                    }
                else:
                    return {
                        "success": True,
                        "message": f"Drive {device_path} unmounted, but could not be powered down: {result.stderr}"
                    }
            except FileNotFoundError:
                # udisksctl not available
                return {
                    "success": True,
                    "message": f"Drive {device_path} unmounted. Please wait a few seconds before disconnecting"
                }
                
        except Exception as e:
            logger.error(f"Error ejecting drive {device_path}: {str(e)}")
            return {
                "success": False,
                "message": f"Error ejecting drive: {str(e)}"
            }
            
    def _unmount_device(self, mount_point) -> bool:
        """Helper method to unmount a device at a specific mount point"""
        try:
            # First try unmounting without sudo
            result = subprocess.run(
                ["umount", mount_point], 
                capture_output=True, 
                text=True
            )
            
            if result.returncode == 0:
                logger.info(f"Successfully unmounted {mount_point}")
                return True
                
            # If that fails, try with sudo
            result = subprocess.run(
                ["sudo", "umount", mount_point], 
                capture_output=True, 
                text=True
            )
            
            if result.returncode == 0:
                logger.info(f"Successfully unmounted {mount_point} with sudo")
                return True
            else:
                logger.error(f"Failed to unmount {mount_point}: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error during unmount of {mount_point}: {str(e)}")
            return False