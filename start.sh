#!/bin/bash

# Smart Dashcam Startup Script
# This script starts both the backend Python API and the frontend React app

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Create data directory if it doesn't exist
mkdir -p data

# Set environment variables for path configuration
export DASHCAM_BASE_PATH="$SCRIPT_DIR"
export DASHCAM_DATA_PATH="$SCRIPT_DIR/data"
export DASHCAM_DB_PATH="$SCRIPT_DIR/data/recordings.db"

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for required dependencies
echo "Checking dependencies..."

if ! command_exists python3; then
  echo "Error: Python 3 is required but not installed."
  exit 1
fi

if ! command_exists npm; then
  echo "Error: npm is required but not installed."
  exit 1
fi

# Install Python dependencies if needed
if [ ! -d "venv" ]; then
  echo "Setting up Python virtual environment..."
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
else
  source venv/bin/activate
fi

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd frontend
  npm install
  cd ..
fi

# Build frontend for production
echo "Building frontend..."
cd frontend
npm run build
cd ..

# Function to clean up on exit
cleanup() {
  echo "Shutting down services..."
  kill $BACKEND_PID
  kill $FRONTEND_PID
  exit 0
}

# Set trap for clean exit
trap cleanup SIGINT SIGTERM

# Start backend server
echo "Starting backend server..."
cd backend
python main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "Error: Backend failed to start."
  exit 1
fi

echo "Backend running with PID: $BACKEND_PID"

# Start frontend development server
echo "Starting frontend server..."
cd frontend
npm run preview &
FRONTEND_PID=$!
cd ..

# Check if frontend started successfully
sleep 2
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  echo "Error: Frontend failed to start."
  kill $BACKEND_PID
  exit 1
fi

echo "Frontend running with PID: $FRONTEND_PID"

echo ""
echo "Smart Dashcam is now running!"
echo "Access the dashboard at: http://localhost:4173"
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for processes to finish
wait $BACKEND_PID $FRONTEND_PID