# Smart Dashcam System

A comprehensive dashcam solution with GPS tracking, landmark notifications, and video management.

## Features

- **Dual Camera Recording**: Captures both road-facing and interior video
- **GPS Tracking**: Records your route with speed information
- **Landmark Detection**: Identifies and announces nearby points of interest
- **Video Management**: Browse, playback, and create summary time-lapses
- **External Video Upload**: Import videos from other cameras like Insta360
- **WiFi Hotspot**: Connect to the dashcam from your phone or tablet
- **Safe Shutdown**: Properly powers down when car is turned off

## Hardware Requirements

- Raspberry Pi 4 (recommended) or compatible single-board computer
- Raspberry Pi Camera Module v2 or higher (road-facing)
- USB webcam (interior-facing)
- GPS module (USB or GPIO connected)
- Power management circuit for safe shutdown
- microSD card (32GB+ recommended)
- Optional: WiFi adapter for hotspot functionality

## Software Requirements

- Python 3.7+
- Node.js 14+
- npm 6+
- ffmpeg

## Installation

1. Clone this repository to your Raspberry Pi or development machine:

```bash
git clone https://github.com/yourusername/smart-dashcam.git
cd smart-dashcam
```

2. Run the startup script which will set up the required dependencies:

```bash
./start.sh
```

The script will:
- Create a Python virtual environment
- Install Python dependencies
- Install and build the frontend
- Start both backend and frontend services

## Usage

### Starting the System

Simply run the start script:

```bash
./start.sh
```

Then access the dashboard by navigating to:
- If running locally: `http://localhost:4173`
- If using the WiFi hotspot: `http://192.168.4.1:4173`

### Dashboard

The main dashboard shows:
- Live camera feeds
- Current speed and location
- Recording controls
- Nearby landmark notifications

### Calendar

Browse your trip history by date:
- View recorded trips
- Play back videos
- Generate summary time-lapses
- View imported external videos

### Settings

Configure various aspects of the system:
- Audio notification settings
- Video quality settings
- WiFi hotspot configuration
- Upload external videos
- Sync landmarks database

## Development

### Backend

The backend is built with Python using FastAPI:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r ../requirements.txt
python main.py
```

### Frontend

The frontend is built with React and TailwindCSS:

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
smart-dashcam/
├── backend/              # Python backend
│   ├── audio_notifier.py # Text-to-speech for landmarks
│   ├── camera_manager.py # Manages camera recording
│   ├── gps_reader.py     # Reads GPS data
│   ├── landmark_checker.py # Detects landmarks
│   ├── main.py           # FastAPI server
│   ├── shutdown_monitor.py # Power management
│   ├── trip_logger.py    # Records trip data
│   ├── video_maker.py    # Creates summary videos
│   └── data/             # Backend data files
├── data/                 # Main data storage
├── frontend/             # React frontend
│   ├── public/           # Static assets
│   └── src/              # React components
├── requirements.txt      # Python dependencies
└── start.sh              # Startup script
```

## License

[MIT License](LICENSE)

## Acknowledgments

- Built with FastAPI, React, and TailwindCSS
- Uses OpenStreetMap data for landmark information
- Powered by ffmpeg for video processing