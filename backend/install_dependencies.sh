#!/bin/bash
# Script to install required dependencies for the backend

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing system dependencies..."
apt-get update
apt-get install -y python3-pil

# Create tools directory if it doesn't exist
mkdir -p ./data/tools

# Copy MWM extractor tool to tools directory
cp ./tools/mwm_extractor.py ./data/tools/

echo "Installation complete."
echo "You can now run the backend with: uvicorn main:app --reload"
