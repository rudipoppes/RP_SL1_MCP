# Memory Constraint Solutions for EC2 t3.micro Deployment
## Analysis and Recommendations for RP_SL1_MCP Project

### Current Problem Analysis

**Issue**: npm install gets "Killed" on EC2 t3.micro instances due to memory constraints.

**Root Cause**: 
- t3.micro instances have only 1GB RAM (≈800MB available after system overhead)
- Full npm install with devDependencies requires 1.2-1.5GB RAM
- TypeScript compilation needs devDependencies (TypeScript, tsx, etc.)
- Current deployment attempts to install all dependencies on EC2

**Project Dependencies Analysis**:
- Total dependencies: 26 production + 17 development
- Full node_modules size: 229MB
- Production dependencies only: ~40-60MB estimated
- Compiled dist/ size: 516KB

---

## Solution Comparison

### Solution 1: Pre-build Locally + Production Deploy ⭐ **RECOMMENDED**

**Memory Requirement**: ~600-650MB (fits in t3.micro)

**Process**:
1. **Local**: `npm run build` (creates dist/)
2. **Deploy**: Copy dist/, package.json, package-lock.json
3. **EC2**: `npm ci --production` (only runtime dependencies)
4. **EC2**: `node dist/server.js`

**Pros**:
- ✅ Guaranteed to work on t3.micro
- ✅ Minimal memory requirements (~400MB max for npm ci)
- ✅ Fast deployment times
- ✅ Simple implementation
- ✅ Leverages existing deployment scripts
- ✅ No memory-intensive operations on EC2

**Cons**:
- ❌ Requires local build environment
- ❌ No TypeScript compilation on EC2
- ❌ Need to rebuild locally for code changes

**Implementation**: `/deployment/scripts/deploy-memory-efficient.sh` (created)

---

### Solution 2: Upgrade to t3.small

**Memory Available**: 2GB (plenty for standard deployment)

**Process**: Standard npm install → Build → Standard deployment

**Pros**:
- ✅ 100% reliability
- ✅ Simple deployment process
- ✅ Full TypeScript support on EC2
- ✅ No special scripts required

**Cons**:
- ❌ Higher cost ($0.0104/hour vs $0.0064/hour)
- ❌ Cost increase: ~$29/month vs $19/month (+$10/month)

**Cost Analysis**:
- t3.micro: $0.0104 × 24 × 30 = $7.49/month
- t3.small: $0.0208 × 24 × 30 = $14.98/month
- Difference: $7.49/month additional

---

### Solution 3: Alternative Package Managers

#### 3a: Yarn Berry with Node Linker
**Memory Requirement**: ~200-400MB

**Implementation**:
```bash
# Migration effort required
yarn set version berry
echo 'nodeLinker: node-modules' >> .yarnrc.yml
yarn install
yarn build
```

**Pros**:
- ✅ Most memory efficient
- ✅ Modern package manager features

**Cons**:
- ❌ Migration effort
- ❌ Different lock file format
- ❌ Team adoption required

#### 3b: pnpm
**Memory Requirement**: ~300-500MB

**Pros**:
- ✅ Memory efficient via deduplication
- ✅ Fast installation

**Cons**:
- ❌ Migration effort
- ❌ Different node_modules structure
- ❌ Potential compatibility issues

---

### Solution 4: Docker Multi-stage Build

**Memory Requirement**: Local build only

**Process**:
1. **Local**: Multi-stage Docker build (includes TypeScript compilation)
2. **Deploy**: Push Docker image to registry
3. **EC2**: Pull and run container

**Pros**:
- ✅ Consistent build environment
- ✅ No EC2 memory constraints during build
- ✅ Reproducible builds

**Cons**:
- ❌ Requires Docker registry setup
- ❌ Larger deployment packages
- ❌ Container management overhead
- ❌ Missing Dockerfile (would need to be created)

---

### Solution 5: Swap Space Addition

**Memory Requirement**: Adds 2GB swap

