const express = require('express');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.API_KEY || 'CHANGE_ME';

app.use(express.json());

// Store MCP clients
const mcpClients = new Map();
let availableTools = new Map();

// Load settings file (Claude desktop app format)
function loadSettings() {
  const settingsPath = path.join(__dirname, 'mcp_settings.json');
  
  if (!fs.existsSync(settingsPath)) {
    logWarning('Settings file not found', `Expected at: ${settingsPath}`);
    logInfo('💡 Copy mcp_settings.json.example to mcp_settings.json to configure MCP servers');
    return { mcpServers: {} };
  }
  
  try {
    logInfo('📄 Loading MCP settings', `From: ${settingsPath}`);
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsContent);
    logSuccess('Settings loaded successfully');
    return settings;
  } catch (error) {
    logError('Failed to load settings', error.message);
    logInfo('💡 Please check your mcp_settings.json file for syntax errors');
    return { mcpServers: {} };
  }
}

// Initialize MCP connections
async function initializeMCPServers() {
  const settings = loadSettings();
  
  if (!settings.mcpServers) {
    logWarning('No MCP servers configured in settings');
    return;
  }
  
  logInfo('🔗 Initializing MCP Server Connections...');
  
  const serverCount = Object.keys(settings.mcpServers).length;
  logInfo(`📋 Found ${serverCount} MCP server(s) in configuration`);
  
  for (const [serverName, serverConfig] of Object.entries(settings.mcpServers)) {
    try {
      logInfo(`⏳ Connecting to MCP server: ${serverName}`);
      logInfo(`   Command: ${serverConfig.command} ${(serverConfig.args || []).join(' ')}`);
      
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args || []
      });
      
      const client = new Client({
        name: 'rest-mcp-proxy',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {}
        }
      });
      
      await client.connect(transport);
      mcpClients.set(serverName, client);
      
      // Get available tools from this server
      const toolsResponse = await client.listTools();
      if (toolsResponse.tools) {
        toolsResponse.tools.forEach(tool => {
          availableTools.set(tool.name, { serverName, tool });
        });
      }
      
      logSuccess(`Connected to ${serverName}`, `${toolsResponse.tools?.length || 0} tools discovered`);
    } catch (error) {
      logError(`Failed to connect to MCP server ${serverName}`, error.message);
    }
  }
  
  // Pretty print all available tools
  printAvailableTools();
}

// Pretty print available tools and server information
function printAvailableTools() {
  logInfo('📋 Generating tools summary...');
  
  if (availableTools.size === 0) {
    logWarning('No tools available from connected MCP servers');
    return;
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('                          📋 AVAILABLE TOOLS SUMMARY');
  console.log('═'.repeat(80));
  
  // Group tools by server
  const toolsByServer = new Map();
  for (const [toolName, toolInfo] of availableTools) {
    if (!toolsByServer.has(toolInfo.serverName)) {
      toolsByServer.set(toolInfo.serverName, []);
    }
    toolsByServer.get(toolInfo.serverName).push({ name: toolName, tool: toolInfo.tool });
  }
  
  // Print tools grouped by server
  const serverEntries = Array.from(toolsByServer.entries());
  
  serverEntries.forEach(([serverName, tools], serverIndex) => {
    const isLastServer = serverIndex === serverEntries.length - 1;
    
    console.log(`\n🏢 Server: ${serverName} (${tools.length} tools)`);
    console.log('─'.repeat(60));
    
    tools.forEach((toolInfo, toolIndex) => {
      const { name, tool } = toolInfo;
      const isLastTool = toolIndex === tools.length - 1;
      const toolPrefix = isLastTool ? '└──' : '├──';
      
      console.log(`${toolPrefix} 🔧 ${name}`);
      
      if (tool.description) {
        const descPrefix = isLastTool ? '    ' : '│   ';
        console.log(`${descPrefix}📝 ${tool.description}`);
      }
      
      if (tool.inputSchema && tool.inputSchema.properties) {
        const paramPrefix = isLastTool ? '    ' : '│   ';
        const paramCount = Object.keys(tool.inputSchema.properties).length;
        console.log(`${paramPrefix}⚙️  Parameters: ${paramCount}`);
        
        // Show parameter details
        const requiredParams = tool.inputSchema.required || [];
        const paramEntries = Object.entries(tool.inputSchema.properties);
        
        paramEntries.forEach(([paramName, paramSchema], paramIndex) => {
          const isLastParam = paramIndex === paramEntries.length - 1;
          const isRequired = requiredParams.includes(paramName);
          const paramLastPrefix = isLastTool ? '    ' : '│   ';
          const paramDetailPrefix = isLastParam ? '└─' : '├─';
          
          console.log(`${paramLastPrefix}  ${paramDetailPrefix} ${paramName} (${paramSchema.type || 'any'})${isRequired ? ' *required' : ''}`);
          
          if (paramSchema.description) {
            const descDetailPrefix = isLastParam ? '  ' : '│ ';
            console.log(`${paramLastPrefix}  ${descDetailPrefix}   ${paramSchema.description}`);
          }
        });
      }
      
      // Only add separator if not last tool
      if (!isLastTool) {
        console.log('│');
      }
    });
    
    // Only add server separator if not last server
    if (!isLastServer) {
      console.log('');
    }
  });
  
  console.log('\n' + '═'.repeat(80));
  console.log(`📊 SUMMARY: ${availableTools.size} tools across ${mcpClients.size} connected servers`);
  console.log('═'.repeat(80));
}

// Middleware to check API key
function authenticateApiKey(req, res, next) {
  const providedKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!providedKey || providedKey !== apiKey) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  
  next();
}

