#!/bin/bash

echo "🎨 Creating Frontend SPA App Registration..."

APP_NAME="fabric-embedded-app-frontend"

# Crear app registration básica
echo "Creating basic app registration..."
az ad app create \
  --display-name "$APP_NAME" \
  --public-client-redirect-uris "http://localhost:3000"

# Obtener el Client ID
FRONTEND_CLIENT_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)

if [ -n "$FRONTEND_CLIENT_ID" ]; then
    echo "✅ App registration created!"
    echo "Client ID: $FRONTEND_CLIENT_ID"
    
    # Guardar para el siguiente paso
    export FRONTEND_CLIENT_ID
else
    echo "❌ Failed to create app registration"
    exit 1
fi