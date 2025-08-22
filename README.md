# 🌉 REST MCP Proxy

**Transform any MCP server into a REST API in seconds**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016-brightgreen)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=flat&logo=express&logoColor=%2361DAFB)](https://expressjs.com/)

> Bridge the gap between powerful MCP (Model Context Protocol) servers and REST-loving applications. No more complex protocol implementations – just simple HTTP calls.

## ✨ What Makes This Special?

🚀 **Zero Configuration Complexity** - Works with your existing MCP server configurations  
🔌 **Universal Compatibility** - Any MCP server becomes a REST endpoint instantly  
🛡️ **Enterprise Ready** - Built-in authentication, error handling, and logging  
📊 **Tool Discovery** - Automatic API documentation generation from MCP schemas  
⚡ **High Performance** - Persistent connections with connection pooling  
🎯 **Developer Friendly** - Intuitive REST endpoints with flexible parameter passing  

## 🎯 Perfect For

- **Integration Teams** building REST-based workflows
- **DevOps Engineers** connecting MCP tools to existing infrastructure  
- **API Developers** who need MCP functionality without protocol complexity
- **Automation Scripts** that work better with HTTP than stdio protocols
- **Legacy Systems** that can't implement MCP directly

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/rest-mcp-proxy.git
cd rest-mcp-proxy
npm install
```

### 2. Configure Your MCP Servers
```bash
cp mcp_settings.json.example mcp_settings.json
cp env.example .env
```

Edit `mcp_settings.json` with your MCP server configurations:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 3. Set Your API Key
```bash
echo "API_KEY=your-secure-api-key-here" > .env
```

### 4. Launch
```bash
npm start
```

That's it! Your MCP servers are now accessible via REST API at `http://localhost:3000` 🎉

## 📡 API Usage

### List Available Tools
```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/tools
```

### Execute a Tool (GET)
```bash
# Simple tool call
curl -H "x-api-key: your-api-key" \
  "http://localhost:3000/tool?tool=read_file&path=/etc/hosts"

# Multiple parameters in tool query
curl -H "x-api-key: your-api-key" \
  "http://localhost:3000/tool?tool=search query=nodejs limit=10"
```

### Execute a Tool (POST)
```bash
curl -X POST \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"path": "/etc/hosts", "encoding": "utf8"}' \
  "http://localhost:3000/tool?tool=read_file"
```

### Export Tools for External Systems
Get all tools in a standardized format for integration:
```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/serialize-tools
```

## 🔧 Advanced Features

### Flexible Parameter Passing
Choose the method that fits your workflow:

1. **URL Parameters** (great for simple calls)
   ```
   /tool?tool=search&query=nodejs&limit=10
   ```

2. **Tool Query Syntax** (clean and readable)
   ```
   /tool?tool=search query=nodejs limit=10
   ```

3. **JSON Body** (perfect for complex data)
   ```json
   POST /tool?tool=create_file
   {
     "path": "/tmp/example.txt",
     "content": "Hello World!",
     "permissions": 644
   }
   ```

### Multiple Authentication Methods
- **Header-based**: `x-api-key: your-key`
- **Query parameter**: `?api_key=your-key`

### Health Monitoring
```bash
curl http://localhost:3000/health
```
Returns server status, connected MCP servers, and available tools count.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   REST Client   │    │  MCP Proxy      │    │   MCP Server    │
│                 │───▶│                 │───▶│                 │
│ (Your App)      │    │ (This Project)  │    │ (File System)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   MCP Server    │
                       │                 │
                       │ (Web Search)    │
                       └─────────────────┘
```

The proxy maintains persistent connections to all configured MCP servers, aggregating their tools into a unified REST API surface.

## 🔒 Security Features

- **API Key Authentication** - Protect your endpoints
- **Request Validation** - Automatic parameter validation using MCP schemas  
- **Error Sanitization** - Safe error messages without internal details
- **Connection Security** - Secure MCP server communication

## 🌟 Use Cases

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Read deployment config
  run: |
    curl -H "x-api-key: ${{ secrets.MCP_API_KEY }}" \
      "$MCP_PROXY_URL/tool?tool=read_file path=config/production.yml"
```

### Webhook Automation
```javascript
// Process webhook with MCP tool
app.post('/webhook', async (req, res) => {
  const result = await fetch(`${MCP_PROXY_URL}/tool?tool=process_webhook`, {
    method: 'POST',
    headers: { 'x-api-key': process.env.MCP_API_KEY },
    body: JSON.stringify(req.body)
  });
  res.json(await result.json());
});
```

### External Tool Integration
Export your MCP tools to workflow automation platforms:
```bash
# Generate tool definitions for Zapier, Make.com, etc.
curl -H "x-api-key: your-key" \
  http://localhost:3000/serialize-tools > mcp-tools.json
```

## 🛠️ Configuration Reference

### Environment Variables
```bash
PORT=3000                    # Server port (default: 3000)
API_KEY=your-secure-key      # API authentication key
```

### MCP Settings Format
Uses the same format as Claude Desktop app for maximum compatibility:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "executable",
      "args": ["arg1", "arg2"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

## 📈 Monitoring & Observability

The proxy provides detailed logging and status information:

- **Startup Logs** - Connection status for each MCP server
- **Tool Discovery** - Automatic cataloging of available tools
- **Request Logging** - Track API usage and performance
- **Health Endpoints** - Monitor system status programmatically

## 🤝 Contributing

We love contributions! Whether it's:

- 🐛 Bug reports and fixes
- ✨ New features and enhancements  
- 📚 Documentation improvements
- 🧪 Tests and quality improvements

See our [Contributing Guide](CONTRIBUTING.md) to get started.

## 📜 License

ISC License - see [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [Model Context Protocol](https://github.com/modelcontextprotocol) - The official MCP specification
- [MCP Servers](https://github.com/modelcontextprotocol/servers) - Collection of official MCP servers
- [Claude Desktop](https://claude.ai/download) - Native MCP client by Anthropic

---

<div align="center">

**Made with ❤️ for the MCP community**

[⭐ Star this repo](https://github.com/yourusername/rest-mcp-proxy) if it helps you build amazing integrations!

</div>