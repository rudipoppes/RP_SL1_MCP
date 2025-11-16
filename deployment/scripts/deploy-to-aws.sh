#!/bin/bash
set -e

# =============================================================================
# AWS Deployment Script
# =============================================================================
# Deploy MCP server to AWS EC2 instance (native Node.js, no Docker)
# =============================================================================

# Configuration
EC2_IP="${EC2_IP:-}"  # Your EC2 instance IP address
SSH_KEY="${SSH_KEY:-~/.ssh/your-key-pair.pem}"  # Path to your SSH key
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Get EC2 IP from user or environment
get_ec2_ip() {
    if [ -z "$EC2_IP" ]; then
        echo "Enter your EC2 instance IP address:"
        read -p "EC2 IP: " EC2_IP
    fi
    
    if [ -z "$EC2_IP" ]; then
        print_error "EC2 IP address is required. Use: EC2_IP=1.2.3.4 $0"
        exit 1
    fi
    
    print_status "Using EC2 IP: $EC2_IP"
}

# Get GitHub repository URL
get_repo_info() {
    if [ -z "$REPO_URL" ]; then
        echo "Enter your GitHub repository URL:"
        echo "Example: https://github.com/username/RP_SL1_MCP.git"
        read -p "GitHub Repo URL: " REPO_URL
    fi
    
    if [ -z "$REPO_URL" ]; then
        print_error "GitHub repository URL is required. Use: REPO_URL=https://github.com/username/RP_SL1_MCP.git $0"
        exit 1
    fi
    
    print_status "Using GitHub repo: $REPO_URL"
}

# Check SSH key exists
check_ssh_key() {
    if [ ! -f "$SSH_KEY" ]; then
        print_error "SSH key not found: $SSH_KEY"
        print_error "Update SSH_KEY variable or ensure key exists"
        exit 1
    fi
    
    print_status "Using SSH key: $SSH_KEY"
}

