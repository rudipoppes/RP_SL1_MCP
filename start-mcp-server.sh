#!/bin/bash

set -e

# =============================================================================
# RP_SL1_MCP - MCP Server Start Script
# Only starts the MCP server on port 3000
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

check_service() {
    local service_name=$1
    local port=$2
    local url=$3
    
    if curl -s --connect-timeout 5 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} $service_name (Port $port) - RUNNING"
        return 0
    else
        echo -e "${RED}❌${NC} $service_name (Port $port) - NOT RUNNING"
        return 1
    fi
}

print_header "STARTING MCP SERVER"

# Check if built
if [ ! -f "dist/server.js" ]; then
    print_error "MCP server not built. Run 'npm run build' first."
    exit 1
fi

# Stop any existing MCP server
print_status "Stopping any existing MCP Server..."
pkill -f "RestorepointHttpServer" 2>/dev/null || true
pkill -f "node.*dist/server.js" 2>/dev/null || true
pkill -f "node.*RP_SL1_MCP" 2>/dev/null || true
sleep 2

# Start MCP server
print_status "Starting MCP Server on port 3000..."

# Start MCP server in background with proper logging
ENABLE_HTTP_SERVER=true PORT=3000 node -e "
const { RestorepointHttpServer } = require('./dist/server.js');
const server = new RestorepointHttpServer();
server.start().then(() => {
  console.log('✅ MCP Server started successfully on port 3000!');
  console.log('   Health: http://localhost:3000/health');
  console.log('   Info: http://localhost:3000/info');
  console.log('   Tools: http://localhost:3000/tools/execute');
}).catch((error) => {
  console.error('❌ MCP Server failed to start:', error.message);
  process.exit(1);
});
" &

# Give server time to start
sleep 3

# Verify server started
if check_service "MCP Server" 3000 "http://localhost:3000/health"; then
    print_status "MCP Server started successfully!"
    print_status "Health check: http://localhost:3000/health"
    print_status "API info: http://localhost:3000/info"
    print_status "Tools API: http://localhost:3000/tools/execute"
else
    print_error "MCP Server failed to start properly"
    exit 1
fi