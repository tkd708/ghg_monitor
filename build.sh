#!/bin/bash

echo "Building GHG Monitor for Railway deployment..."

# Build frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Build backend
echo "Building backend..."
cd backend
npm install
npm run build
cd ..

echo "Build complete!"