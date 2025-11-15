#!/bin/bash
set -e

# =============================================================================
# Restorepoint MCP Server AWS Deployment Script
# =============================================================================
# This script deploys the MCP server to AWS EC2 with Docker
# =============================================================================

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
EC2_INSTANCE_NAME="${EC2_INSTANCE_NAME:-restorepoint-mcp-server}"
EC2_INSTANCE_TYPE="${EC2_INSTANCE_TYPE:-t3.micro}"
SSH_KEY_NAME="${SSH_KEY_NAME:-$USER-key-pair}"
REPO_URL="${REPO_URL:-$(git config --get remote.origin.url)}"
BRANCH="${BRANCH:-main}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
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
    
    if ! command -v aws &> /dev/null; then
        missing_deps+=("AWS CLI")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("Docker")
    fi
    
    if ! command -v ssh &> /dev/null; then
        missing_deps+=("SSH client")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_error "Please install missing dependencies and try again."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    print_status "✅ All prerequisites found"
}

# Create AWS infrastructure
create_infrastructure() {
    print_header "CREATING AWS INFRASTRUCTURE"
    
    # Create security group
    print_status "Creating security group..."
    
    SG_EXISTS=$(aws ec2 describe-security-groups \
        --group-names "$EC2_INSTANCE_NAME-sg" \
        --region "$AWS_REGION" 2>/dev/null || echo "")
    
    if [ -z "$SG_EXISTS" ]; then
        SG_ID=$(aws ec2 create-security-group \
            --group-name "$EC2_INSTANCE_NAME-sg" \
            --description "Security group for Restorepoint MCP server" \
            --region "$AWS_REGION" \
            --query 'GroupId' \
            --output text)
        
        print_status "Created security group: $SG_ID"
        
        # Add SSH rule
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" \
            --protocol tcp \
            --port 22 \
            --cidr 0.0.0.0/0 \
            --region "$AWS_REGION" \
            --output text > /dev/null
        
        # Add HTTP rule
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" \
            --protocol tcp \
            --port 3000 \
            --cidr 0.0.0.0/0 \
            --region "$AWS_REGION" \
            --output text > /dev/null
        
        print_status "Added SSH (22) and HTTP (3000) rules to security group"
    else
        SG_ID=$(aws ec2 describe-security-groups \
            --group-names "$EC2_INSTANCE_NAME-sg" \
            --region "$AWS_REGION" \
            --query 'SecurityGroups[0].GroupId' \
            --output text)
        print_status "Security group already exists: $SG_ID"
    fi
    
    # Check if instance already exists
    INSTANCE_ID=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=$EC2_INSTANCE_NAME" "Name=instance-state-name,Values=running" \
        --region "$AWS_REGION" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "None" ]; then
        print_warning "Instance $INSTANCE_ID already running"
        EC2_IP=$(aws ec2 describe-instances \
            --instance-ids "$INSTANCE_ID" \
            --region "$AWS_REGION" \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text)
        print_status "Instance IP: $EC2_IP"
        return
    fi
    
    # Create user data script
    USER_DATA_SCRIPT=$(cat <<'EOF'
#!/bin/bash
set -e

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create application directory
mkdir -p /opt/restorepoint
cd /opt/restorepoint

# Install Git
yum install -y git

# Clone repository (will be done by deploy script)
# git clone [REPO_URL] .

# Create logs directory
mkdir -p logs

# Set permissions
chown -R ec2-user:ec2-user /opt/restorepoint

# Create systemd service for Docker Compose
cat > /etc/systemd/system/restorepoint-mcp.service << 'EOL'
[Unit]
Description=Restorepoint MCP Server
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/restorepoint
ExecStart=/usr/local/bin/docker-compose -f docker-compose.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOL

# Enable and start service
systemctl daemon-reload
systemctl enable restorepoint-mcp.service
EOF
)
    
    # Replace placeholders in user data
    USER_DATA_SCRIPT="${USER_DATA_SCRIPT//\[REPO_URL\]/$REPO_URL}"
    
    print_status "Launching EC2 instance..."
    
    # Get latest Amazon Linux 2 AMI
    AMI_ID=$(aws ec2 describe-images \
        --owners amazon \
        --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" \
        --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
        --region "$AWS_REGION" \
        --output text)
    
    # Launch instance
    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id "$AMI_ID" \
        --instance-type "$EC2_INSTANCE_TYPE" \
        --key-name "$SSH_KEY_NAME" \
        --security-group-ids "$SG_ID" \
        --user-data "$USER_DATA_SCRIPT" \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$EC2_INSTANCE_NAME}]" \
        --region "$AWS_REGION" \
        --query 'Instances[0].InstanceId' \
        --output text)
    
    print_status "Launching instance: $INSTANCE_ID"
    
    # Wait for instance to be running
    print_status "Waiting for instance to be ready..."
    aws ec2 wait instance-running \
        --instance-ids "$INSTANCE_ID" \
        --region "$AWS_REGION"
    
    # Get public IP
    EC2_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    print_status "✅ Instance launched: $INSTANCE_ID"
    print_status "✅ Public IP: $EC2_IP"
    print_status "✅ SSH: ssh -i ~/.ssh/$SSH_KEY_NAME.pem ec2-user@$EC2_IP"
}

