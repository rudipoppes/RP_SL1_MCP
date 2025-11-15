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
REPO_URL="${REPO_URL:-https://github.com/rudipoppes/RP_SL1_MCP.git}"
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
        
        # Install Git and Node.js
        print_status "Installing Git and Node.js 20 LTS..."
        sudo yum install -y git
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
        
        # Create application directory
        print_status "Creating application directory..."
        sudo mkdir -p /opt/restorepoint
        sudo chown ec2-user:ec2-user /opt/restorepoint
        
        print_status "✅ EC2 instance setup completed"
SETUP_EOF
    
    # Copy files from local machine
    print_status "Copying application files to EC2..."
    
    # Create temp directory and copy files
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$EC2_IP" "mkdir -p /tmp/deploy"
    
    # Copy all source files excluding large directories
    print_status "Copying application files..."
    
    # First copy essential files
    rsync -avz --progress \
        package.json \
        package-lock.json \
        tsconfig.json \
        jest.config.cjs \
        .eslintrc.js \
        .prettierrc.json \
        .dockerignore \
        Dockerfile \
        docker-compose*.yml \
        config.json.example \
        -e "ssh -o StrictHostKeyChecking=no -i '$SSH_KEY'" \
        ec2-user@"$EC2_IP":/tmp/deploy/
    
    # Then copy source code and documentation
    rsync -avz --progress \
        --exclude='.git/' \
        --exclude='node_modules/' \
        --exclude='dist/' \
        --exclude='logs/' \
        --exclude='.claude/' \
        --exclude='*.log' \
        src/ \
        docs/ \
        scripts/ \
        types/ \
        utils/ \
        constants/ \
        auth/ \
        tools/ \
        config/ \
        *.md \
        -e "ssh -o StrictHostKeyChecking=no -i '$SSH_KEY'" \
        . ec2-user@"$EC2_IP":/tmp/deploy/
    
    # Verify files were copied
    print_status "Verifying copied files..."
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$EC2_IP" "ls -la /tmp/deploy/ | head -10"
    
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
        
        cd /opt/restorepoint
        
        # Remove old deployment and move new files
        rm -rf RP_SL1_MCP
        mv /tmp/deploy RP_SL1_MCP
        cd RP_SL1_MCP
        
        # Install dependencies
        print_status "Installing Node.js dependencies..."
        if [ -f "package-lock.json" ]; then
            npm ci
        else
            print_status "package-lock.json not found, using npm install"
            npm install
        fi
        
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
        
        # Build Docker image
        print_status "Building Docker image..."
        docker build -t rp-sl1-mcp .
        
        # Start the service
        print_status "Starting MCP server..."
        ENABLE_HTTP_SERVER=true docker-compose up -d
        
        # Wait for startup
        sleep 30
        
        # Health check
        print_status "Performing health check..."
        if curl -f http://localhost:3000/health; then
            print_status "✅ Health check passed!"
            print_status "✅ MCP Server is running successfully"
            
            # Show logs
            print_status "Recent logs:"
            docker-compose logs --tail=20 mcp-server
        else
            print_error "❌ Health check failed!"
            print_error "Showing logs:"
            docker-compose logs mcp-server
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
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
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
    echo "Examples:"
    echo "  $0 --ip 1.2.3.4"
    echo "  $0 --ip 1.2.3.4 --key ~/.ssh/my-key.pem"
    echo "  EC2_IP=1.2.3.4 $0"
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