# Deploy to manual EC2 instance
deploy_to_manual_instance() {
    print_header "DEPLOYING TO MANUAL EC2 INSTANCE"
    
    print_status "Setting up EC2 instance and copying files..."
    
    # Setup EC2 instance first
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$EC2_IP" << 'SETUP_EOF'
        set -e
        
        print_status() {
            echo -e "\033[0;32m[INFO]\033[0m $1"
        }
        
        print_error() {
            echo -e "\033[0;31m[ERROR]\033[0m $1"
        }
        
        # Update system
        print_status "Updating system packages..."
        sudo yum update -y
                
        # Install Git and Node.js
        print_status "Installing Git and Node.js 22 LTS..."
        sudo yum install -y git
        curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
        sudo yum install -y nodejs
        
        # Create application directory
        print_status "Creating application directory..."
        sudo mkdir -p /opt/restorepoint
        sudo chown ec2-user:ec2-user /opt/restorepoint
        
        print_status "✅ EC2 instance setup completed"
SETUP_EOF
    
    # Clone repository from GitHub
    print_status "Cloning repository from GitHub..."
    
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$EC2_IP" << CLONE_EOF
        set -e
        
        # Set variables from local environment
        REPO_URL="$REPO_URL"
        BRANCH="$BRANCH"
        
        print_status() {
            echo -e "\033[0;32m[INFO]\033[0m \$1"
        }
        
        cd /opt/restorepoint
        
        # Remove old deployment
        rm -rf RP_SL1_MCP
        
        # Clone repository
        print_status "Cloning from GitHub..."
        git clone "\$REPO_URL" RP_SL1_MCP
        cd RP_SL1_MCP
        
        # Checkout specific branch if not main
        if [ "\$BRANCH" != "main" ]; then
            git checkout "\$BRANCH"
        fi
        
        print_status "✅ Repository cloned successfully"
CLONE_EOF
        
    # Deploy on EC2
    print_status "Deploying application on EC2..."
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$EC2_IP" << 'DEPLOY_EOF'
        set -e
        
        print_status() {
            echo -e "\033[0;32m[INFO]\033[0m $1"
        }
        
        print_error() {
            echo -e "\033[0;31m[ERROR]\033[0m $1"
        }
        
        print_warning() {
            echo -e "\033[1;33m[WARNING]\033[0m $1"
        }
        
        cd /opt/restorepoint/RP_SL1_MCP
        
        # Add Node.js 22 to PATH
        echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
        export PATH="/usr/local/bin:$PATH"
        
        # Install dependencies
        print_status "Installing Node.js dependencies..."
        # Always use npm install to avoid lock file issues
        npm install
        
        # Build application
        print_status "Building application..."
        npm run build
        
        # Create config file
        if [ ! -f "config.json" ]; then
            if [ -f "config.json.example" ]; then
                cp config.json.example config.json
                print_status "Created config.json from example"
                print_warning "Please edit config.json with your Restorepoint details"
            else
                print_error "config.json.example not found"
                exit 1
            fi
        fi
        
        # Create logs directory
        mkdir -p logs
        
        # Check if config.json exists, create from example if not
        if [ ! -f "config.json" ]; then
            print_status "Creating config.json from example..."
            cp config.json.example config.json
            print_warning "Please edit config.json with your Restorepoint details"
        fi
        
        # Install Node.js dependencies (including devDependencies for build)
        print_status "Installing all dependencies for TypeScript build..."
        npm install
        
        # Build the application from TypeScript
        print_status "Building TypeScript application..."
        npm run build
        
        # Verify build was successful
        if [ ! -f "dist/server.js" ]; then
            print_error "❌ Build failed - dist/server.js not found"
            exit 1
        fi
        
        # Debug: Check if Logger fix is in compiled code
        print_status "Debugging compiled code..."
        if grep -q "Initialize Logger before usage" dist/server.js; then
            print_status "✅ Logger fix found in compiled code"
            print_status "Using original dist/server.js with built-in Logger initialization fix"
        else
            print_error "❌ Logger fix NOT found in compiled code"
            print_error "This should not happen - please check the build process"
            exit 1
        fi
        
        # Install only production dependencies for runtime
        print_status "Installing production dependencies..."
        npm ci --omit=dev
        
        # Start the MCP server as a background service
        print_status "Starting MCP server..."
        
        # Kill any existing process
        pkill -f "node.*server.js" 2>/dev/null || true
        pkill -f "start-server.js" 2>/dev/null || true
        
        # Start the server in background
        ENABLE_HTTP_SERVER=true NODE_ENV=production nohup npm start > logs/mcp-server.log 2>&1 &
        MCP_PID=$!
        
        # Save PID for service management
        echo $MCP_PID > /opt/restorepoint/RP_SL1_MCP/mcp-server.pid
        
        print_status "✅ MCP Server started with PID: $MCP_PID"
        
        # Wait for startup
        sleep 20
        
        # Health check
        print_status "Performing health check..."
        if curl -f http://localhost:3000/health 2>/dev/null; then
            print_status "✅ Health check passed!"
            print_status "✅ MCP Server is running successfully"
            
            # Show recent logs
            print_status "Recent logs:"
            tail -n 20 logs/mcp-server.log
        else
            print_error "❌ Health check failed!"
            print_error "Server logs:"
            cat logs/mcp-server.log
            print_error "Process status:"
            ps aux | grep node || true
            exit 1
        fi
        
        # Create systemd service for auto-start
        print_status "Creating systemd service..."
        sudo bash -c 'cat > /etc/systemd/system/restorepoint-mcp.service << "SERVICE_EOF"'
[Unit]
Description=Restorepoint MCP Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/restorepoint/RP_SL1_MCP
User=ec2-user
Group=ec2-user
Environment=NODE_ENV=production
Environment=ENABLE_HTTP_SERVER=true
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=restorepoint-mcp
PIDFile=/opt/restorepoint/RP_SL1_MCP/mcp-server.pid

[Install]
WantedBy=multi-user.target
SERVICE_EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable restorepoint-mcp.service
        
        # Stop background process and start via systemd
        print_status "Stopping background process and starting via systemd..."
        pkill -f "node.*dist/server.js" 2>/dev/null || true
        sleep 2
        sudo systemctl start restorepoint-mcp.service
        
        # Wait for systemd service to start
        sleep 5
        
        # Verify systemd service is running
        if sudo systemctl is-active --quiet restorepoint-mcp.service; then
            print_status "✅ Systemd service is running successfully"
        else
            print_error "❌ Systemd service failed to start"
            sudo systemctl status restorepoint-mcp.service
            exit 1
        fi
        
        print_status "✅ Systemd service created, enabled, and running"
DEPLOY_EOF
    
    if [ $? -eq 0 ]; then
        print_status "✅ Deployment completed successfully!"
    else
        print_error "❌ Deployment failed"
        exit 1
    fi
}

