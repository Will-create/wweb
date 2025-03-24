#!/bin/sh

# Define the JSON file path
CONFIG_PATH="/app/databases/memorize_${APP_PHONE}.json"

# Generate JSON config dynamically
cat <<EOF > $CONFIG_PATH
{
    "data": {
        "name": "${APP_NAME:-Muald}",
        "mode": "${APP_MODE:-code}",
        "baseurl": "${APP_BASEURL:-https://whatsapp.muald.com}",
        "phone": "${APP_PHONE:-22650777706}",
        "token": "${APP_TOKEN:-token}",
        "messageapi": "${APP_MESSAGEAPI:-/api/message/}",
        "mediaapi": "${APP_MEDIAAPI:-/api/media/}",
        "rpc": "${APP_RPC:-/api/rpc/}",
        "webhook": "${APP_WEBHOOK:-https://instance.zapwize.com/stream/webhook/}",
        "id": "${APP_ID:-1jns8001sn51d}",
        "status": "${APP_STATUS:-active}",
        "sendseen": ${APP_SENDSEEN:-false},
        "sendtyping": ${APP_SENDTYPING:-false},
        "sendrecording": ${APP_SENDRECORDING:-false}
    },
    "id": "${APP_ID:-1jns8001sn51d}"
}
EOF

echo "memorize_${APP_PHONE}.json created with dynamic values."

# Start the application
exec node index.js
