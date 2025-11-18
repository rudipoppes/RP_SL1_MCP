# RP_SL1_MCP Troubleshooting Guide

## Authentication Issues

### "sort field name is not permitted" Error
This error occurs when the API client uses incorrect authentication format.

**Problem**: MCP server was using `Authorization: Bearer <token>` 
**Solution**: Changed to `Authorization: Custom <token>` (Restorepoint's required format)

**Verification**:
```bash
# Test direct API connection
curl -k -H "Authorization: Custom YOUR_TOKEN" https://your-restorepoint-server.com/api/v2/devices

# Should return devices, not "Unauthorized"
```

### Empty Device Lists (0 devices when devices exist)

**Symptoms**:
- MCP returns `{"total": 0, "data": []}`
- Direct API calls to Restorepoint return 7 devices
- No error messages in logs

**Root Cause**: API client response transformation wasn't handling paginated responses correctly.

**Solution**: Updated device listing to handle both wrapped and raw API responses.

**Verification**:
```bash
# Test MCP API
curl -X POST "http://localhost:3000/tools/execute" \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_devices", "arguments": {"limit": 5}}' | jq '.data.metadata.total'

# Should return actual device count, not 0
```

## Server Issues

### Server Won't Start

1. **Check Node.js version**: 
   ```bash
   node --version  # Should be 18+
   ```

2. **Check dependencies**:
   ```bash
   npm install
   ```

3. **Check configuration**:
   ```bash
   cat config.json  # Verify valid JSON
   ```

4. **Check port availability**:
   ```bash
   lsof -i :3000  # Port should be free
   ```

### Server Starts but Tools Fail

1. **Check Restorepoint connectivity**:
   ```bash
   curl -k -H "Authorization: Custom YOUR_TOKEN" \
     https://your-restorepoint-server.com/api/v2/devices?limit=1
   ```

2. **Check token validity**:
   - Token should be from Restorepoint UI → Settings → API Tokens
   - Token should have appropriate permissions
   - Token should not be expired

3. **Check network connectivity**:
   ```bash
   ping your-restorepoint-server.com
   traceroute your-restorepoint-server.com
   ```

## Configuration Issues

### Invalid config.json

**Common problems**:
- Missing trailing commas
- Incorrect server URL (should include https://)
- Wrong API version (use "v2")
- Missing or invalid token

**Valid config.json example**:
```json
{
  "restorepoint": {
    "serverUrl": "https://restorepoint.example.com",
    "apiVersion": "v2",
    "token": "your-uuid-token-here",
    "timeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 1000
  },
  "mcp": {
    "serverName": "RP_SL1_MCP",
    "version": "1.0.0",
    "logLevel": "info",
    "maxConcurrentTasks": 10
  },
  "async": {
    "maxConcurrentTasks": 10,
    "taskTimeout": 3600000,
    "cleanupInterval": 300000
  }
}
```

## API Response Format Issues

### Understanding Restorepoint API Responses

**Device List Response Structure**:
```json
{
  "offset": 0,
  "limit": 50,
  "total": 7,
  "data": [
    {"ID": 13, "Name": "Device Name", ...}
  ]
}
```

**MCP Server Response**:
```json
{
  "success": true,
  "data": [...devices...],
  "metadata": {
    "total": 7,
    "limit": 5,
    "offset": 0,
    "hasMore": false
  }
}
```

### Debugging API Responses

1. **Enable debug logging** (temporarily):
   ```json
   "mcp": {
     "logLevel": "debug"
   }
   ```

2. **Check server logs**:
   ```bash
   tail -f logs/*.log
   ```

3. **Test with curl**:
   ```bash
   # Direct API call
   curl -k -H "Authorization: Custom YOUR_TOKEN" \
     "https://your-restorepoint-server.com/api/v2/devices?limit=2" | jq

   # MCP API call  
   curl -X POST "http://localhost:3000/tools/execute" \
     -H "Content-Type: application/json" \
     -d '{"tool": "list_devices", "arguments": {"limit": 2}}' | jq '.data'
   ```

## Performance Issues

### High Memory Usage

1. **Check process memory**:
   ```bash
   top -p $(pgrep node)
   ```

2. **Reduce log level**:
   ```json
   "mcp": {
     "logLevel": "warn"  // or "error"
   }
   ```

3. **Adjust concurrency**:
   ```json
   "async": {
     "maxConcurrentTasks": 5  // Reduce from default 10
   }
   ```

### Slow Response Times

1. **Check network latency**:
   ```bash
   ping -c 10 your-restorepoint-server.com
   ```

2. **Increase timeout**:
   ```json
   "restorepoint": {
     "timeout": 60000  // Increase from default 30000
   }
   ```

3. **Enable connection keepalive** (if available)

## Common Error Messages

### "Unauthorized"
- **Cause**: Invalid or expired token
- **Fix**: Generate new token in Restorepoint UI
- **Check**: Token format uses `Authorization: Custom`

### "sort field name is not permitted"  
- **Cause**: API client using wrong auth format
- **Fix**: Update to `Authorization: Custom <token>`
- **Location**: `src/auth/api-client.ts`

### "API client not available"
- **Cause**: API client failed to initialize
- **Fix**: Check config.json and network connectivity
- **Check**: Server startup logs for initialization errors

### "Empty response"
- **Cause**: Response processing issue
- **Fix**: Check response transformation logic
- **Location**: `src/tools/devices/list-get.ts`

## Getting Help

### Log Analysis
1. **Server logs**: Check for error patterns
2. **Network logs**: Check firewall/proxy issues  
3. **Restorepoint logs**: Check API access logs

### Validation Commands
```bash
# Config validation
npm run validate-config  # If available

# Build check
npm run build

# Test suite
npm test

# Direct API test
curl -k -H "Authorization: Custom $(jq -r '.restorepoint.token' config.json)" \
  "$(jq -r '.restorepoint.serverUrl' config.json)/api/v2/devices?limit=1"
```

### Support Information

**Before requesting support**:
1. Check this guide first
2. Gather relevant logs
3. Test direct API connectivity
4. Verify configuration

**Useful diagnostics to provide**:
- Server version: `node --version` and `npm --version`
- Configuration: `config.json` (with token redacted)
- Error logs: Last 20 lines from server logs
- Network test: Result of direct API call