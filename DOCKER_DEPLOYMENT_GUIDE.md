# 🐳 **Docker Deployment Guide**
## Containerizing & Deploying RP_SL1_MCP Server to AWS

---

## **🚨 CRITICAL FINDING**

### **Current State: NOT Ready for Docker Deployment**
Your existing MCP server **lacks essential Docker files**:

- ❌ **No Dockerfile**
- ❌ **No docker-compose.yml** 
- ❌ **No .dockerignore**

While `package.json` references `docker:build` and `docker:run` scripts, **the Docker files don't exist**. This means:
- Manual deployment required (error-prone)
- No consistent deployment environment
- Blocking AWS deployment completely
- Cannot use modern container orchestration

**This must be FIXED first before any AWS deployment.**

---

## **📋 OVERVIEW**

### **Purpose**
Create production-ready Docker deployment for your existing MCP server, enabling:
- ✅ One-command AWS deployment
- ✅ Consistent development/production environments  
- ✅ Easy scaling and management
- ✅ Foundation for the chat interface architecture

### **Prerequisites**
- Node.js 18+ installed locally
- Docker Desktop (or Docker Engine) installed
- AWS account with EC2 access
- Your Restorepoint API token

---

## **🐳 DOCKER FILES CREATION**

### **1. Optimized Multi-Stage Dockerfile**

```dockerfile
# ---- Build Stage ----
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ---- Production Stage ----
FROM node:18-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy configuration files
COPY --chown=nodejs:nodejs config.json ./config.json.example

# Create logs directory
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose MCP server port (for HTTP transport if used)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV TZ=UTC

# Start the application
CMD ["node", "dist/server.js"]
```

### **2. Development docker-compose.yml**

```yaml
version: '3.8'

services:
  # MCP Server Development
  mcp-server:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder  # Use build stage for development
    container_name: rp-sl1-mcp-dev
    working_dir: /app
    command: npm run dev
    volumes:
      # Mount source code for live reloading
      - ./src:/app/src
      - ./config.json:/app/config.json:ro
      - ./logs:/app/logs
    environment:
      - NODE_ENV=development
      - TZ=UTC
    ports:
      - "3000:3000"  # If using HTTP transport
    restart: unless-stopped
    healthcheck:
      disable: true  # Disable in development
    networks:
      - restorepoint-network

  # MCP Inspector (for development testing)
  mcp-inspector:
    image: node:18-alpine
    container_name: rp-sl1-mcp-inspector
    command: >
      sh -c "npm install -g @modelcontextprotocol/inspector && 
             npx tsx watch /app/src/server.ts | npx mcp-inspector"
    volumes:
      - ./src:/app/src
      - ./config.json:/app/config.json:ro
    ports:
      - "3000:3000"  # Inspector UI
    depends_on:
      - mcp-server
    networks:
      - restorepoint-network
    profiles:
      - inspector  # Only start with --profile inspector

networks:
  restorepoint-network:
    driver: bridge
    name: restorepoint-network

volumes:
  logs:
    driver: local
```

### **3. Production docker-compose.yml**

```yaml
version: '3.8'

services:
  # MCP Server Production
  mcp-server:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: restorepoint/mcp-server:latest
    container_name: rp-sl1-mcp-prod
    restart: unless-stopped
    volumes:
      - ./config.json:/app/config.json:ro
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - TZ=UTC
    ports:
      - "3000:3000"  # HTTP transport port
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - restorepoint-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Nginx Reverse Proxy (Optional)
  nginx:
    image: nginx:alpine
    container_name: rp-sl1-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - mcp-server
    networks:
      - restorepoint-network
    profiles:
      - nginx  # Only start with --profile nginx

networks:
  restorepoint-network:
    driver: bridge
    name: restorepoint-network

volumes:
  logs:
    driver: local
```

### **4. .dockerignore**

