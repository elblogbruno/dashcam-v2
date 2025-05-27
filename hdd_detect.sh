#!/bin/bash

# Monitor for new USB drives and print a message when detected

# Get initial list of connected USB drives
get_usb_drives() {
    lsblk -o NAME,TRAN | awk '$2=="usb"{print $1}'
}

prev_drives=$(get_usb_drives)

while true; do
    sleep 2
    curr_drives=$(get_usb_drives)
    new_drives=$(comm -13 <(echo "$prev_drives" | sort) <(echo "$curr_drives" | sort))
    if [[ -n "$new_drives" ]]; then
        echo "New USB drive(s) detected: $new_drives"

        # print files in the new drives
        for drive in $new_drives; do
            mount_point="/mnt/$drive"
            mkdir -p "$mount_point"
            if mount | grep -q "$mount_point"; then
                echo "Drive $drive is already mounted at $mount_point."
            else
                sudo mount "/dev/$drive" "$mount_point" && echo "Mounted $drive at $mount_point."
            fi
            echo "Files in $mount_point:"
            ls -l "$mount_point"
        done
        echo "Please safely unmount the drives after use."
        # Optionally, you can unmount the drives after listing files
    fi
    prev_drives="$curr_drives"
done