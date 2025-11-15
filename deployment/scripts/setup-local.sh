#!/bin/bash
set -e

# =============================================================================
# Local Development Setup Script
# =============================================================================
# This script sets up local development environment for the Restorepoint chat project
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "CHECKING PREREQUISITES"
    
    local missing_deps=()
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js 20+")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("Docker")
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("Docker Compose")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_error "Please install missing dependencies and try again."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
    
    if [ "$NODE_MAJOR" -lt 22 ]; then
        print_error "Node.js 22+ required, found $NODE_VERSION"
        print_error "Please upgrade Node.js: brew install node@22 or nvm install 22"
        exit 1
    fi
    
    print_status "✅ All prerequisites found (Node.js $NODE_VERSION)"
}

# Setup MCP Server
setup_mcp_server() {
    print_header "SETTING UP MCP SERVER"
    
    print_status "Installing dependencies..."
    npm ci
    
    print_status "Building application..."
    npm run build
    
    # Check if config.json exists
    if [ ! -f "config.json" ]; then
        print_warning "config.json not found, creating from example..."
        if [ -f "config.json.example" ]; then
            cp config.json.example config.json
            print_warning "Please edit config.json with your Restorepoint details"
        else
            print_error "config.json.example not found"
            exit 1
        fi
    fi
    
    print_status "✅ MCP Server setup complete"
}

# Setup Docker for development
setup_docker() {
    print_header "SETTING UP DOCKER"
    
    print_status "Building Docker image..."
    npm run docker:build
    
    print_status "✅ Docker setup complete"
}

# Test local development
test_development() {
    print_header "TESTING LOCAL DEVELOPMENT"
    
    print_status "Starting MCP server in development mode..."
    
    # Start in background
    ENABLE_HTTP_SERVER=true npm run dev &
    MCP_PID=$!
    
    # Wait for server to start
    sleep 10
    
    # Test health endpoint
    if curl -f http://localhost:3000/health 2>/dev/null; then
        print_status "✅ MCP server is running locally"
        print_status "✅ Health endpoint: http://localhost:3000/health"
        print_status "✅ Info endpoint: http://localhost:3000/info"
        
        # Stop development server
        kill $MCP_PID 2>/dev/null || true
    else
        print_error "❌ MCP server failed to start"
        kill $MCP_PID 2>/dev/null || true
        exit 1
    fi
}

# Create development scripts
create_dev_scripts() {
    print_header "CREATING DEVELOPMENT SCRIPTS"
    
    # Create start script
    cat > start-dev.sh << 'EOF'
#!/bin/bash
# Start MCP server in development mode with HTTP endpoints
ENABLE_HTTP_SERVER=true npm run dev
EOF
    chmod +x start-dev.sh
    
    # Create test script
    cat > test-local.sh << 'EOF'
#!/bin/bash
# Test local MCP server endpoints
echo "Testing MCP server..."
echo "Health check:"
curl -f http://localhost:3000/health || echo "Health check failed"
echo ""
echo "Info endpoint:"
curl -s http://localhost:3000/info | jq . 2>/dev/null || curl -s http://localhost:3000/info
EOF
    chmod +x test-local.sh
    
    # Create Docker development script
    cat > start-docker-dev.sh << 'EOF'
#!/bin/bash
# Start MCP server in Docker with development settings
ENABLE_HTTP_SERVER=true npm run docker:dev
EOF
    chmod +x start-docker-dev.sh
    
    print_status "✅ Development scripts created"
    print_status "  - ./start-dev.sh: Start in development mode"
    print_status "  - ./test-local.sh: Test local server"
    print_status "  - ./start-docker-dev.sh: Start in Docker development"
}

# Show next steps
show_next_steps() {
    print_header "DEVELOPMENT SETUP COMPLETE"
    
    echo ""
    print_status "✅ Local development environment is ready!"
    echo ""
    print_status "Available commands:"
    print_status "  npm run dev                # Start development server"
    print_status "  ENABLE_HTTP_SERVER=true npm run dev  # Start with HTTP endpoints"
    print_status "  npm run docker:dev        # Start in Docker development"
    print_status "  npm run test              # Run tests"
    print_status "  npm run docker:prod       # Start in Docker production"
    echo ""
    print_status "Development endpoints:"
    print_status "  Health:  http://localhost:3000/health"
    print_status "  Info:    http://localhost:3000/info"
    echo ""
    print_status "Next steps:"
    print_status "1. Edit config.json with your Restorepoint details"
    print_status "2. Test the MCP server: npm run test"
    print_status "3. Start development: ENABLE_HTTP_SERVER=true npm run dev"
    print_status "4. Deploy to AWS: ./deployment/scripts/deploy-aws.sh"
    echo ""
    print_status "Documentation:"
    print_status "  - Architecture: RESTOREPOINT_CHAT_ARCHITECTURE.md"
    print_status "  - Docker Guide: DOCKER_DEPLOYMENT_GUIDE.md"
    print_status "  - Next Steps:   NEXT_STEPS.md"
}

# Main execution
main() {
    print_header "RESTOREPOINT LOCAL DEVELOPMENT SETUP"
    print_status "Setting up development environment..."
    echo ""
    
    check_prerequisites
    setup_mcp_server
    setup_docker
    test_development
    create_dev_scripts
    show_next_steps
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-docker    Skip Docker setup"
    echo "  --skip-test      Skip development testing"
    echo "  --help           Show this help message"
    echo ""
    echo "Example:"
    echo "  $0                # Full setup"
    echo "  $0 --skip-docker  # Setup without Docker"
}

# Parse command line arguments
SKIP_DOCKER=false
SKIP_TEST=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-test)
            SKIP_TEST=true
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Modify main function based on flags
if [ "$SKIP_DOCKER" = true ]; then
    setup_docker() { print_status "⏭️ Skipping Docker setup"; }
fi

if [ "$SKIP_TEST" = true ]; then
    test_development() { print_status "⏭️ Skipping development testing"; }
fi

# Run main function
main "$@"