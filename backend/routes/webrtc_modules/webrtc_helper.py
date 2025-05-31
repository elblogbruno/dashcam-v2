"""
WebRTC Helper Module for improved stability and error recovery
"""
import asyncio
import logging
import os
import signal
import sys
import time
import traceback
from typing import Dict, Any, Optional, List, Set
from shutdown_control import should_continue_loop, register_task

# Configure logging
logger = logging.getLogger(__name__)

class WebRTCManager:
    """Manage WebRTC connections and provide recovery options"""
    
    def __init__(self):
        self.active_peers: Dict[str, Any] = {}
        self.pending_connections: Set[str] = set()
        self.last_error: Dict[str, Any] = {}
        self.start_time = time.time()
        self.initialized = False
        self.health_check_running = False
        
    async def initialize(self):
        """Initialize the WebRTC manager"""
        if self.initialized:
            return
            
        self.initialized = True
        # Begin health check task
        health_task = asyncio.create_task(self.health_check())
        register_task(health_task, "webrtc_health_check")
        logger.info("WebRTC Manager initialized")
        
    async def register_peer(self, peer_id: str, peer_connection: Any) -> bool:
        """Register a new peer connection"""
        self.active_peers[peer_id] = {
            'connection': peer_connection,
            'created': time.time(),
            'last_activity': time.time(),
            'camera_type': peer_id.split('_')[0] if '_' in peer_id else 'unknown'
        }
        logger.info(f"Registered new peer: {peer_id}, total: {len(self.active_peers)}")
        return True
        
    async def unregister_peer(self, peer_id: str) -> bool:
        """Unregister a peer connection"""
        if peer_id in self.active_peers:
            # Close the connection cleanly if possible
            try:
                if hasattr(self.active_peers[peer_id]['connection'], 'close'):
                    await self.active_peers[peer_id]['connection'].close()
            except Exception as e:
                logger.warning(f"Error closing peer connection {peer_id}: {e}")
                
            del self.active_peers[peer_id]
            logger.info(f"Unregistered peer: {peer_id}, remaining: {len(self.active_peers)}")
            return True
        return False
        
    async def cleanup_stale_connections(self, max_age_seconds: int = 300) -> int:
        """Clean up stale peer connections"""
        now = time.time()
        stale_peers = []
        
        for peer_id, peer_data in self.active_peers.items():
            age = now - peer_data['created']
            if age > max_age_seconds:
                stale_peers.append(peer_id)
                
        count = 0
        for peer_id in stale_peers:
            await self.unregister_peer(peer_id)
            count += 1
            
        if count > 0:
            logger.info(f"Cleaned up {count} stale peer connections")
        return count
        
    async def health_check(self, interval_seconds: int = 60) -> None:
        """Periodic health check for WebRTC subsystem"""
        if self.health_check_running:
            return
            
        self.health_check_running = True
        
        while should_continue_loop("webrtc"):
            try:
                # Wait for the specified interval
                await asyncio.sleep(interval_seconds)
                
                # Check again after sleep in case shutdown was requested
                if not should_continue_loop("webrtc"):
                    break
                
                # Perform health check
                logger.debug("Performing WebRTC health check")
                
                # Clean up stale connections
                await self.cleanup_stale_connections()
                
                # Log current status
                uptime = time.time() - self.start_time
                logger.info(f"WebRTC status - Uptime: {uptime:.1f}s, Active peers: {len(self.active_peers)}")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in WebRTC health check: {e}")
                
        self.health_check_running = False
        logger.info("🛑 WebRTC health check terminado")
        
    async def shutdown(self) -> None:
        """Shutdown all WebRTC connections"""
        logger.info("Shutting down WebRTC manager")
        
        # Close all active peer connections
        peer_ids = list(self.active_peers.keys())
        for peer_id in peer_ids:
            await self.unregister_peer(peer_id)
            
        self.initialized = False
        self.health_check_running = False
        logger.info("WebRTC manager shutdown complete")

# Create a single instance
webrtc_manager = WebRTCManager()

async def initialize_webrtc_helper():
    """Initialize the WebRTC helper system"""
    await webrtc_manager.initialize()

# Function to get active connections count
def get_active_connections() -> int:
    """Get count of active WebRTC connections"""
    return len(webrtc_manager.active_peers)