```dockerignore
# Node modules (will be rebuilt in container)
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Development files
.git/
.gitignore
README.md
docs/
*.md

# Test files
test/
tests/
coverage/
.nyc_output

# Development configuration
.env
.env.local
.env.development
.env.test

# Build artifacts (will be rebuilt)
dist/
build/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs (will be created in container)
logs/
*.log

# Temporary files
tmp/
temp/
.tmp/

# Docker files
Dockerfile*
docker-compose*
.dockerignore
```

---

## **🔧 MCP SERVER ENHANCEMENTS**

### **Add Health Check Endpoint**

Your MCP server needs a health check endpoint for Docker monitoring.

#### **Add to `src/server.ts`:**

```typescript
/**
 * Health check endpoint for Docker monitoring
 */
if (process.env.NODE_ENV === 'production' || process.argv.includes('--enable-http')) {
  const express = require('express')();
  const port = process.env.PORT || 3000;
  
  // Health check endpoint
  express.get('/health', (req: any, res: any) => {
    const isHealthy = this.apiClient !== undefined;
    const status = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      server: MCP_CONSTANTS.SERVER_NAME,
      version: MCP_CONSTANTS.SERVER_VERSION,
      tools: this.tools.length
    };
    
    res.status(isHealthy ? 200 : 503).json(status);
  });
  
  // Basic info endpoint
  express.get('/info', (req: any, res: any) => {
    res.json({
      server: MCP_CONSTANTS.SERVER_NAME,
      version: MCP_CONSTANTS.SERVER_VERSION,
      tools: this.tools.map(tool => ({
        name: tool.name,
        description: tool.description
      })),
      endpoints: {
        health: '/health',
        info: '/info',
        mcp: 'stdio (MCP protocol)'
      }
    });
  });
  
  express.listen(port, '0.0.0.0', () => {
    Logger.logWithContext('info', `HTTP server listening on port ${port}`, 'MCPServer');
  });
}
```

### **Update `package.json` scripts:**

```json
{
  "scripts": {
    "docker:build": "docker build -t rp-sl1-mcp .",
    "docker:run": "docker-compose up -d",
    "docker:dev": "docker-compose -f docker-compose.yml -f docker-compose.override.yml up",
    "docker:prod": "docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d",
    "docker:stop": "docker-compose down",
    "docker:logs": "docker-compose logs -f mcp-server",
    "docker:clean": "docker-compose down -v && docker system prune -f"
  }
}
```

---

## **🚀 AWS DEPLOYMENT SETUP**

### **1. AWS EC2 Instance Setup**

#### **Launch EC2 Instance:**

```bash
# 1. Create AWS CLI profile (if not exists)
aws configure --profile restorepoint

# 2. Create security group
aws ec2 create-security-group \
  --group-name restorepoint-mcp-sg \
  --description "Security group for Restorepoint MCP server" \
  --profile restorepoint

# 3. Add security group rules
aws ec2 authorize-security-group-ingress \
  --group-id $(aws ec2 describe-security-groups \
    --group-names restorepoint-mcp-sg \
    --query 'SecurityGroups[0].GroupId' \
    --output text --profile restorepoint) \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0 \
  --profile restorepoint

aws ec2 authorize-security-group-ingress \
  --group-id $(aws ec2 describe-security-groups \
    --group-names restorepoint-mcp-sg \
    --query 'SecurityGroups[0].GroupId' \
    --output text --profile restorepoint) \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0 \
  --profile restorepoint

# 4. Launch EC2 instance
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.micro \
  --key-name your-key-pair \
  --security-group-ids restorepoint-mcp-sg \
  --user-data file://user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=restorepoint-mcp-server}]' \
  --profile restorepoint
```

#### **User Data Script (`user-data.sh`):**

```bash
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

# Clone repository (replace with your repo)
git clone https://github.com/your-username/RP_SL1_MCP.git .

# Create logs directory
mkdir -p logs

# Set permissions
chown -R ec2-user:ec2-user /opt/restorepoint

# Create systemd service for Docker Compose
cat > /etc/systemd/system/restorepoint-mcp.service << 'EOF'
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
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable restorepoint-mcp.service
```

### **2. Deployment Script**

#### **`deploy.sh`**

