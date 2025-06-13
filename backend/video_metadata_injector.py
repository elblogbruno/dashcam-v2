#!/usr/bin/env python3
"""
Video Metadata Injector for Dashcam System
Injects GPS coordinates and other metadata directly into video files
"""

import os
import logging
import tempfile
from datetime import datetime
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

class VideoMetadataInjector:
    """Handles injection of GPS and other metadata into video files"""
    
    def __init__(self):
        self.temp_dir = tempfile.gettempdir()
        
    def inject_gps_metadata(self, video_path, gps_data, clip_info=None):
        """
        Inject GPS metadata directly into video file
        
        Args:
            video_path (str): Path to the video file
            gps_data (list): List of GPS coordinates [(timestamp, trip_id, lat, lon), ...]
            clip_info (dict): Additional clip information (landmarks, etc.)
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # For now, we'll use ffmpeg-python if available, otherwise create sidecar files
            try:
                import ffmpeg
                return self._inject_with_ffmpeg(video_path, gps_data, clip_info)
            except ImportError:
                logger.warning("ffmpeg-python not available, creating sidecar files only")
                return self._create_sidecar_files(video_path, gps_data, clip_info)
                
        except Exception as e:
            logger.error(f"Error injecting GPS metadata into {video_path}: {str(e)}")
            return False
    
    def _inject_with_ffmpeg(self, video_path, gps_data, clip_info):
        """Inject metadata using ffmpeg-python"""
        import ffmpeg
        
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return False
            
        if not gps_data or len(gps_data) == 0:
            logger.warning(f"No GPS data provided for video: {video_path}")
            return False
        
        # Create temporary output file
        temp_output = os.path.join(self.temp_dir, f"temp_{os.path.basename(video_path)}")
        
        try:
            # Prepare metadata for injection
            metadata_dict = self._prepare_video_metadata(gps_data, clip_info)
            
            # Build ffmpeg command with metadata
            input_stream = ffmpeg.input(video_path)
            
            # Add metadata to the video
            output_stream = ffmpeg.output(
                input_stream,
                temp_output,
                **metadata_dict,
                vcodec='copy',  # Don't re-encode video
                acodec='copy',  # Don't re-encode audio
                map_metadata=0  # Copy existing metadata
            )
            
            # Run ffmpeg command
            ffmpeg.run(output_stream, overwrite_output=True, quiet=True)
            
            # Replace original file with metadata-enriched version
            if os.path.exists(temp_output):
                os.replace(temp_output, video_path)
                logger.info(f"Successfully injected GPS metadata into {video_path}")
                
                # Create sidecar files
                self._create_sidecar_files(video_path, gps_data, clip_info)
                
                return True
            else:
                logger.error(f"Failed to create metadata-enriched video: {temp_output}")
                return False
                
        except Exception as e:
            logger.error(f"ffmpeg error: {str(e)}")
            # Clean up temp file if it exists
            if os.path.exists(temp_output):
                try:
                    os.remove(temp_output)
                except:
                    pass
            # Fall back to sidecar files
            return self._create_sidecar_files(video_path, gps_data, clip_info)
    
    def _create_sidecar_files(self, video_path, gps_data, clip_info):
        """Create sidecar GPX and JSON files alongside the video"""
        try:
            success = True
            
            # Create GPX track
            gpx_content = self._create_gpx_track(gps_data, clip_info)
            if gpx_content:
                gpx_path = os.path.splitext(video_path)[0] + '.gpx'
                with open(gpx_path, 'w', encoding='utf-8') as f:
                    f.write(gpx_content)
                logger.info(f"Created GPX file: {gpx_path}")
            else:
                success = False
            
            # Create JSON metadata file
            metadata = self._prepare_video_metadata(gps_data, clip_info)
            if metadata:
                json_path = os.path.splitext(video_path)[0] + '_metadata.json'
                import json
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata, f, indent=2)
                logger.info(f"Created metadata JSON file: {json_path}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error creating sidecar files: {str(e)}")
            return False
    
    def _prepare_video_metadata(self, gps_data, clip_info=None):
        """Prepare metadata dictionary for ffmpeg"""
        metadata = {}
        
        if gps_data and len(gps_data) > 0:
            # Get start and end coordinates
            start_coord = gps_data[0]
            end_coord = gps_data[-1]
            
            # Handle both dictionary and tuple formats for GPS data
            if isinstance(start_coord, dict):
                # Dictionary format from database (get_gps_track_for_trip)
                start_lat = start_coord['latitude']
                start_lon = start_coord['longitude']
                end_lat = end_coord['latitude']
                end_lon = end_coord['longitude']
            else:
                # Tuple format (timestamp, trip_id, lat, lon, ...)
                start_lat = start_coord[2]
                start_lon = start_coord[3]
                end_lat = end_coord[2]
                end_lon = end_coord[3]
            
            # Add GPS coordinates as metadata
            metadata['metadata:gps_start_lat'] = f"{start_lat:.8f}"
            metadata['metadata:gps_start_lon'] = f"{start_lon:.8f}"
            metadata['metadata:gps_end_lat'] = f"{end_lat:.8f}"
            metadata['metadata:gps_end_lon'] = f"{end_lon:.8f}"
            
            # Add coordinate count
            metadata['metadata:gps_point_count'] = str(len(gps_data))
            
            # Create simplified track as metadata (every 10th point to avoid size issues)
            simplified_track = gps_data[::10]  # Take every 10th point
            track_data = []
            for coord in simplified_track:
                if isinstance(coord, dict):
                    lat, lon = coord['latitude'], coord['longitude']
                else:
                    lat, lon = coord[2], coord[3]
                track_data.append(f"{lat:.6f},{lon:.6f}")
            
            metadata['metadata:gps_track'] = "|".join(track_data)
        
        # Add clip information
        if clip_info:
            if 'sequence' in clip_info:
                metadata['metadata:clip_sequence'] = str(clip_info['sequence'])
            
            if 'quality' in clip_info:
                metadata['metadata:recording_quality'] = str(clip_info['quality'])
            
            if 'landmark_id' in clip_info and clip_info.get('near_landmark'):
                metadata['metadata:landmark_id'] = str(clip_info['landmark_id'])
                metadata['metadata:landmark_nearby'] = 'true'
                
                if 'landmark_type' in clip_info:
                    metadata['metadata:landmark_type'] = str(clip_info['landmark_type'])
            
            if 'start_time' in clip_info:
                metadata['metadata:clip_start_time'] = str(clip_info['start_time'])
            
            if 'end_time' in clip_info:
                metadata['metadata:clip_end_time'] = str(clip_info['end_time'])
        
        # Add creation timestamp
        metadata['metadata:gps_injection_time'] = datetime.now().isoformat()
        metadata['metadata:dashcam_system'] = 'dashcam-v2'
        
        return metadata
    
    def _create_gpx_track(self, gps_data, clip_info=None):
        """Create GPX XML content from GPS data"""
        try:
            # Create GPX root element
            gpx = ET.Element('gpx')
            gpx.set('version', '1.1')
            gpx.set('creator', 'dashcam-v2')
            gpx.set('xmlns', 'http://www.topografix.com/GPX/1/1')
            
            # Add track
            trk = ET.SubElement(gpx, 'trk')
            
            # Track name
            name = ET.SubElement(trk, 'name')
            if clip_info and 'start_time' in clip_info:
                name.text = f"Dashcam Track - {clip_info['start_time']}"
            else:
                name.text = f"Dashcam Track - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            
            # Track segment
            trkseg = ET.SubElement(trk, 'trkseg')
            
            # Add track points
            for coord in gps_data:
                trkpt = ET.SubElement(trkseg, 'trkpt')
                
                # Handle both dictionary and tuple formats
                if isinstance(coord, dict):
                    # Dictionary format from database
                    trkpt.set('lat', f"{coord['latitude']:.8f}")
                    trkpt.set('lon', f"{coord['longitude']:.8f}")
                    
                    # Add timestamp if available
                    if 'timestamp' in coord and coord['timestamp']:
                        time_elem = ET.SubElement(trkpt, 'time')
                        if isinstance(coord['timestamp'], str):
                            # Parse ISO format timestamp
                            time_elem.text = coord['timestamp'] + ('Z' if 'Z' not in coord['timestamp'] else '')
                        else:
                            time_elem.text = coord['timestamp'].isoformat() + 'Z'
                    
                    # Add elevation if available
                    if 'altitude' in coord and coord['altitude'] is not None:
                        ele_elem = ET.SubElement(trkpt, 'ele')
                        ele_elem.text = str(coord['altitude'])
                else:
                    # Tuple format (timestamp, trip_id, lat, lon, ...)
                    trkpt.set('lat', f"{coord[2]:.8f}")
                    trkpt.set('lon', f"{coord[3]:.8f}")
                    
                    # Add timestamp if available
                    if coord[0]:
                        time_elem = ET.SubElement(trkpt, 'time')
                        if isinstance(coord[0], datetime):
                            time_elem.text = coord[0].isoformat() + 'Z'
                        else:
                            # Assume it's a timestamp
                            time_elem.text = datetime.fromtimestamp(coord[0]).isoformat() + 'Z'
            
            # Convert to string
            return ET.tostring(gpx, encoding='unicode', xml_declaration=True)
            
        except Exception as e:
            logger.error(f"Error creating GPX track: {str(e)}")
            return None
    
    def extract_gps_metadata(self, video_path):
        """
        Extract GPS metadata from a video file
        
        Args:
            video_path (str): Path to the video file
            
        Returns:
            dict: Extracted GPS metadata or None if not found
        """
        try:
            # First try to read from sidecar JSON file
            json_path = os.path.splitext(video_path)[0] + '_metadata.json'
            if os.path.exists(json_path):
                import json
                with open(json_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                    return metadata
            
            # Try to use ffmpeg if available
            try:
                import ffmpeg
                if not os.path.exists(video_path):
                    logger.error(f"Video file not found: {video_path}")
                    return None
                
                # Use ffprobe to extract metadata
                probe = ffmpeg.probe(video_path)
                
                # Look for GPS metadata in format tags
                metadata = {}
                
                if 'format' in probe and 'tags' in probe['format']:
                    tags = probe['format']['tags']
                    
                    # Extract GPS coordinates
                    for key, value in tags.items():
                        if key.lower().startswith('gps_') or key.lower().startswith('metadata:gps_'):
                            clean_key = key.replace('metadata:', '').lower()
                            metadata[clean_key] = value
                    
                    # Extract other dashcam metadata
                    for key, value in tags.items():
                        if (key.lower().startswith('metadata:clip_') or 
                            key.lower().startswith('metadata:landmark_') or
                            key.lower().startswith('metadata:recording_')):
                            clean_key = key.replace('metadata:', '').lower()
                            metadata[clean_key] = value
                
                return metadata if metadata else None
                
            except ImportError:
                logger.warning("ffmpeg-python not available for metadata extraction")
                return None
            
        except Exception as e:
            logger.error(f"Error extracting GPS metadata from {video_path}: {str(e)}")
            return None
    
    def prepare_gps_metadata(self, gps_data, clip_info=None):
        """
        Prepare GPS metadata for injection into video files
        This method is used by test scripts to validate metadata preparation
        
        Args:
            gps_data (list): List of GPS coordinates [(timestamp, trip_id, lat, lon), ...] or dicts
            clip_info (dict): Additional clip information (landmarks, etc.)
        
        Returns:
            dict: Prepared metadata dictionary with additional test fields
        """
        # Get basic metadata for video injection
        basic_metadata = self._prepare_video_metadata(gps_data, clip_info)
        
        # Add additional fields for test validation
        if gps_data and len(gps_data) > 0:
            # Create waypoints array for test validation
            waypoints = []
            min_lat = min_lon = float('inf')
            max_lat = max_lon = float('-inf')
            
            for coord in gps_data:
                if isinstance(coord, dict):
                    lat, lon = coord['latitude'], coord['longitude']
                    timestamp = coord.get('timestamp', '')
                else:
                    lat, lon = coord[2], coord[3]
                    timestamp = coord[0] if len(coord) > 0 else ''
                
                waypoints.append({
                    'lat': lat,
                    'lon': lon,
                    'timestamp': timestamp
                })
                
                # Update bounds
                min_lat = min(min_lat, lat)
                max_lat = max(max_lat, lat)
                min_lon = min(min_lon, lon)
                max_lon = max(max_lon, lon)
            
            # Calculate approximate distance (simple haversine for first/last points)
            if len(waypoints) >= 2:
                import math
                
                first = waypoints[0]
                last = waypoints[-1]
                
                lat1, lon1 = math.radians(first['lat']), math.radians(first['lon'])
                lat2, lon2 = math.radians(last['lat']), math.radians(last['lon'])
                
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                
                a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                distance_km = 6371 * c  # Earth radius in km
            else:
                distance_km = 0.0
            
            # Add test validation fields
            basic_metadata.update({
                'waypoints': waypoints,
                'bounds': {
                    'min_lat': min_lat if min_lat != float('inf') else 0,
                    'max_lat': max_lat if max_lat != float('-inf') else 0,
                    'min_lon': min_lon if min_lon != float('inf') else 0,
                    'max_lon': max_lon if max_lon != float('-inf') else 0
                },
                'total_distance_km': distance_km,
                'point_count': len(waypoints)
            })
        
        return basic_metadata
    
    def create_gpx_track(self, gps_data, clip_info=None):
        """
        Create GPX track content from GPS data
        Public method for test scripts
        
        Args:
            gps_data (list): List of GPS coordinates [(timestamp, trip_id, lat, lon), ...]
            clip_info (dict): Additional clip information (landmarks, etc.)
        
        Returns:
            str: GPX content as XML string
        """
        return self._create_gpx_track(gps_data, clip_info)
    

# Utility functions for integration
def inject_gps_into_video(video_path, gps_data, clip_info=None):
    """Convenience function for single video GPS injection"""
    injector = VideoMetadataInjector()
    return injector.inject_gps_metadata(video_path, gps_data, clip_info)

def extract_gps_from_video(video_path):
    """Convenience function for extracting GPS from video"""
    injector = VideoMetadataInjector()
    return injector.extract_gps_metadata(video_path)
