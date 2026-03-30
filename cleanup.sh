#!/bin/bash

# MIGRATION MODE: STRICT Safety Rules for Disk Cleanup
#
# 1. ONLY delete from user-writable space.
# 2. NEVER touch protected system partitions.
# 3. Show warnings for full system partitions but DO NOT EXIT.
# 4. Always attempt to clean user-space files to prepare for migration.

# --- CONFIGURATION ---
LOG_FILE="cleanup.log"
# Define protected mount points to prevent accidental deletion
PROTECTED_MOUNTS=("/ephemeral" "/nix" "/root")

# --- FUNCTIONS ---
log() {
    echo "$(date): $1" >> "$LOG_FILE"
}

# --- SCRIPT START ---
echo "Running MIGRATION MODE cleanup script..."
log "Starting migration cleanup."

# Get disk usage information
df_output=$(df -h)

# --- SAFETY CHECKS (NON-BLOCKING) ---

# Emergency check for critical system disk usage (warn only)
if df -h | grep '/dev/sda' | awk '{print $5}' | sed 's/%//' | grep -qE '9[0-9]|100'; then
  echo "🔥 WARNING: Critical system disk usage detected. Cleanup will proceed."
fi

# Check protected system partitions (warn only)
for mount_point in "${PROTECTED_MOUNTS[@]}"; do
    if echo "$df_output" | grep -q "$mount_point"; then
        usage=$(echo "$df_output" | grep "$mount_point" | awk '{print $5}' | sed 's/%//')
        if [[ "$usage" -ge 70 ]]; then
            log "WARNING: Protected system partition ${mount_point} is ${usage}% full. Continuing cleanup."
            echo "Warning: System storage on ${mount_point} is full, but cleanup will continue."
        fi
    fi
done

# --- FORCED USER-SPACE CLEANUP FOR MIGRATION ---
echo "Forcing cleanup of user-space files for migration..."

log "Disk usage before cleanup:"
echo "$df_output" >> "$LOG_FILE"

# --- SAFE CLEANUP OPERATIONS ---

# 1. Delete project-specific build and dependency folders
FOLDERS_TO_DELETE=(".next" "node_modules" ".npm")
for folder in "${FOLDERS_TO_DELETE[@]}"; do
    if [ -d "$folder" ]; then
        log "Deleting $folder..."
        rm -rf "$folder"
        log "Successfully deleted $folder."
    else
        log "Directory $folder not found, skipping."
    fi
done

# 2. Clean /tmp directory (safe to clear)
log "Cleaning /tmp/ directory..."
rm -rf /tmp/*
log "/tmp/ directory cleaned."

# 3. Clean up the log file itself to save space
rm -f "$LOG_FILE"

# --- POST-CLEANUP ---
echo "Migration cleanup complete."
echo "Disk usage after cleanup:"
df -h

echo "Project cleaned for migration. 'node_modules' and other artifacts removed."