# Verify deployment
verify_deployment() {
    print_header "VERIFYING DEPLOYMENT"
    
    print_status "Testing health endpoint..."
    if curl -f http://"$EC2_IP":3000/health 2>/dev/null; then
        print_status "✅ Health check passed!"
        
        echo ""
        print_status "🌐 MCP Server URL: http://$EC2_IP:3000"
        print_status "🏥 Health Endpoint: http://$EC2_IP:3000/health"
        print_status "ℹ️  Info Endpoint: http://$EC2_IP:3000/info"
        print_status "🔗 SSH: ssh -i $SSH_KEY ec2-user@$EC2_IP"
        
        echo ""
        print_status "Health check details:"
        curl -s http://"$EC2_IP":3000/health | jq '.' 2>/dev/null || curl -s http://"$EC2_IP":3000/health
        
    else
        print_error "❌ Health check failed!"
        print_error "Please check the deployment logs:"
        echo "ssh -i $SSH_KEY ec2-user@$EC2_IP 'cd /opt/restorepoint/RP_SL1_MCP && cat logs/mcp-server.log'"
        exit 1
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --ip IP                 EC2 instance IP address (required)"
    echo "  --key PATH              SSH key path (default: ~/.ssh/your-key-pair.pem)"
    echo "  --repo URL              Git repository URL"
    echo "  --branch BRANCH         Git branch (default: main)"
    echo "  --help                  Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  EC2_IP                  EC2 instance IP address"
    echo "  SSH_KEY                 SSH key path"
    echo "  REPO_URL                Git repository URL"
    echo "  BRANCH                  Git branch"
    echo ""
    echo "Repository URL Format:"
    echo "  Use GitHub URL: https://github.com/user/repo.git"
    echo ""
    echo "Examples:"
    echo "  $0 --ip 1.2.3.4 --repo https://github.com/user/repo.git"
    echo "  EC2_IP=1.2.3.4 REPO_URL=https://github.com/user/repo.git $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --ip)
            EC2_IP="$2"
            shift 2
            ;;
        --key)
            SSH_KEY="$2"
            shift 2
            ;;
        --repo)
            REPO_URL="$2"
            shift 2
            ;;
        --branch)
            BRANCH="$2"
            shift 2
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

# Main execution
main() {
    print_header "AWS DEPLOYMENT"
    print_status "Deploying MCP server to AWS EC2 instance (native Node.js)"
    echo ""
    
    get_ec2_ip
    get_repo_info
    check_ssh_key
    deploy_to_manual_instance
    verify_deployment
    
    echo ""
    print_header "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
    print_status "Your MCP server is now running on your manual EC2 instance!"
    echo ""
    print_status "Next steps:"
    print_status "1. Edit config.json: ssh -i $SSH_KEY ec2-user@$EC2_IP 'vim /opt/restorepoint/RP_SL1_MCP/config.json'"
    print_status "2. Restart service: ssh -i $SSH_KEY ec2-user@$EC2_IP 'sudo systemctl restart restorepoint-mcp'"
    print_status "3. Check logs: ssh -i $SSH_KEY ec2-user@$EC2_IP 'tail -f /opt/restorepoint/RP_SL1_MCP/logs/mcp-server.log'"
}

# Run main function
main "$@"