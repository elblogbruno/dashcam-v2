#!/bin/bash

# Find the first available USB drive (assuming it's not mounted)
DEVICE=$(lsblk -o NAME,TRAN | grep usb | awk '{print $1}' | head -n 1)

if [ -z "$DEVICE" ]; then
    echo "No USB drive detected."
    exit 1
fi

MOUNT_POINT="/mnt/usb"

# Create mount point if it doesn't exist
mkdir -p "$MOUNT_POINT"

# Try to mount the first partition (e.g., sda1)
PARTITION="/dev/${DEVICE}1"
if [ ! -b "$PARTITION" ]; then
    # If no partition, try the whole device
    PARTITION="/dev/${DEVICE}"
fi

mount "$PARTITION" "$MOUNT_POINT"

if [ $? -eq 0 ]; then
    echo "USB drive mounted at $MOUNT_POINT"
else
    echo "Failed to mount USB drive."
    exit 1
fi