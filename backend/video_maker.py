import os
import logging
import json
import time
import asyncio
import glob
from datetime import datetime, date, timedelta
import random
import subprocess
from typing import List, Dict, Optional, Any

# Import the centralized config if available
try:
    from config import config
except ImportError:
    config = None

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class VideoMaker:
    def __init__(self, data_path=None):
        # Base directory for video data - prioritize parameter, then config, then fallback
        if data_path:
            self.base_data_dir = data_path
        elif config:
            self.base_data_dir = config.data_path
        else:
            self.base_data_dir = os.environ.get('DASHCAM_DATA_PATH') or os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
        
        # Directory for music files
        if config:
            self.music_dir = os.path.join(config.data_path, 'music')
        else:
            self.music_dir = os.path.join(self.base_data_dir, 'music')
        
        # Ensure music directory exists
        os.makedirs(self.music_dir, exist_ok=True)
        
        # Default ffmpeg settings
        self.ffmpeg_path = 'ffmpeg'  # Assumes ffmpeg is in PATH
        self.default_width = 1280
        self.default_height = 720
        self.default_framerate = 30
        self.default_bitrate = '4000k'
        
        # Check for ffmpeg availability
        self._check_ffmpeg()
        
    def _check_ffmpeg(self):
        """Verify that ffmpeg is available"""
        try:
            result = subprocess.run([self.ffmpeg_path, '-version'], 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE,
                                   text=True)
            if result.returncode == 0:
                logger.info(f"ffmpeg detected: {result.stdout.splitlines()[0]}")
            else:
                logger.warning("ffmpeg not found or returned an error")
        except Exception as e:
            logger.error(f"Error checking ffmpeg: {str(e)}")
            
    async def create_daily_summary(self, target_date):
        """Create a summary video for the given date"""
        try:
            date_str = target_date.strftime("%Y-%m-%d")
            logger.info(f"Starting to create summary video for {date_str}")
            
            # Output directory is the date folder
            output_dir = os.path.join(self.base_data_dir, date_str)
            
            # Create output directory if it doesn't exist
            if not os.path.exists(output_dir):
                logger.warning(f"No directory found for date {date_str}, creating it")
                os.makedirs(output_dir)
                
            # Output file path
            output_file = os.path.join(output_dir, 'summary.mp4')
            
            # If a summary already exists, create a new version
            if os.path.exists(output_file):
                timestamp = datetime.now().strftime("%H%M%S")
                output_file = os.path.join(output_dir, f'summary-{timestamp}.mp4')
                
            # Find all video files for this date
            road_videos = sorted(glob.glob(os.path.join(output_dir, '*-road.mp4')))
            interior_videos = sorted(glob.glob(os.path.join(output_dir, '*-interior.mp4')))
            
            # Check if we have any videos to process
            if not road_videos and not interior_videos:
                logger.warning(f"No videos found for date {date_str}")
                return None
                
            # Create a time-lapse from the road videos
            if road_videos:
                # Create a temporary file list for ffmpeg
                file_list_path = os.path.join(output_dir, 'filelist.txt')
                with open(file_list_path, 'w') as f:
                    for video in road_videos:
                        f.write(f"file '{video}'\n")
                
                # Choose a random background music file if available
                music_files = glob.glob(os.path.join(self.music_dir, '*.mp3'))
                music_file = random.choice(music_files) if music_files else None
                
                # Create the summary video
                await self._create_summary_video(file_list_path, output_file, music_file)
                
                # Clean up the temporary file list
                os.remove(file_list_path)
                
                logger.info(f"Created summary video: {output_file}")
                return output_file
            else:
                logger.warning("No road videos found, cannot create summary")
                return None
                
        except Exception as e:
            logger.error(f"Error creating daily summary: {str(e)}")
            return None
            
    async def _create_summary_video(self, file_list, output_file, music_file=None, speed_factor=10):
        """Create a summary video from the file list with optional music"""
        try:
            # Base ffmpeg command for concatenating videos and speeding them up
            cmd = [
                self.ffmpeg_path,
                '-f', 'concat',
                '-safe', '0',
                '-i', file_list,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-b:v', self.default_bitrate,
                '-filter_complex', f'setpts=PTS/{speed_factor}'  # Speed up video
            ]
            
            # Add music if specified
            if music_file and os.path.exists(music_file):
                cmd.extend([
                    '-i', music_file,
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-shortest'  # End when video or audio ends, whichever is shorter
                ])
            else:
                # No audio
                cmd.extend(['-an'])
                
            # Output file
            cmd.extend(['-y', output_file])
            
            # Run ffmpeg command asynchronously
            logger.info(f"Running ffmpeg command: {' '.join(cmd)}")
            
            # Create subprocess
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Wait for the process to complete
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.info(f"Successfully created summary video: {output_file}")
                return True
            else:
                logger.error(f"Error creating summary video: {stderr.decode()}")
                return False
                
        except Exception as e:
            logger.error(f"Error in _create_summary_video: {str(e)}")
            return False
            
    async def create_timelapse(self, date_str, output_file, interval_frames=10):
        """Create a time-lapse by selecting frames at intervals"""
        try:
            # Directory for this date
            date_dir = os.path.join(self.base_data_dir, date_str)
            
            if not os.path.exists(date_dir):
                logger.error(f"No directory found for date {date_str}")
                return None
                
            # Find all road videos
            road_videos = sorted(glob.glob(os.path.join(date_dir, '*-road.mp4')))
            
            if not road_videos:
                logger.warning(f"No road videos found for date {date_str}")
                return None
                
            # Create a temporary directory for frames
            temp_dir = os.path.join(date_dir, 'temp_frames')
            os.makedirs(temp_dir, exist_ok=True)
            
            # Extract frames at intervals
            for i, video in enumerate(road_videos):
                cmd = [
                    self.ffmpeg_path,
                    '-i', video,
                    '-vf', f'select=not(mod(n\,{interval_frames}))',
                    '-vsync', 'vfr',
                    '-q:v', '2',
                    os.path.join(temp_dir, f'frame_{i}_%04d.jpg')
                ]
                
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                await process.communicate()
                
            # Create video from frames
            cmd = [
                self.ffmpeg_path,
                '-framerate', '30',
                '-pattern_type', 'glob',
                '-i', os.path.join(temp_dir, '*.jpg'),
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-y', output_file
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            await process.communicate()
            
            # Clean up temporary frames
            import shutil
            shutil.rmtree(temp_dir)
            
            return output_file
            
        except Exception as e:
            logger.error(f"Error creating timelapse: {str(e)}")
            return None
            
    async def extract_landmark_clips(self, date_str, landmarks_data, output_dir=None):
        """Extract short clips around landmark encounters"""
        try:
            # Set output directory
            if output_dir is None:
                output_dir = os.path.join(self.base_data_dir, date_str, 'landmarks')
                
            # Create output directory if it doesn't exist
            os.makedirs(output_dir, exist_ok=True)
            
            # Base directory for this date's videos
            date_dir = os.path.join(self.base_data_dir, date_str)
            
            # For each landmark encounter
            for landmark in landmarks_data:
                try:
                    # Get the timestamp of the encounter
                    encounter_time = datetime.fromisoformat(landmark['encounter_time'])
                    encounter_hour = encounter_time.hour
                    encounter_minute = encounter_time.minute
                    
                    # Look for videos that might contain this time
                    # Format is typically "HH-MM-road.mp4"
                    # We need to find videos that cover the encounter time
                    video_pattern = f"{encounter_hour:02d}-{encounter_minute:02d}*-road.mp4"
                    matching_videos = glob.glob(os.path.join(date_dir, video_pattern))
                    
                    if not matching_videos:
                        # Try looking for any videos in the hour
                        video_pattern = f"{encounter_hour:02d}-*-road.mp4"
                        matching_videos = glob.glob(os.path.join(date_dir, video_pattern))
                        
                    if not matching_videos:
                        logger.warning(f"No videos found for landmark encounter: {landmark['landmark_name']}")
                        continue
                        
                    # Use the first matching video
                    source_video = matching_videos[0]
                    
                    # Output file name
                    landmark_slug = landmark['landmark_name'].lower().replace(' ', '_')
                    output_file = os.path.join(output_dir, f"{encounter_hour:02d}{encounter_minute:02d}_{landmark_slug}.mp4")
                    
                    # Extract a 30-second clip centered on the encounter time
                    # First, we need to determine the start time in the video
                    video_start_time = os.path.basename(source_video).split('-')[0:2]
                    video_start_hour = int(video_start_time[0])
                    video_start_minute = int(video_start_time[1])
                    
                    # Calculate minutes from the start of the video
                    minutes_from_start = (encounter_hour - video_start_hour) * 60 + (encounter_minute - video_start_minute)
                    seconds_from_start = minutes_from_start * 60
                    
                    # Extract a 30-second clip (15 seconds before and after the encounter)
                    clip_start = max(0, seconds_from_start - 15)
                    
                    cmd = [
                        self.ffmpeg_path,
                        '-ss', str(clip_start),
                        '-i', source_video,
                        '-t', '30',
                        '-c:v', 'copy',
                        '-y', output_file
                    ]
                    
                    process = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    
                    await process.communicate()
                    
                    logger.info(f"Extracted landmark clip: {output_file}")
                    
                except Exception as e:
                    logger.error(f"Error extracting clip for landmark {landmark.get('landmark_name', 'unknown')}: {str(e)}")
                    
            return output_dir
            
        except Exception as e:
            logger.error(f"Error extracting landmark clips: {str(e)}")
            return None

    def cleanup(self):
        """Clean up resources before shutdown"""
        logger.info("Cleaning up VideoMaker resources")
        
        # Cancel any running asyncio tasks
        try:
            # Get all running tasks
            for task in asyncio.all_tasks():
                if not task.done() and task != asyncio.current_task():
                    # Cancel the task
                    task.cancel()
                    logger.info("Cancelled running video processing task")
        except Exception as e:
            logger.error(f"Error cancelling video tasks: {str(e)}")
            
        logger.info("VideoMaker cleanup completed")