```bash
#!/bin/bash
set -e

# Configuration
AWS_REGION="us-east-1"
EC2_INSTANCE_NAME="restorepoint-mcp-server"
REPO_URL="https://github.com/your-username/RP_SL1_MCP.git"
BRANCH="main"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install AWS CLI first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. Please install Docker first."
        exit 1
    fi
    
    if ! command -v ssh &> /dev/null; then
        print_error "SSH not found. Please install SSH client first."
        exit 1
    fi
    
    print_status "All prerequisites found."
}

# Get EC2 instance IP
get_ec2_ip() {
    print_status "Getting EC2 instance IP..."
    
    EC2_IP=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=$EC2_INSTANCE_NAME" "Name=instance-state-name,Values=running" \
        --query "Reservations[0].Instances[0].PublicIpAddress" \
        --output text \
        --region $AWS_REGION 2>/dev/null || echo "")
    
    if [ -z "$EC2_IP" ]; then
        print_error "EC2 instance not found or not running. Please check instance name and region."
        exit 1
    fi
    
    print_status "EC2 IP: $EC2_IP"
}

# Deploy to EC2
deploy_to_ec2() {
    print_status "Deploying to EC2 instance..."
    
    # Copy files to EC2
    print_status "Copying files to EC2..."
    scp -o StrictHostKeyChecking=no -i ~/.ssh/your-key-pair.pem \
        -r ./* ec2-user@$EC2_IP:/opt/restorepoint/
    
    # Deploy on EC2
    print_status "Running deployment on EC2..."
    ssh -o StrictHostKeyChecking=no -i ~/.ssh/your-key-pair.pem ec2-user@$EC2_IP << 'EOF'
        cd /opt/restorepoint
        
        # Stop existing services
        docker-compose down || true
        
        # Build and start services
        docker-compose build --no-cache
        docker-compose up -d
        
        # Wait for health check
        sleep 30
        
        # Check if service is healthy
        if curl -f http://localhost:3000/health; then
            echo "Deployment successful!"
            docker-compose logs mcp-server
        else
            echo "Health check failed!"
            docker-compose logs mcp-server
            exit 1
        fi
EOF
    
    print_status "Deployment completed!"
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Wait for instance to be ready
    sleep 10
    
    # Check health endpoint
    if curl -f http://$EC2_IP:3000/health; then
        print_status "✅ Health check passed!"
        print_status "✅ MCP Server is running at: http://$EC2_IP:3000"
        print_status "✅ Health endpoint: http://$EC2_IP:3000/health"
        print_status "✅ Info endpoint: http://$EC2_IP:3000/info"
    else
        print_error "❌ Health check failed!"
        print_error "Please check the deployment logs:"
        echo "ssh -i ~/.ssh/your-key-pair.pem ec2-user@$EC2_IP 'cd /opt/restorepoint && docker-compose logs mcp-server'"
        exit 1
    fi
}

# Main execution
main() {
    print_status "Starting RP_SL1_MCP deployment to AWS..."
    
    check_prerequisites
    get_ec2_ip
    deploy_to_ec2
    verify_deployment
    
    print_status "🎉 Deployment completed successfully!"
    print_status "Next steps:"
    print_status "1. Test your MCP server: curl http://$EC2_IP:3000/info"
    print_status "2. Configure Claude Desktop to use: ssh -i ~/.ssh/your-key-pair.pem ec2-user@$EC2_IP 'cd /opt/restorepoint && node dist/server.js'"
}

# Run main function
main "$@"
```

### **3. Local Development Workflow**

#### **Quick Start Commands:**

```bash
# 1. Create config.json
cp config.json.example config.json
# Edit config.json with your Restorepoint details

# 2. Start development environment
npm run docker:dev

# 3. View logs
npm run docker:logs

# 4. Stop development environment
npm run docker:stop

# 5. Start with inspector (for testing)
docker-compose --profile inspector up
```

#### **Testing Commands:**