// Parse tool name and parameters from query string
function parseToolAndParams(toolQuery) {
  if (!toolQuery) {
    return { toolName: null, params: {} };
  }
  
  const parts = toolQuery.split(' ');
  const toolName = parts[0];
  const params = {};
  
  // Parse param=value pairs from remaining parts
  for (let i = 1; i < parts.length; i++) {
    const paramPart = parts[i];
    const equalIndex = paramPart.indexOf('=');
    
    if (equalIndex > 0) {
      const paramName = paramPart.substring(0, equalIndex);
      const paramValue = paramPart.substring(equalIndex + 1);
      params[paramName] = paramValue;
    }
  }
  
  return { toolName, params };
}

// Tool endpoint
app.get('/tool', authenticateApiKey, async (req, res) => {
  const { tool: toolQuery, ...additionalArgs } = req.query;
  const { toolName, params } = parseToolAndParams(toolQuery);
  
  if (!toolName) {
    return res.status(400).json({ error: 'Tool name is required as query parameter' });
  }
  
  // Merge parsed parameters with any additional query parameters
  const args = { ...params, ...additionalArgs };
  
  try {
    const result = await invokeTool(toolName, args);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/tool', authenticateApiKey, async (req, res) => {
  const { tool: toolQuery } = req.query;
  const { toolName, params } = parseToolAndParams(toolQuery);
  
  if (!toolName) {
    return res.status(400).json({ error: 'Tool name is required as query parameter' });
  }
  
  // Use parsed parameters as the request body (params take precedence over req.body)
  const args = { ...req.body, ...params };
  
  try {
    const result = await invokeTool(toolName, args);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tool invocation logic
async function invokeTool(toolName, args) {
  const startTime = Date.now();
  
  const toolInfo = availableTools.get(toolName);
  
  if (!toolInfo) {
    logError(`Tool not found: ${toolName}`);
    throw new Error(`Tool '${toolName}' not found`);
  }
  
  const client = mcpClients.get(toolInfo.serverName);
  if (!client) {
    logError(`MCP server not connected: ${toolInfo.serverName}`);
    throw new Error(`MCP server '${toolInfo.serverName}' not connected`);
  }
  
  try {
    logInfo(`🔧 Executing tool: ${toolName}`, `Server: ${toolInfo.serverName}, Args: ${Object.keys(args).length} parameters`);
    
    const result = await client.callTool({
      name: toolName,
      arguments: args
    });
    
    const executionTime = Date.now() - startTime;
    logSuccess(`Tool executed successfully: ${toolName}`, `Completed in ${executionTime}ms`);
    
    return {
      success: true,
      result: result.content,
      tool: toolName,
      server: toolInfo.serverName,
      executionTime: executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logError(`Tool execution failed: ${toolName}`, `Error after ${executionTime}ms: ${error.message}`);
    throw new Error(`Tool execution failed: ${error.message}`);
  }
}

// List available tools endpoint
app.get('/tools', authenticateApiKey, (req, res) => {
  const tools = Array.from(availableTools.entries()).map(([name, info]) => ({
    name,
    server: info.serverName,
    description: info.tool.description,
    inputSchema: info.tool.inputSchema
  }));
  
  res.json({ tools });
});

// Serialize tools endpoint - returns tools in the specified JSON format
app.get('/serialize-tools', authenticateApiKey, (req, res) => {
  const serializedTools = {};
  
  for (const [toolName, toolInfo] of availableTools) {
    const tool = toolInfo.tool;
    const serverName = toolInfo.serverName;
    
    // Extract inputs from the tool's input schema
    const inputs = [];
    if (tool.inputSchema && tool.inputSchema.properties) {
      const requiredParams = tool.inputSchema.required || [];
      
      Object.entries(tool.inputSchema.properties).forEach(([paramName, paramSchema]) => {
        inputs.push({
          name: paramName,
          type: paramSchema.type || 'string'
        });
      });
    }
    
    // Generate a unique ID for outputs (using tool name hash for consistency)
    function generateId(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16).padStart(12, '0');
    }
    
    // For now, we'll create generic outputs since MCP tools don't specify return schema
    const outputs = [
      {
        name: "Result",
        key: "result",
        id: generateId(toolName + "_result")
      }
    ];
    
    serializedTools[toolName] = {
      name: tool.description || toolName,
      description: tool.description || `Execute ${toolName} tool from ${serverName} MCP server`,
      url: `${req.protocol}://${req.get('host')}/tool?tool=${encodeURIComponent(toolName)}`,
      headers: [
        {
          name: "x-api-key",
          value: "{{API_KEY}}"
        }
      ],
      inputs: inputs,
      outputs: outputs,
      request_body: inputs.length > 0 ? JSON.stringify(Object.fromEntries(inputs.map(input => [input.name, `{{${input.name}}}`]))) : "",
      content_type: "json",
      method: inputs.length > 0 ? "POST" : "GET"
    };
  }
  
  res.json(serializedTools);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connectedServers: Array.from(mcpClients.keys()),
    availableTools: Array.from(availableTools.keys())
  });
});

// ASCII Art Banner
function printBanner() {
  const banner = `
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║    ██████╗ ███████╗███████╗████████╗    ███╗   ███╗ ██████╗██████╗    ║
║    ██╔══██╗██╔════╝██╔════╝╚══██╔══╝    ████╗ ████║██╔════╝██╔══██╗   ║
║    ██████╔╝█████╗  ███████╗   ██║       ██╔████╔██║██║     ██████╔╝   ║
║    ██╔══██╗██╔══╝  ╚════██║   ██║       ██║╚██╔╝██║██║     ██╔═══╝    ║
║    ██║  ██║███████╗███████║   ██║       ██║ ╚═╝ ██║╚██████╗██║        ║
║    ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝       ╚═╝     ╚═╝ ╚═════╝╚═╝        ║
║                                                                       ║
║                        ██████╗ ██████╗  ██████╗ ██╗  ██╗██╗   ██╗     ║
║                        ██╔══██╗██╔══██╗██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝     ║
║                        ██████╔╝██████╔╝██║   ██║ ╚███╔╝  ╚████╔╝      ║
║                        ██╔═══╝ ██╔══██╗██║   ██║ ██╔██╗   ╚██╔╝       ║
║                        ██║     ██║  ██║╚██████╔╝██╔╝ ██╗   ██║        ║
║                        ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝        ║
║                                                                       ║
║                    🌉 Bridge MCP Servers to REST APIs 🌉              ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
`;
  console.log(banner);
}

// Enhanced logging utility
function logInfo(message, details = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ℹ️  ${message}`);
  if (details) {
    console.log(`[${timestamp}]    ${details}`);
  }
}

function logSuccess(message, details = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ✅ ${message}`);
  if (details) {
    console.log(`[${timestamp}]    ${details}`);
  }
}

function logWarning(message, details = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ⚠️  ${message}`);
  if (details) {
    console.log(`[${timestamp}]    ${details}`);
  }
}

function logError(message, details = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ❌ ${message}`);
  if (details) {
    console.log(`[${timestamp}]    ${details}`);
  }
}

