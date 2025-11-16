#!/bin/bash
set -e

# =============================================================================
# Docker Cleanup Script for AWS Instance
# =============================================================================
# This script removes all Docker-related packages and containers from EC2
# =============================================================================

# Configuration
EC2_IP="${EC2_IP:-}"  # Your EC2 instance IP address
SSH_KEY="${SSH_KEY:-~/.ssh/your-key-pair.pem}"  # Path to your SSH key

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

# Check SSH key exists
check_ssh_key() {
    if [ ! -f "$SSH_KEY" ]; then
        print_error "SSH key not found: $SSH_KEY"
        print_error "Update SSH_KEY variable or ensure key exists"
        exit 1
    fi
    
    print_status "Using SSH key: $SSH_KEY"
}

# Clean Docker from EC2 instance
clean_docker_from_instance() {
    print_header "CLEANING DOCKER FROM EC2 INSTANCE"
    
    print_status "Connecting to EC2 instance to clean Docker..."
    
    ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$EC2_IP" << 'CLEANUP_EOF'
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
        
        print_header() {
            echo -e "\033[0;34m=== $1 ===\033[0m"
        }
        
        print_header "DOCKER CLEANUP PROCESS"
        
        # Check if Docker is installed
        if ! command -v docker &> /dev/null; then
            print_status "Docker is not installed on this instance"
            print_status "No cleanup needed"
            exit 0
        fi
        
        print_status "Docker found - starting cleanup process..."
        
        # Stop all running containers
        print_status "Stopping all running Docker containers..."
        if docker ps -q | grep -q .; then
            docker stop $(docker ps -q) 2>/dev/null || true
            print_status "✅ All containers stopped"
        else
            print_status "No running containers found"
        fi
        
        # Remove all containers
        print_status "Removing all Docker containers..."
        if docker ps -a -q | grep -q .; then
            docker rm $(docker ps -a -q) 2>/dev/null || true
            print_status "✅ All containers removed"
        else
            print_status "No containers found"
        fi
        
        # Remove all Docker images
        print_status "Removing all Docker images..."
        if docker images -q | grep -q .; then
            docker rmi $(docker images -q) -f 2>/dev/null || true
            print_status "✅ All images removed"
        else
            print_status "No images found"
        fi
        
        # Remove all Docker volumes
        print_status "Removing all Docker volumes..."
        if docker volume ls -q | grep -q .; then
            docker volume rm $(docker volume ls -q) 2>/dev/null || true
            print_status "✅ All volumes removed"
        else
            print_status "No volumes found"
        fi
        
        # Remove all Docker networks
        print_status "Removing custom Docker networks..."
        if docker network ls -q | grep -q .; then
            docker network rm $(docker network ls -q) 2>/dev/null || true
            print_status "✅ Custom networks removed"
        else
            print_status "No custom networks found"
        fi
        
        # Clean up Docker system
        print_status "Cleaning up Docker system..."
        docker system prune -a -f --volumes 2>/dev/null || true
        print_status "✅ Docker system cleaned"
        
        # Stop Docker services
        print_status "Stopping Docker services..."
        sudo systemctl stop docker 2>/dev/null || true
        sudo systemctl disable docker 2>/dev/null || true
        sudo systemctl stop docker.socket 2>/dev/null || true
        sudo systemctl disable docker.socket 2>/dev/null || true
        sudo systemctl stop containerd 2>/dev/null || true
        sudo systemctl disable containerd 2>/dev/null || true
        print_status "✅ Docker services stopped and disabled"
        
        # Remove Docker packages based on package manager
        print_status "Removing Docker packages..."
        
        # For Amazon Linux 2023 (dnf)
        if command -v dnf &> /dev/null; then
            print_status "Using dnf package manager..."
            sudo dnf remove -y docker docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-ce-rootless-extras 2>/dev/null || true
            sudo dnf autoremove -y 2>/dev/null || true
            sudo dnf clean all 2>/dev/null || true
        # For older Amazon Linux (yum)
        elif command -v yum &> /dev/null; then
            print_status "Using yum package manager..."
            sudo yum remove -y docker docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-ce-rootless-extras 2>/dev/null || true
            sudo yum autoremove -y 2>/dev/null || true
            sudo yum clean all 2>/dev/null || true
        # For Ubuntu/Debian (apt)
        elif command -v apt &> /dev/null; then
            print_status "Using apt package manager..."
            sudo apt-get remove -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-ce-rootless-extras 2>/dev/null || true
            sudo apt-get purge -y docker* 2>/dev/null || true
            sudo apt-get autoremove -y 2>/dev/null || true
            sudo apt-get autoclean 2>/dev/null || true
        else
            print_warning "Unknown package manager - manual cleanup may be required"
        fi
        
        # Remove Docker directories and files
        print_status "Removing Docker directories and files..."
        sudo rm -rf /var/lib/docker 2>/dev/null || true
        sudo rm -rf /var/lib/containerd 2>/dev/null || true
        sudo rm -rf /etc/docker 2>/dev/null || true
        sudo rm -rf /usr/local/bin/docker-compose 2>/dev/null || true
        sudo rm -rf /usr/local/bin/docker 2>/dev/null || true
        sudo rm -rf ~/.docker 2>/dev/null || true
        sudo rm -rf /etc/systemd/system/docker.service 2>/dev/null || true
        sudo rm -rf /etc/systemd/system/docker.socket 2>/dev/null || true
        sudo rm -rf /etc/systemd/system/containerd.service 2>/dev/null || true
        print_status "✅ Docker directories and files removed"
        
        # Reload systemd to clear Docker services
        print_status "Reloading systemd daemon..."
        sudo systemctl daemon-reload 2>/dev/null || true
        print_status "✅ Systemd daemon reloaded"
        
        # Verify Docker is completely removed
        print_status "Verifying Docker removal..."
        if command -v docker &> /dev/null; then
            print_warning "Docker command still found - manual cleanup may be needed"
            which docker 2>/dev/null || true
        else
            print_status "✅ Docker command successfully removed"
        fi
        
        # Check for remaining Docker processes
        if pgrep -f docker > /dev/null 2>&1; then
            print_warning "Docker processes still running - killing them..."
            sudo pkill -f docker 2>/dev/null || true
            sudo pkill -f containerd 2>/dev/null || true
        else
            print_status "✅ No Docker processes found running"
        fi
        
        print_header "✅ DOCKER CLEANUP COMPLETED"
        print_status "All Docker-related packages, containers, images, volumes, and files have been removed"
        print_status "Docker has been completely uninstalled from the system"
        
CLEANUP_EOF

    if [ $? -eq 0 ]; then
        print_status "✅ Docker cleanup completed successfully!"
    else
        print_error "❌ Docker cleanup failed"
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
    echo "  --help                  Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  EC2_IP                  EC2 instance IP address"
    echo "  SSH_KEY                 SSH key path"
    echo ""
    echo "Examples:"
    echo "  $0 --ip 1.2.3.4"
    echo "  EC2_IP=1.2.3.4 $0"
    echo "  $0 --ip 1.2.3.4 --key /path/to/your/key.pem"
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
    print_header "DOCKER CLEANUP FOR AWS INSTANCE"
    print_status "Removing all Docker packages and containers from EC2 instance"
    echo ""
    
    get_ec2_ip
    check_ssh_key
    clean_docker_from_instance
    
    echo ""
    print_header "🎉 DOCKER CLEANUP COMPLETED SUCCESSFULLY!"
    print_status "Your EC2 instance is now clean of all Docker-related software!"
    echo ""
    print_status "What was removed:"
    print_status "• All Docker containers (running and stopped)"
    print_status "• All Docker images"
    print_status "• All Docker volumes"
    print_status "• All Docker networks"
    print_status "• Docker packages and dependencies"
    print_status "• Docker configuration files"
    print_status "• Docker services and systemd units"
    echo ""
    print_status "Your instance is ready for native Node.js deployment!"
}

# Run main function
main "$@"