# RP_SL1_MCP Server Setup & Testing Guide

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Restorepoint server accessible from your network
- Your API token ready

### 1. Configuration

Create/Edit `config.json`:
```json
{
  "restorepoint": {
    "serverUrl": "https://your-restorepoint-server.com",
    "apiVersion": "v2", 
    "token": "your-api-token-here",
    "timeout": 30000
  },
  "mcp": {
    "serverName": "RP_SL1_MCP",
    "version": "1.0.0",
    "logLevel": "info"
  }
}
```

### 2. Start Server

**Development Mode (Recommended):**
```bash
cd RP_SL1_MCP
npm run dev
```

**Production Mode:**
```bash
cd RP_SL1_MCP
npm run build
npm start
```

### 3. Stop Server

**Ctrl+C** in terminal or send SIGTERM signal

## Testing the MCP Server

### Method 1: MCP Inspector (Recommended)

1. Install MCP Inspector:
```bash
npm install -g @modelcontextprotocol/inspector
```

2. Run server with inspector:
```bash
cd RP_SL1_MCP
npx tsx src/server.ts | npx mcp-inspector
```

3. Open browser to `http://localhost:3000`

4. Test available tools:
   - `list_devices` - List all devices
   - `create_backup` - Start backup operation
   - `get_task_status` - Check task progress
   - `execute_command` - Execute commands

### Method 2: Claude Desktop Integration

1. Install Claude Desktop
2. Add to Claude Desktop settings:
```json
{
  "mcpServers": {
    "restorepoint": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "/path/to/RP_SL1_MCP"
    }
  }
}
```

3. Restart Claude Desktop

### Method 3: Manual Testing

1. Start server in one terminal:
```bash
npx tsx src/server.ts
```

2. In another terminal, send MCP requests via STDIN:
```bash
# List available tools
echo '{"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 1}' | npx tsx src/server.ts

# Execute a tool
echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "list_devices", "arguments": {"limit": 5}}, "id": 2}' | npx tsx src/server.ts
```

## Test Scenarios

### Test 1: List Devices
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_devices",
    "arguments": {
      "limit": 10
    }
  },
  "id": "test-1"
}
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"success\":true,\"data\":[{\"id\":\"device-001\",\"name\":\"Router-01\"}],\"total\":1,\"message\":\"Found 1 devices\"}"
    }]
  },
  "id": "test-1"
}
```

### Test 2: Create Backup
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_backup",
    "arguments": {
      "deviceIds": ["device-001", "device-002"],
      "backupName": "Test Backup"
    }
  },
  "id": "test-2"
}
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"success\":true,\"taskId\":\"backup_12345\",\"message\":\"Backup started for 2 devices\"}"
    }]
  },
  "id": "test-2"
}
```

### Test 3: Check Task Status
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_task_status",
    "arguments": {
      "taskId": "backup_12345"
    }
  },
  "id": "test-3"
}
```

## Troubleshooting

### Server Won't Start
1. Check Node.js version: `node --version` (should be 18+)
2. Check dependencies: `npm install`
3. Check config.json syntax
4. Check network connectivity to Restorepoint server

### Tools Not Working
1. Verify config.json has correct API token
2. Check server logs for connection errors
3. Test Restorepoint API directly:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://your-restorepoint-server.com/api/v2/devices
```

### Performance Issues
1. Check log level in config.json (set to "warn" for production)
2. Monitor memory usage with: `top -p $(pgrep node)`
3. Check task manager for running async operations

## Production Deployment

### AWS EC2 Native Deployment
```bash
# Deploy to AWS EC2 instance
./deployment/scripts/deploy-to-aws.sh --ip YOUR_EC2_IP --key YOUR_KEY.pem

# Or manual deployment:
# 1. Clone repo to EC2
# 2. npm install && npm run build
# 3. ENABLE_HTTP_SERVER=true NODE_ENV=production node dist/server.js
```

### PM2 Process Manager (Alternative)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

### Monitoring
- Logs: `tail -f logs/*.log`
- Process: `pm2 monit`
- Health Check: `curl http://localhost:3000/health`

## API Reference

### Available Tools
| Tool | Description | Parameters |
|------|-------------|------------|
| `list_devices` | List all devices | `limit` (optional) |
| `create_backup` | Start backup | `deviceIds` (required), `backupName` (optional) |
| `get_task_status` | Check task progress | `taskId` (required) |
| `execute_command` | Execute command | `deviceIds` (required), `command` (required) |

### Configuration Options
| Setting | Description | Default |
|---------|-------------|---------|
| `restorepoint.serverUrl` | Restorepoint server URL | Required |
| `restorepoint.apiVersion` | API version | "v2" |
| `restorepoint.token` | Authentication token | Required |
| `restorepoint.timeout` | Request timeout (ms) | 30000 |
| `mcp.logLevel` | Logging level | "info" |

## Support

### Common Issues
- **Connection Failed**: Verify server URL and API token
- **Token Expired**: Update token in config.json and restart
- **Performance**: Adjust `maxConcurrentTasks` in config.json

### Getting Help
1. Check server logs: `tail -f logs/combined.log`
2. Validate config: `npm run validate-config`
3. Test API connectivity manually
4. Check Restorepoint server status