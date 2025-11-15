#!/bin/bash
set -e

# =============================================================================
# Manual AWS Instance Deployment Script
# =============================================================================
# Use this script if you've already created an EC2 instance manually
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
        
        # Install Docker
        print_status "Installing Docker..."
        if ! command -v docker &> /dev/null; then
            sudo yum install -y docker
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -a -G docker ec2-user
            print_status "Docker installed and started"
        else
            print_status "Docker already installed"
        fi
        
        # Install Docker Compose and Docker Buildx
        print_status "Installing Docker Compose..."
        if ! command -v docker-compose &> /dev/null; then
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            print_status "Docker Compose installed"
        else
            print_status "Docker Compose already installed"
        fi
        
        # Install Docker Buildx
        print_status "Installing Docker Buildx..."
        if ! docker buildx ls &> /dev/null; then
            sudo yum install -y docker-buildx-plugin
            print_status "Docker Buildx installed"
        else
            print_status "Docker Buildx already available"
        fi
        
        # Enable buildx for current user
        docker buildx install || true
        docker buildx create --use --name default || true
        
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
        
        cd /opt/restorepoint/RP_SL1_MCP
        
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
        
        # Build Docker image
        print_status "Building Docker image..."
        docker build -t rp-sl1-mcp .
        
        # Stop and remove existing container if it exists
        print_status "Cleaning up existing container..."
        docker stop rp-sl1-mcp 2>/dev/null || true
        docker rm rp-sl1-mcp 2>/dev/null || true
        
        # Start the service directly
        print_status "Starting MCP server..."
        docker run -d \
            --name rp-sl1-mcp \
            --restart unless-stopped \
            -p 3000:3000 \
            -e ENABLE_HTTP_SERVER=true \
            -e NODE_ENV=production \
            -v /opt/restorepoint/RP_SL1_MCP/config.json:/app/config.json:ro \
            -v /opt/restorepoint/RP_SL1_MCP/logs:/app/logs \
            rp-sl1-mcp
        
        # Wait for startup
        sleep 15
        
        # Check if container is running
        print_status "Checking container status..."
        if ! docker ps | grep rp-sl1-mcp; then
            print_error "❌ Container is not running!"
            print_error "Container logs:"
            docker logs rp-sl1-mcp
            exit 1
        fi
        
        # Health check
        print_status "Performing health check..."
        sleep 15  # Give more time for application to start
        if curl -f http://localhost:3000/health 2>/dev/null; then
            print_status "✅ Health check passed!"
            print_status "✅ MCP Server is running successfully"
            
            # Show logs
            print_status "Recent logs:"
            docker logs --tail=10 rp-sl1-mcp
        else
            print_error "❌ Health check failed!"
            print_error "Container logs:"
            docker logs rp-sl1-mcp
            print_error "Container status:"
            docker ps -a | grep rp-sl1-mcp
            exit 1
        fi
        
        # Create systemd service for auto-start
        print_status "Creating systemd service..."
        sudo cat > /etc/systemd/system/restorepoint-mcp.service << 'SERVICE_EOF'
[Unit]
Description=Restorepoint MCP Server
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/restorepoint/RP_SL1_MCP
ExecStart=/usr/bin/docker run -d --name rp-sl1-mcp --restart unless-stopped -p 3000:3000 -e ENABLE_HTTP_SERVER=true -e NODE_ENV=production -v /opt/restorepoint/RP_SL1_MCP/config.json:/app/config.json:ro -v /opt/restorepoint/RP_SL1_MCP/logs:/app/logs rp-sl1-mcp
ExecStartPost=/usr/bin/sleep 5
ExecStop=/usr/bin/docker stop rp-sl1-mcp
ExecStopPost=/usr/bin/docker rm rp-sl1-mcp
TimeoutStartSec=0
User=ec2-user
Group=ec2-user

[Install]
WantedBy=multi-user.target
SERVICE_EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable restorepoint-mcp.service
        
        print_status "✅ Systemd service created and enabled"
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
        echo "ssh -i $SSH_KEY ec2-user@$EC2_IP 'cd /opt/restorepoint/RP_SL1_MCP && docker-compose logs mcp-server'"
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
    print_header "MANUAL AWS INSTANCE DEPLOYMENT"
    print_status "Deploying MCP server to your manually created EC2 instance"
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
    print_status "3. Check logs: ssh -i $SSH_KEY ec2-user@$EC2_IP 'docker-compose logs -f'"
}

# Run main function
main "$@"