```bash
# Test MCP server locally
curl http://localhost:3000/health
curl http://localhost:3000/info

# Test with MCP Inspector
docker-compose --profile inspector up
# Open browser to http://localhost:3000

# Run tests in container
docker-compose exec mcp-server npm test

# Build for production
docker-compose build --target production
```

---

## **📊 DEPLOYMENT OPTIONS**

### **Option 1: Docker Compose (Recommended for Development)**

**Pros:**
- Simple setup
- Good for local development
- Easy to understand
- Included Docker Compose files

**Cons:**
- Manual scaling required
- Basic monitoring only
- Less production-ready

**Use Case:** Development, testing, and simple deployments

### **Option 2: Docker Swarm (Good for Production)**

**Pros:**
- Built-in orchestration
- Better scaling
- Load balancing
- Rolling updates

**Cons:**
- More complex setup
- Less flexible than Kubernetes
- Smaller ecosystem

**Use Case:** Production deployments requiring scaling

### **Option 3: Kubernetes (Enterprise Production)**

**Pros:**
- Most powerful orchestration
- Auto-scaling
- Self-healing
- Large ecosystem

**Cons:**
- Complex setup
- Overkill for small deployments
- Steep learning curve

**Use Case:** Large enterprise deployments

---

## **🔍 MONITORING & LOGGING**

### **1. Application Logs**

```bash
# View real-time logs
docker-compose logs -f mcp-server

# View last 100 lines
docker-compose logs --tail=100 mcp-server

# View logs from last hour
docker-compose logs --since=1h mcp-server
```

### **2. Health Monitoring**

```bash
# Check health status
curl http://localhost:3000/health

# Detailed status
curl http://localhost:3000/info

# Continuous health check
watch -n 30 'curl -f http://localhost:3000/health || echo "Health check failed"'
```

### **3. Resource Monitoring**

```bash
# Docker stats
docker stats rp-sl1-mcp-prod

# Container resource usage
docker stats --no-stream

# System resource usage
docker exec rp-sl1-mcp-prod top
```

### **4. Log Aggregation (Optional)**

#### **ELK Stack Integration:**

```yaml
# Add to docker-compose.yml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
  ports:
    - "9200:9200"

logstash:
  image: docker.elastic.co/logstash/logstash:8.5.0
  volumes:
    - ./logstash/pipeline:/usr/share/logstash/pipeline
  depends_on:
    - elasticsearch

kibana:
  image: docker.elastic.co/kibana/kibana:8.5.0
  ports:
    - "5601:5601"
  depends_on:
    - elasticsearch
```

---

## **🛠️ TROUBLESHOOTING**

### **Common Issues**

#### **1. Container Won't Start**

```bash
# Check container logs
docker-compose logs mcp-server

# Check container status
docker-compose ps

# Inspect container
docker inspect rp-sl1-mcp-prod

# Common fixes:
# - Check config.json format
# - Verify RESTOREPOINT_TOKEN
# - Check network connectivity
```

#### **2. Health Check Failing**

```bash
# Manual health check
docker exec rp-sl1-mcp-prod curl -f http://localhost:3000/health

# Check if port is exposed
docker exec rp-sl1-mcp-prod netstat -tlnp

# Check application logs for errors
docker-compose logs mcp-server | grep ERROR
```

#### **3. Connection Issues**

```bash
# Test Restorepoint connectivity from container
docker exec rp-sl1-mcp-prod curl -H "Authorization: Bearer $TOKEN" \
  https://your-restorepoint.com/api/v2/devices

# Check DNS resolution
docker exec rp-sl1-mcp-prod nslookup your-restorepoint.com

# Test outbound connectivity
docker exec rp-sl1-mcp-prod ping -c 3 8.8.8.8
```

#### **4. Performance Issues**

```bash
# Check resource usage
docker stats rp-sl1-mcp-prod

# Monitor memory usage
docker exec rp-sl1-mcp-prod free -h

# Check disk space
docker exec rp-sl1-mcp-prod df -h

# Profile Node.js application
docker exec rp-sl1-mcp-prod node --inspect dist/server.js
```

### **Recovery Procedures**

