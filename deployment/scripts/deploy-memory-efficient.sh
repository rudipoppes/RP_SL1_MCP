#!/bin/bash
set -e

# =============================================================================
# Memory-Efficient AWS Deployment for t3.micro Instances
# =============================================================================
# This script solves npm install memory constraints on 1GB EC2 instances
# by pre-building locally and deploying only production files
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

# Show memory requirements
show_memory_info() {
    print_header "MEMORY REQUIREMENTS ANALYSIS"
    print_status "t3.micro total RAM: 1GB"
    print_status "Available RAM: ~800MB (system overhead)"
    print_status "npm ci --production: ~300-400MB"
    print_status "Node.js runtime: ~100MB"
    print_status "Application memory: ~50MB"
    print_status "Safety buffer: ~150MB"
    print_status "Total estimated: ~600-650MB ✅"
    echo ""
    print_status "✅ This approach is designed to work within t3.micro constraints"
}

# Validate local build
validate_local_build() {
    print_header "VALIDATING LOCAL BUILD"
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Run from project root."
        exit 1
    fi
    
    if [ ! -f "package-lock.json" ]; then
        print_error "package-lock.json not found. Run npm install first."
        exit 1
    fi
    
    # Check if dist directory exists and is recent
    if [ ! -d "dist" ]; then
        print_status "Building project locally..."
        npm run build
    else
        # Check if dist is older than src files
        local src_modified=$(find src -type f -name "*.ts" -exec stat -f "%m" {} \; 2>/dev/null | sort -r | head -1 || echo "0")
        local dist_modified=$(stat -f "%m" dist/server.js 2>/dev/null || echo "0")
        
        if [ "$src_modified" -gt "$dist_modified" ]; then
            print_status "Source files modified, rebuilding..."
            npm run build
        else
            print_status "✅ Local build is up to date"
        fi
    fi
    
    if [ ! -f "dist/server.js" ]; then
        print_error "Build failed - dist/server.js not found"
        exit 1
    fi
    
    local dist_size=$(du -sh dist/ | cut -f1)
    print_status "✅ Local build validated (dist size: $dist_size)"
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

# Setup EC2 instance for memory-efficient deployment
setup_ec2_memory_efficient() {
    print_header "SETTING UP EC2 FOR MEMORY-EFFICIENT DEPLOYMENT"
    
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$EC2_IP" << 'SETUP_EOF'
        set -e
        
        # Print functions
        print_status() {
            echo -e "\033[0;32m[INFO]\033[0m $1"
        }
        
        print_error() {
            echo -e "\033[0;31m[ERROR]\033[0m $1"
        }
        
        # Check available memory
        print_status "Checking available memory..."
        local available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
        print_status "Available memory: ${available_mem}MB"
        
        if [ "$available_mem" -lt 400 ]; then
            print_error "❌ Insufficient memory: ${available_mem}MB available, need at least 400MB"
            print_error "Consider upgrading to t3.small (2GB RAM)"
            exit 1
        fi
        
        # Stop any existing services
        print_status "Stopping existing MCP server..."
        pkill -f "node.*server.js" 2>/dev/null || true
        sudo systemctl stop restorepoint-mcp 2>/dev/null || true
        
        # Create application directory
        print_status "Setting up application directory..."
        sudo mkdir -p /opt/restorepoint
        sudo chown ec2-user:ec2-user /opt/restorepoint
        
        # Clean up any previous deployments
        print_status "Cleaning up previous deployments..."
        rm -rf /opt/restorepoint/current
        mkdir -p /opt/restorepoint/current
        
        print_status "✅ EC2 setup completed"
SETUP_EOF
}

# Deploy pre-built application
deploy_prebuilt_application() {
    print_header "DEPLOYING PRE-BUILT APPLICATION"
    
    # Create temporary deployment package
    print_status "Creating deployment package..."
    local deploy_dir="memory-efficient-deploy"
    rm -rf $deploy_dir
    mkdir -p $deploy_dir
    
    # Copy essential files
    cp package.json $deploy_dir/
    cp package-lock.json $deploy_dir/
    cp -r dist $deploy_dir/
    
    # Copy config and other necessary files
    if [ -f "config.json.example" ]; then
        cp config.json.example $deploy_dir/
    fi
    
    # Create deployment info
    cat > $deploy_dir/deployment-info.txt << EOF
Deployment Method: Memory-Efficient (Pre-built)
Build Time: $(date)
Built On: $(hostname)
Memory Optimized: Yes
Target Instance: t3.micro (1GB RAM)
EOF
    
    # Create deployment tarball
    tar -czf memory-efficient-deploy.tar.gz -C $deploy_dir .
    local tarball_size=$(du -sh memory-efficient-deploy.tar.gz | cut -f1)
    print_status "Created deployment package: $tarball_size"
    
    # Copy to EC2
    print_status "Copying deployment package to EC2..."
    scp -o StrictHostKeyChecking=no -i "$SSH_KEY" memory-efficient-deploy.tar.gz \
        ec2-user@"$EC2_IP":/tmp/
    
    # Extract and setup on EC2
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$EC2_IP" << 'DEPLOY_EOF'
        set -e
        
        print_status() {
            echo -e "\033[0;32m[INFO]\033[0m $1"
        }
        
        print_error() {
            echo -e "\033[0;31m[ERROR]\033[0m $1"
        }
        
        cd /opt/restorepoint/current
        
        # Extract deployment package
        print_status "Extracting deployment package..."
        tar -xzf /tmp/memory-efficient-deploy.tar.gz
        
        # Show deployment info
        print_status "Deployment info:"
        cat deployment-info.txt
        
        # Monitor memory during npm ci
        print_status "Installing production dependencies (memory monitoring enabled)..."
        
        # Create memory monitoring script
        cat > /tmp/memory-monitor.sh << 'MONITOR_EOF'
#!/bin/bash
while true; do
    mem_usage=$(free -m | awk 'NR==2{printf "%.0f%%", $3*100/$2}')
    avail_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    echo "$(date): Memory usage: $mem_usage (${avail_mem}MB available)"
    sleep 5
done
MONITOR_EOF
        
        chmod +x /tmp/memory-monitor.sh
        
        # Start memory monitoring in background
        /tmp/memory-monitor.sh &
        MONITOR_PID=$!
        
        # Install production dependencies with memory optimization
        export NODE_OPTIONS="--max-old-space-size=512"
        
        if npm ci --production --no-optional; then
            print_status "✅ Dependencies installed successfully"
        else
            print_error "❌ npm ci failed - insufficient memory"
            kill $MONITOR_PID 2>/dev/null || true
            print_error "Available options:"
            print_error "1. Upgrade to t3.small (2GB RAM)"
            print_error "2. Add swap space to EC2 instance"
            print_error "3. Use alternative deployment method"
            exit 1
        fi
        
        # Stop memory monitoring
        kill $MONITOR_PID 2>/dev/null || true
        
        # Setup configuration
        if [ ! -f "config.json" ] && [ -f "config.json.example" ]; then
            cp config.json.example config.json
            print_status "Created config.json from example"
            print_warning "Please edit config.json with your Restorepoint details"
        fi
        
        # Create logs directory
        mkdir -p logs
        
        # Verify installation
        print_status "Verifying installation..."
        if [ ! -f "dist/server.js" ]; then
            print_error "❌ dist/server.js not found"
            exit 1
        fi
        
        if [ ! -d "node_modules" ]; then
            print_error "❌ node_modules not found"
            exit 1
        fi
        
        local node_modules_size=$(du -sh node_modules | cut -f1)
        print_status "✅ Installation verified (node_modules: $node_modules_size)"
        
        # Clean up
        rm -f /tmp/memory-efficient-deploy.tar.gz
        rm -f /tmp/memory-monitor.sh
DEPLOY_EOF
    
    if [ $? -eq 0 ]; then
        print_status "✅ Application deployed successfully"
    else
        print_error "❌ Deployment failed"
        exit 1
    fi
    
    # Clean up local files
    rm -rf $deploy_dir memory-efficient-deploy.tar.gz
}

# Start and verify service
start_and_verify_service() {
    print_header "STARTING AND VERIFYING SERVICE"
    
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$EC2_IP" << 'VERIFY_EOF'
        set -e
        
        print_status() {
            echo -e "\033[0;32m[INFO]\033[0m $1"
        }
        
        print_error() {
            echo -e "\033[0;31m[ERROR]\033[0m $1"
        }
        
        cd /opt/restorepoint/current
        
        # Create systemd service
        print_status "Creating systemd service..."
        sudo cat > /etc/systemd/system/restorepoint-mcp.service << 'SERVICE_EOF'
[Unit]
Description=Restorepoint MCP Server (Memory-Efficient Deployment)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/restorepoint/current
User=ec2-user
Group=ec2-user
Environment=NODE_ENV=production
Environment=ENABLE_HTTP_SERVER=true
Environment=PATH=/usr/bin:/bin:/usr/local/bin
Environment=NODE_OPTIONS=--max-old-space-size=512
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=restorepoint-mcp

[Install]
WantedBy=multi-user.target
SERVICE_EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable restorepoint-mcp.service
        
        # Start the service
        print_status "Starting MCP server service..."
        sudo systemctl start restorepoint-mcp.service
        
        # Wait for startup
        sleep 15
        
        # Check service status
        if sudo systemctl is-active --quiet restorepoint-mcp.service; then
            print_status "✅ Service is running"
        else
            print_error "❌ Service failed to start"
            sudo systemctl status restorepoint-mcp.service
            print_error "Service logs:"
            sudo journalctl -u restorepoint-mcp.service --no-pager -n 20
            exit 1
        fi
        
        # Health check
        print_status "Performing health check..."
        local health_attempts=0
        local max_attempts=10
        
        while [ $health_attempts -lt $max_attempts ]; do
            if curl -f http://localhost:3000/health 2>/dev/null; then
                print_status "✅ Health check passed!"
                break
            else
                health_attempts=$((health_attempts + 1))
                if [ $health_attempts -eq $max_attempts ]; then
                    print_error "❌ Health check failed after $max_attempts attempts"
                    print_error "Service logs:"
                    sudo journalctl -u restorepoint-mcp.service --no-pager -n 20
                    exit 1
                fi
                sleep 5
            fi
        done
        
        # Show memory usage
        print_status "Memory usage after deployment:"
        free -h
        
        # Show service info
        print_status "✅ MCP Server is running successfully!"
        print_status "Service logs:"
        sudo journalctl -u restorepoint-mcp.service --no-pager -n 10
VERIFY_EOF
    
    if [ $? -eq 0 ]; then
        print_status "✅ Service started and verified successfully"
    else
        print_error "❌ Service verification failed"
        exit 1
    fi
}

# Final verification from local machine
final_verification() {
    print_header "FINAL VERIFICATION"
    
    print_status "Testing external health endpoint..."
    local health_attempts=0
    local max_attempts=5
    
    while [ $health_attempts -lt $max_attempts ]; do
        if curl -f http://"$EC2_IP":3000/health 2>/dev/null; then
            print_status "✅ External health check passed!"
            break
        else
            health_attempts=$((health_attempts + 1))
            if [ $health_attempts -eq $max_attempts ]; then
                print_error "❌ External health check failed"
                exit 1
            fi
            sleep 10
        fi
    done
    
    echo ""
    print_header "🎉 MEMORY-EFFICIENT DEPLOYMENT COMPLETED!"
    print_status "✅ Successfully deployed MCP server to t3.micro instance"
    echo ""
    print_status "Service Information:"
    print_status "🌐 MCP Server URL: http://$EC2_IP:3000"
    print_status "🏥 Health Endpoint: http://$EC2_IP:3000/health"
    print_status "ℹ️  Info Endpoint: http://$EC2_IP:3000/info"
    print_status "🔗 SSH: ssh -i $SSH_KEY ec2-user@$EC2_IP"
    echo ""
    print_status "Memory Usage:"
    print_status "Target Instance: t3.micro (1GB RAM)"
    print_status "Estimated Usage: ~600-650MB"
    print_status "Available Buffer: ~350-400MB"
    echo ""
    print_status "Management Commands:"
    print_status "Check status: ssh -i $SSH_KEY ec2-user@$EC2_IP 'sudo systemctl status restorepoint-mcp'"
    print_status "View logs: ssh -i $SSH_KEY ec2-user@$EC2_IP 'sudo journalctl -u restorepoint-mcp -f'"
    print_status "Restart service: ssh -i $SSH_KEY ec2-user@$EC2_IP 'sudo systemctl restart restorepoint-mcp'"
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --ip IP                 EC2 instance IP address (required)"
    echo "  --key PATH              SSH key path (default: ~/.ssh/your-key-pair.pem)"
    echo "  --help                  Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  EC2_IP                  EC2 instance IP address"
    echo "  SSH_KEY                 SSH key path"
    echo ""
    echo "Description:"
    echo "  Memory-efficient deployment for t3.micro instances (1GB RAM)"
    echo "  Pre-builds locally and deploys only production files"
    echo ""
    echo "Prerequisites:"
    echo "  - EC2 instance running Amazon Linux 2"
    echo "  - Node.js 22+ installed on EC2"
    echo "  - SSH access with key pair"
    echo "  - Local npm run build completed"
    echo ""
    echo "Example:"
    echo "  $0 --ip 1.2.3.4 --key ~/.ssh/my-key.pem"
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
    print_header "MEMORY-EFFICIENT AWS DEPLOYMENT FOR T3.MICRO"
    print_status "Optimizing deployment for 1GB RAM instances"
    echo ""
    
    show_memory_info
    validate_local_build
    get_ec2_ip
    check_ssh_key
    setup_ec2_memory_efficient
    deploy_prebuilt_application
    start_and_verify_service
    final_verification
}

# Run main function
main "$@"