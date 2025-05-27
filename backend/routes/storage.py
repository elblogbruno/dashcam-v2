from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import os
import pwd
import grp
import stat

router = APIRouter()

# Referencias a módulos que serán inicializados desde main.py
disk_manager = None
hdd_copy_module = None  # Agregado para manejo de HDD Copy

# Modelos Pydantic para los parámetros de entrada
class DriveSettings(BaseModel):
    autoDetectDrives: Optional[bool] = None
    mainDrive: Optional[str] = None
    mountPoint: Optional[str] = None
    autoCleanEnabled: Optional[bool] = None
    autoCleanThreshold: Optional[int] = None
    autoCleanDays: Optional[int] = None

class MountDriveRequest(BaseModel):
    device: Optional[str] = None

class CleanupRequest(BaseModel):
    days: int = 30

class HDDCopyRequest(BaseModel):
    destination: Optional[str] = None

class DeviceEjectRequest(BaseModel):
    device_path: str

# Storage management endpoints
@router.get("/status")
async def get_storage_status():
    """Get current storage status and disk information"""
    disk_info = disk_manager.get_disk_info()
    video_stats = disk_manager.get_video_stats()
    settings = disk_manager.settings
    
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

@router.get("/settings")
async def get_storage_settings():
    """Get storage settings"""
    return disk_manager.settings

@router.post("/settings")
async def update_storage_settings(settings: DriveSettings):
    """Update storage management settings"""
    # Convert Pydantic model to dict, excluding None values
    settings_dict = {k: v for k, v in settings.dict().items() if v is not None}
    success = disk_manager.apply_settings(settings_dict)
    
    if success:
        return {"success": True, "message": "Settings updated successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to update settings")

@router.post("/clean")
async def clean_old_videos(request: CleanupRequest):
    """Clean up videos older than specified days"""
    result = disk_manager.clean_old_videos(request.days)
    return {
        "success": True, 
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
        "success": True, 
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
        "success": True, 
        "archived": result["archived"],
        "savedSpace": result["savedSpace"]
    }

@router.post("/mount")
async def mount_storage_drive(request: Optional[MountDriveRequest] = None):
    """Mount the configured storage drive or a specific device"""
    device = None
    if request and request.device:
        device = request.device
        
    success = disk_manager.mount_drive(device)
    if success:
        return {"success": True, "message": "Drive mounted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to mount drive")

@router.post("/unmount")
async def unmount_storage_drive():
    """Safely unmount the storage drive"""
    success = disk_manager.unmount_drive()
    if success:
        return {"success": True, "message": "Drive unmounted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to unmount drive")

@router.get("/detect-drives")
async def detect_usb_drives():
    """Detect all connected USB drives"""
    drives = disk_manager.detect_usb_drives()
    return {"drives": drives}

@router.get("/disks")
async def get_disks():
    """Get information about all connected disks including USB drives"""
    try:
        usb_drives = disk_manager.detect_usb_drives()
        # Formatear los datos para que coincidan con lo que espera el frontend
        formatted_drives = []
        
        for drive in usb_drives:
            formatted_drive = {
                "name": drive.get("name", ""),
                "model": drive.get("model", "Dispositivo USB"),
                "size": drive.get("size", ""),
                "type": "usb",  # Marcar como USB
                "mounted": drive.get("mounted", False),
                "mountpoint": drive.get("mountpoint"),
                "partitions": drive.get("partitions", [])
            }
            formatted_drives.append(formatted_drive)
        
        return {"disks": formatted_drives}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting disks: {str(e)}")

@router.get("/disk-details/{device_path:path}")
async def get_disk_details(device_path: str):
    """Get detailed information about a specific disk"""
    # Asegurarse de que el path comienza con /dev/
    if not device_path.startswith('/dev/'):
        device_path = f'/dev/{device_path}'
        
    details = disk_manager.get_disk_details(device_path)
    return details

@router.post("/eject/{device_path}")
async def eject_drive(device_path: str):
    """Safely eject a drive"""
    result = disk_manager.safely_eject_drive(device_path)
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result["message"])

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

# HDD Backup endpoints - Integrados desde hdd_backup.py
@router.post("/hdd-backup/start-copy")
async def start_copy_to_hdd(request: HDDCopyRequest = None):
    """Iniciar copia de videos a un disco duro externo"""
    if not hdd_copy_module:
        raise HTTPException(status_code=500, detail="Módulo de copia a HDD no inicializado")
    
    destination = request.destination if request and request.destination else None
    result = hdd_copy_module.start_copy_to_hdd(destination)
    
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=400, detail=result["message"])

@router.post("/hdd-backup/cancel-copy")
async def cancel_copy_operation():
    """Cancelar operación de copia en progreso"""
    if not hdd_copy_module:
        raise HTTPException(status_code=500, detail="Módulo de copia a HDD no inicializado")
    
    result = hdd_copy_module.cancel_copy_operation()
    
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=400, detail=result["message"])

@router.get("/hdd-backup/copy-status")
async def get_copy_status():
    """Obtener estado de la operación de copia"""
    if not hdd_copy_module:
        raise HTTPException(status_code=500, detail="Módulo de copia a HDD no inicializado")
    
    return hdd_copy_module.get_copy_status()

@router.post("/hdd-backup/eject-after-copy")
async def safely_eject_after_copy(request: DeviceEjectRequest = None):
    """Expulsar disco de forma segura después de la copia"""
    if not hdd_copy_module:
        raise HTTPException(status_code=500, detail="Módulo de copia a HDD no inicializado")
    
    device_path = request.device_path if request and hasattr(request, 'device_path') else None
    result = hdd_copy_module.safely_eject_after_copy(device_path)
    
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=400, detail=result["message"])