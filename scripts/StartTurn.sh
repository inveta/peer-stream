#!/bin/bash
# Copyright Epic Games, Inc. All Rights Reserved.
pushd "$( dirname "${BASH_SOURCE[0]}" )"
bash Install_CoTurn.sh
localip=$(curl http://169.254.169.254/latest/meta-data/local-ipv4)
publicip=$(curl http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Private IP: $localip"
echo "Public IP: $publicip"

turnusername="PixelStreamingUser"
turnpassword="AnotherTURNintheroad"
realm="PixelStreaming"
process="turnserver"
arguments="-p 19303 -r $realm -X $publicip -E $localip -L $localip --no-cli --no-tls --no-dtls --pidfile /var/run/turnserver.pid -a -v -n -u ${turnusername}:${turnpassword}"

# Add arguments passed to script to arguments for executable
arguments+=" $@"

pushd ../..
echo "Running: $process $arguments"
# pause
sudo $process $arguments &
popd

popd