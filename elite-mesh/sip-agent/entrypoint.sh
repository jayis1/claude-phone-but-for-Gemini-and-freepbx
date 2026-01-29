#!/bin/bash
set -e

# Dynamically set node name in Asterisk global variables
echo "SET VARIABLE NODE_NAME ${NODE_NAME}" > /etc/asterisk/init_vars.conf

echo "Starting AI SIP Agent: ${NODE_NAME}..."

# Ensure permissions
chown -R asterisk:asterisk /etc/asterisk

# Start Asterisk in foreground
exec /usr/sbin/asterisk -f