// Start server
async function startServer() {
  try {
    printBanner();
    
    logInfo('🚀 Starting REST MCP Proxy Server...');
    logInfo(`📊 Node.js version: ${process.version}`);
    logInfo(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    await initializeMCPServers();
    
    app.listen(port, () => {
      console.log('\n' + '═'.repeat(80));
      logSuccess('🚀 REST MCP Proxy Server Started Successfully!');
      console.log('═'.repeat(80));
      
      logInfo(`🌐 Server URL: http://localhost:${port}`);
      logInfo(`🔗 Connected MCP Servers: ${mcpClients.size}`);
      logInfo(`🔧 Available Tools: ${availableTools.size}`);
      
      if (apiKey === 'CHANGE_ME') {
        logWarning('🔑 Using default API key - Please change this in production!');
      } else {
        logSuccess('🔑 Custom API key configured');
      }
      
      console.log('\n📡 Available API Endpoints:');
      console.log('  ├─ GET  /health           → Server status and health check');
      console.log('  ├─ GET  /tools            → List all available MCP tools');
      console.log('  ├─ GET  /serialize-tools  → Export tools in JSON format');
      console.log('  ├─ GET  /tool?tool=<name> → Execute MCP tool via GET');
      console.log('  └─ POST /tool?tool=<name> → Execute MCP tool via POST');
      
      console.log('\n🔐 Authentication:');
      console.log('  • Header: x-api-key: your-key');
      console.log('  • Query:  ?api_key=your-key');
      
      console.log('\n' + '═'.repeat(80));
      logSuccess('💡 Ready to proxy MCP tools over REST API!');
      console.log('═'.repeat(80) + '\n');
    });
  } catch (error) {
    logError('Failed to start server', error.message);
    console.error(error);
    process.exit(1);
  }
}

startServer();