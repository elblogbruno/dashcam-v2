from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
import os

router = APIRouter()

# Will be initialized from main.py
disk_manager = None

# Storage management endpoints
@router.get("/status")
async def get_storage_status():
    """Get current storage status and disk information"""
    disk_info = disk_manager.get_disk_info()
    video_stats = disk_manager.get_video_stats()
    settings = disk_manager.get_storage_settings()
    
    return {
        "disk": disk_info,
        "videos": video_stats,
        "settings": settings
    }

@router.get("/disk-info")
async def get_disk_info():
    """Get disk information including capacity, usage, and mount status"""
    disk_info = disk_manager.get_disk_info()
    return disk_info

@router.get("/video-stats")
async def get_video_stats():
    """Get video statistics including total count, size, and distribution by month"""
    video_stats = disk_manager.get_video_stats()
    return video_stats

@router.post("/settings")
async def update_storage_settings(settings: Dict[str, Any]):
    """Update storage management settings"""
    success = disk_manager.update_storage_settings(settings)
    if success:
        return {"status": "success", "message": "Settings updated"}
    else:
        raise HTTPException(status_code=500, detail="Failed to update settings")

@router.post("/clean")
async def clean_old_videos(days: int = 30):
    """Clean up videos older than specified days"""
    result = disk_manager.clean_old_videos(days)
    return {
        "status": "success", 
        "deleted": result["deleted"],
        "freedSpace": result["freedSpace"]
    }

@router.post("/backup")
async def backup_videos(destination: str):
    """Backup videos to external location"""
    if not os.path.exists(destination):
        raise HTTPException(status_code=400, detail="Destination path does not exist")
        
    result = disk_manager.backup_videos(destination)
    return {
        "status": "success", 
        "copied": result["copied"],
        "totalSize": result["totalSize"],
        "location": result.get("backupLocation", "")
    }

@router.post("/archive")
async def archive_videos(archive_type: str = "standard"):
    """Compress old videos to save space"""
    if archive_type not in ["standard", "high-compression"]:
        raise HTTPException(status_code=400, detail="Invalid archive type")
        
    result = disk_manager.archive_videos(archive_type)
    return {
        "status": "success", 
        "archived": result["archived"],
        "savedSpace": result["savedSpace"]
    }

@router.post("/mount")
async def mount_storage_drive():
    """Mount the configured storage drive"""
    success = disk_manager.mount_drive()
    if success:
        return {"status": "success", "message": "Drive mounted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to mount drive")

@router.post("/unmount")
async def unmount_storage_drive():
    """Safely unmount the storage drive"""
    success = disk_manager.unmount_drive()
    if success:
        return {"status": "success", "message": "Drive unmounted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to unmount drive")

@router.get("/check")
async def check_storage_status():
    """Check storage status and perform cleanup if needed"""
    status = disk_manager.check_storage_status()
    return {"status": "success", "storageOk": status}

@router.get("/mount-status")
async def get_mount_status():
    """Get detailed mount status information to diagnose issues"""
    mount_point = disk_manager.settings.get("mountPoint")
    drive = disk_manager.settings.get("mainDrive")
    
    # Check if mount point exists
    mount_point_exists = os.path.exists(mount_point)
    is_mounted = os.path.ismount(mount_point) if mount_point_exists else False
    
    # Check mount point permissions
    mount_point_permissions = None
    if mount_point_exists:
        try:
            import stat
            st = os.stat(mount_point)
            permissions = oct(st.st_mode)[-3:]
            owner = st.st_uid
            group = st.st_gid
            
            # Try to get owner and group names
            try:
                import pwd, grp
                owner_name = pwd.getpwuid(owner).pw_name
                group_name = grp.getgrgid(group).gr_name
            except:
                owner_name = str(owner)
                group_name = str(group)
                
            mount_point_permissions = {
                "permissions": permissions,
                "owner": owner_name,
                "group": group_name
            }
        except Exception as e:
            mount_point_permissions = {"error": str(e)}
    
    # Check if drive exists
    drive_exists = os.path.exists(drive)
    
    # Get current process user and groups
    current_user = None
    try:
        import pwd, os
        current_user = {
            "uid": os.getuid(),
            "username": pwd.getpwuid(os.getuid()).pw_name,
            "gid": os.getgid(),
            "groupname": grp.getgrgid(os.getgid()).gr_name
        }
    except Exception as e:
        current_user = {"error": str(e)}
        
    return {
        "mountPoint": mount_point,
        "mountPointExists": mount_point_exists,
        "isMounted": is_mounted,
        "drive": drive,
        "driveExists": drive_exists,
        "permissions": mount_point_permissions,
        "currentUser": current_user,
        "setupCommands": [
            f"sudo mkdir -p {mount_point}",
            f"sudo chown $USER:$USER {mount_point}",
            f"sudo chmod 755 {mount_point}",
            f"echo '{drive} {mount_point} auto defaults,user 0 0' | sudo tee -a /etc/fstab"
        ]
    }

@router.post("/repair-permissions")
async def repair_mount_permissions():
    """Attempt to repair mount point permissions"""
    mount_point = disk_manager.settings.get("mountPoint")
    
    if not os.path.exists(mount_point):
        try:
            os.makedirs(mount_point, exist_ok=True)
            return {"status": "success", "message": f"Created mount point at {mount_point}"}
        except PermissionError:
            return {
                "status": "error", 
                "message": f"Permission denied when creating mount point. Run this command: sudo mkdir -p {mount_point}"
            }
    else:
        return {
            "status": "info", 
            "message": f"Mount point already exists at {mount_point}. To fix permissions, run: sudo chown $USER:$USER {mount_point}"
        }