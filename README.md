# 🚀 RP_SL1_MCP - Restorepoint MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Professional MCP (Model Context Protocol) server for Restorepoint API integration with native Node.js deployment.**

---

## 🎯 **Overview**

This project provides a world-class MCP server that enables natural language interaction with Restorepoint network management functionality. It serves as the foundation for custom chat interfaces and AI-powered network automation.

### **Key Features**
- 🔧 **11+ Restorepoint Management Tools**: Device management, backup operations, command execution
- 🌐 **HTTP REST API**: Full web-compatible endpoints (`/tools/execute`, `/health`, `/info`)
- ⚡ **Native Node.js Deployment**: Runs directly on OS for optimal performance
- ☁️ **AWS EC2 Ready**: Simple deployment to EC2 (~$12-15/month)
- 🧪 **Comprehensive Testing**: 41 passing tests with Jest framework
- 📚 **Enterprise-Grade Architecture**: Professional standards, logging, error handling
- 🤖 **Web Integration Ready**: Perfect for chat interfaces and web applications

---

## 🚀 **Quick Start**

### **Local Development**
```bash
# Clone and setup
git clone https://github.com/rudipoppes/RP_SL1_MCP.git
cd RP_SL1_MCP
./deployment/scripts/setup-local.sh

# Start HTTP server (REQUIRED for web integration)
./start-mcp-server.sh
```

**HTTP Mode is PRIMARY** - Required for:
- Web applications and chat interfaces  
- REST API integration
- Standard deployment patterns

### **Production Deployment**
```bash
# Deploy to AWS EC2
./deployment/scripts/deploy-to-aws.sh --ip YOUR_EC2_IP --key YOUR_KEY.pem --repo https://github.com/youruser/RP_SL1_MCP.git
```

### **Test**
```bash
curl http://localhost:3000/health
curl -X POST "http://localhost:3000/tools/execute" \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_devices", "arguments": {"limit": 10}}'
npm test
```

### **Configuration**
Edit `config.json` to configure your Restorepoint server:
```json
{
  "restorepoint": {
    "serverUrl": "https://your-restorepoint-server.com",
    "token": "your-access-token",
    "apiVersion": "v2"
  }
}
```

**Authentication Note**: The Restorepoint API uses `Authorization: Custom <token>` format (not Bearer).

---

## 📚 **Complete Documentation**

- 📖 **[Architecture Plan](./RESTOREPOINT_CHAT_ARCHITECTURE.md)** - Complete chat interface design
- 📖 **[Next Steps](./NEXT_STEPS.md)** - Decision points and roadmap
- 📖 **[Setup Guide](./docs/SETUP.md)** - Local development setup

---

## 🛠️ **Technologies**

- **Node.js 22+** with TypeScript
- **Native OS deployment** (no container overhead)
- **AWS EC2** deployment ready
- **@modelcontextprotocol/sdk** for MCP
- **41 passing tests** with Jest

---

## 💰 **Cost**

**AWS Operational**: ~$12-15/month  
**Development**: $0 (local)

---

## 🎯 **Ready for Production**

This MCP server is production-ready with:
- ✅ Native Node.js deployment (no Docker)
- ✅ AWS deployment automation with systemd service
- ✅ Logger initialization fixes
- ✅ Health check endpoints
- ✅ Comprehensive testing (41 passing tests)
- ✅ Professional documentation

**Deploy to AWS in minutes! 🚀**