#### **Full Reset:**

```bash
# Stop all services
docker-compose down

# Remove all containers and volumes
docker-compose down -v

# Remove all Docker images
docker system prune -a --volumes

# Rebuild and start
docker-compose build --no-cache
docker-compose up -d
```

#### **Configuration Update:**

```bash
# Update config.json
vim config.json

# Restart container with new config
docker-compose restart mcp-server

# Verify new configuration
docker-compose logs mcp-server | grep "Configuration loaded"
```

---

## **📈 PERFORMANCE OPTIMIZATION**

### **1. Docker Image Optimization**

#### **Multi-stage Build Benefits:**
- **Size Reduction**: ~90% smaller final image
- **Security**: No development tools in production
- **Speed**: Faster deployment and startup

#### **Layer Caching:**
```dockerfile
# Optimize layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application code last
COPY . .
RUN npm run build
```

### **2. Runtime Optimization**

#### **Node.js Performance:**
```dockerfile
# Use production optimizations
ENV NODE_ENV=production
ENV UV_THREADPOOL_SIZE=16

# Memory optimizations
ENV NODE_OPTIONS="--max-old-space-size=512"
```

#### **Resource Limits:**
```yaml
# Add to docker-compose.yml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

### **3. Monitoring Setup**

#### **Prometheus Metrics (Optional):**
```typescript
// Add to server.ts
import client from 'prom-client';

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code']
});

// Export metrics endpoint
if (process.env.NODE_ENV === 'production') {
  express.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
}
```

---

## **🔄 CI/CD INTEGRATION**

### **GitHub Actions Workflow**

#### **`.github/workflows/docker.yml`:**

```yaml
name: Docker Build and Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run linting
      run: npm run lint
    
    - name: Type check
      run: npm run type-check

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    
    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: |
          restorepoint/mcp-server:latest
          restorepoint/mcp-server:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to AWS
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.EC2_HOST }}
        username: ec2-user
        key: ${{ secrets.EC2_SSH_KEY }}
        script: |
          cd /opt/restorepoint
          docker-compose pull
          docker-compose up -d
          docker system prune -f
```

---

## **📋 CHECKLIST**

### **Pre-Deployment Checklist:**

- [ ] Dockerfile created and tested
- [ ] docker-compose.yml created for development and production
- [ ] .dockerignore file created
- [ ] Health check endpoint added to MCP server
- [ ] Configuration files prepared (config.json)
- [ ] AWS EC2 instance launched and configured
- [ ] Security group rules configured (ports 22, 3000)
- [ ] Docker installed on EC2 instance
- [ ] SSH key access configured
- [ ] Deployment script tested

### **Post-Deployment Checklist:**

- [ ] Container is running and healthy
- [ ] Health check endpoint responding
- [ ] Logs showing successful initialization
- [ ] MCP tools working correctly
- [ ] Connection to Restorepoint API verified
- [ ] Monitoring and logging configured
- [ ] Backup procedures documented
- [ ] Recovery procedures tested

---

## **🎯 CONCLUSION**

This Docker deployment guide provides everything you need to containerize and deploy your MCP server to AWS. The key benefits:

✅ **One-Command Deployment**: Simple, repeatable deployments  
✅ **Production Ready**: Health checks, monitoring, logging  
✅ **Cost Effective**: Optimized for AWS t3.micro instance  
✅ **Scalable Foundation**: Easy to extend and scale  
✅ **DevOps Ready**: CI/CD integration included  

By completing this Docker setup, you'll have:
1. **Deployed MCP server** running on AWS
2. **Foundation** for the chat interface architecture
3. **Production-ready infrastructure** for future development
4. **Professional deployment process** for ongoing maintenance

**Next Step**: Execute this Docker deployment guide, then proceed with building the API gateway and React frontend as outlined in the architecture document.

**Estimated Time**: 1-2 days to complete Docker setup and AWS deployment  
**Prerequisites**: AWS account, Docker Desktop, basic knowledge of Docker and AWS  
**Success Criteria**: MCP server running on AWS with health checks passing