# Deploy application to EC2
deploy_application() {
    print_header "DEPLOYING APPLICATION"
    
    if [ -z "$EC2_IP" ]; then
        print_error "EC2 IP not found"
        exit 1
    fi
    
    # Wait for SSH to be available
    print_status "Waiting for SSH to be available..."
    local ssh_ready=false
    local attempts=0
    local max_attempts=30
    
    while [ "$ssh_ready" = false ] && [ $attempts -lt $max_attempts ]; do
        if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=yes \
            -i ~/.ssh/"$SSH_KEY_NAME".pem ec2-user@"$EC2_IP" "echo 'SSH ready'" 2>/dev/null; then
            ssh_ready=true
        else
            echo -n "."
            sleep 10
            attempts=$((attempts + 1))
        fi
    done
    
    if [ "$ssh_ready" = false ]; then
        print_error "SSH not available after $max_attempts attempts"
        exit 1
    fi
    
    echo ""
    print_status "✅ SSH is ready"
    
    # Copy application files
    print_status "Copying application files..."
    
    # Create temp directory for deployment
    ssh -o StrictHostKeyChecking=no -i ~/.ssh/"$SSH_KEY_NAME".pem \
        ec2-user@"$EC2_IP" "mkdir -p /tmp/deploy && cd /tmp/deploy"
    
    # Copy files excluding .git and node_modules
    rsync -avz --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='logs' \
        -e "ssh -o StrictHostKeyChecking=no -i ~/.ssh/$SSH_KEY_NAME.pem" \
        . ec2-user@"$EC2_IP":/tmp/deploy/
    
    # Deploy on EC2
    print_status "Running deployment on EC2..."
    ssh -o StrictHostKeyChecking=no -i ~/.ssh/"$SSH_KEY_NAME".pem \
        ec2-user@"$EC2_IP" << 'DEPLOY_EOF'
        cd /opt/restorepoint
        
        # Stop existing services
        docker-compose down || true
        
        # Backup current deployment
        if [ -d "current" ]; then
            mv current "backup-$(date +%Y%m%d-%H%M%S)" || true
        fi
        
        # Move new deployment
        mkdir -p current
        cp -r /tmp/deploy/* current/
        
        # Build and start services
        cd current
        docker-compose build --no-cache
        docker-compose up -d
        
        # Wait for health check
        print_status "Waiting for health check..."
        sleep 45
        
        # Check if service is healthy
        if curl -f http://localhost:3000/health; then
            print_status "✅ Health check passed!"
            print_status "✅ Deployment successful!"
            docker-compose logs --tail=20 mcp-server
        else
            print_error "❌ Health check failed!"
            docker-compose logs mcp-server
            exit 1
        fi
DEPLOY_EOF
    
    if [ $? -eq 0 ]; then
        print_status "✅ Application deployed successfully"
    else
        print_error "❌ Deployment failed"
        exit 1
    fi
}

# Verify deployment
verify_deployment() {
    print_header "VERIFYING DEPLOYMENT"
    
    if [ -z "$EC2_IP" ]; then
        print_error "EC2 IP not found"
        exit 1
    fi
    
    # Wait for instance to be ready
    sleep 10
    
    # Check health endpoint
    print_status "Testing health endpoint..."
    local health_check_passed=false
    local attempts=0
    local max_attempts=10
    
    while [ "$health_check_passed" = false ] && [ $attempts -lt $max_attempts ]; do
        if curl -f http://"$EC2_IP":3000/health 2>/dev/null; then
            health_check_passed=true
        else
            echo -n "."
            sleep 15
            attempts=$((attempts + 1))
        fi
    done
    
    echo ""
    
    if [ "$health_check_passed" = true ]; then
        print_status "✅ Health check passed!"
        
        # Show service info
        echo ""
        print_header "SERVICE INFORMATION"
        print_status "🌐 MCP Server URL: http://$EC2_IP:3000"
        print_status "🏥 Health Endpoint: http://$EC2_IP:3000/health"
        print_status "ℹ️  Info Endpoint: http://$EC2_IP:3000/info"
        print_status "🔗 SSH: ssh -i ~/.ssh/$SSH_KEY_NAME.pem ec2-user@$EC2_IP"
        
        # Show health details
        echo ""
        print_status "Health check details:"
        curl -s http://"$EC2_IP":3000/health | jq '.' 2>/dev/null || curl -s http://"$EC2_IP":3000/health
        
    else
        print_error "❌ Health check failed!"
        print_error "Please check the deployment logs:"
        echo "ssh -i ~/.ssh/$SSH_KEY_NAME.pem ec2-user@$EC2_IP 'cd /opt/restorepoint/current && docker-compose logs mcp-server'"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        print_error "Deployment failed. Check logs above for details."
    fi
}

# Main execution
main() {
    print_header "RESTOREPOINT MCP SERVER AWS DEPLOYMENT"
    print_status "Starting deployment process..."
    echo ""
    
    # Trap for cleanup
    trap cleanup EXIT
    
    check_prerequisites
    create_infrastructure
    deploy_application
    verify_deployment
    
    echo ""
    print_header "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
    print_status "Your MCP server is now running on AWS!"
    echo ""
    print_status "Next steps:"
    print_status "1. Test your MCP server: curl http://$EC2_IP:3000/info"
    print_status "2. Configure Claude Desktop to use the remote MCP server"
    print_status "3. Check logs: ssh -i ~/.ssh/$SSH_KEY_NAME.pem ec2-user@$EC2_IP 'docker-compose logs -f'"
    echo ""
    print_status "Documentation: RESTOREPOINT_CHAT_ARCHITECTURE.md"
    print_status "Docker Guide: DOCKER_DEPLOYMENT_GUIDE.md"
    print_status "Next Steps: NEXT_STEPS.md"
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --region REGION          AWS region (default: us-east-1)"
    echo "  --instance-type TYPE     EC2 instance type (default: t3.micro)"
    echo "  --key-name NAME          SSH key pair name (default: \$USER-key-pair)"
    echo "  --repo-url URL           Git repository URL"
    echo "  --branch BRANCH          Git branch (default: main)"
    echo "  --help                   Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  AWS_REGION              AWS region"
    echo "  EC2_INSTANCE_NAME       EC2 instance name tag"
    echo "  EC2_INSTANCE_TYPE       EC2 instance type"
    echo "  SSH_KEY_NAME            SSH key pair name"
    echo "  REPO_URL                Git repository URL"
    echo "  BRANCH                  Git branch"
    echo ""
    echo "Example:"
    echo "  $0 --region us-west-2 --instance-type t3.small"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --region)
            AWS_REGION="$2"
            shift 2
            ;;
        --instance-type)
            EC2_INSTANCE_TYPE="$2"
            shift 2
            ;;
        --key-name)
            SSH_KEY_NAME="$2"
            shift 2
            ;;
        --repo-url)
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

# Run main function
main "$@"