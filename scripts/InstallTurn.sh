#!/bin/bash
# Copyright Epic Games, Inc. All Rights Reserved.

# Check if coturn is currently installed
if ! which turnserver > /dev/null; then
    # Install coturn
    echo "Installing coturn"
    sudo apt-get -y update
    sudo apt-get install -y coturn
fi