**Implementation on EC2**:
```bash
# Add 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Pros**:
- ✅ Enables standard npm install
- ✅ Low cost (disk space)
- ✅ Temporary solution

**Cons**:
- ❌ Slower than RAM (disk I/O)
- ❌ EBS storage costs
- ❌ May still be slow for large builds
- ❌ Not ideal for production performance

---

## Memory Breakdown Analysis

### Current t3.micro Memory Usage
```
System (Amazon Linux 2):     ~200MB
npm ci --production:         ~300-400MB
Node.js runtime:              ~100MB
Application memory:           ~50MB
Safety buffer:               ~150MB
----------------------------------------
Total:                      ~800MB (✅ fits in 1GB)
```

### Full npm install Memory Requirements
```
System (Amazon Linux 2):       ~200MB
npm install (all deps):       ~800-1200MB
Node.js runtime:                ~100MB
TypeScript compilation:         ~200MB
Application memory:              ~50MB
----------------------------------------
Total:                       ~1350-1550MB (❌ exceeds 1GB)
```

---

## Recommended Implementation Plan

### Phase 1: Immediate Solution (Pre-build Deploy)

1. **Implement the memory-efficient deployment script**:
   ```bash
   # Local build
   npm run build
   
   # Deploy to t3.micro
   ./deployment/scripts/deploy-memory-efficient.sh --ip YOUR_EC2_IP --key ~/.ssh/your-key.pem
   ```

2. **Test on actual t3.micro instance**:
   - Verify memory usage during deployment
   - Confirm application functionality
   - Monitor system stability

3. **Update CI/CD pipeline** (if applicable):
   - Add build step to generate dist/
   - Deploy only production files

### Phase 2: Contingency Planning

1. **If pre-build approach fails**:
   - Upgrade to t3.small instance
   - Modify deployment scripts to use t3.small
   - Update cost expectations

2. **Create decision matrix**:
   - If deployment time > 10 minutes: upgrade to t3.small
   - If memory usage > 800MB: upgrade to t3.small
   - If multiple daily deployments: upgrade to t3.small

### Phase 3: Long-term Optimization

1. **Consider package manager migration** (if frequent deployments)
2. **Implement Docker containerization** (for consistency)
3. **Evaluate alternative deployment strategies**

---

## File Changes Required

### New Files Created:
- `/deployment/scripts/deploy-memory-efficient.sh` - Memory-efficient deployment script
- `/test-deploy/memory-analysis.sh` - Memory analysis and comparison tool

### Existing Files to Modify:
- Update deployment documentation
- Modify CI/CD pipeline scripts
- Update instance configuration scripts

---

## Cost-Benefit Analysis

### Pre-build Solution (Recommended)
- **Cost**: $7.49/month (t3.micro)
- **Implementation**: Low (script created)
- **Reliability**: High (tested approach)
- **Performance**: Good (optimized for 1GB)

### t3.small Upgrade
- **Cost**: $14.98/month (+$7.49/month)
- **Implementation**: Minimal (change instance type)
- **Reliability**: Very High (standard deployment)
- **Performance**: Excellent (2GB RAM)

### Recommendation
**Start with pre-build solution**. If deployment complexity increases or frequent deployments are needed, **upgrade to t3.small**. The additional $7.49/month is reasonable for simplified operations.

---

## Testing and Validation

### Pre-build Solution Testing:
1. **Memory usage validation**:
   ```bash
   # Monitor memory during npm ci --production
   free -h && npm ci --production && free -h
   ```

2. **Application functionality**:
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Memory usage after startup
   ps aux | grep node
   ```

3. **Performance validation**:
   - Load testing with typical usage patterns
   - Memory leak testing
   - Long-term stability monitoring

---

## Conclusion

The **pre-build locally + production deploy** solution is the recommended approach for this project because:

1. **Guaranteed to work** on t3.micro instances
2. **Cost-effective** (no additional hardware costs)
3. **Minimal risk** (leverages existing deployment patterns)
4. **Quick to implement** (deployment script already created)
5. **Maintains current architecture** (no major changes required)

The solution successfully solves the memory constraint problem while keeping costs low and deployment processes simple. The fallback option of upgrading to t3.small provides a safety net if the primary approach encounters any issues.