#!/bin/bash

# REST MCP Proxy Tool Caller Script
# Usage: ./call_tool.sh <tool_name> [params...]

# Default configuration
DEFAULT_HOST="localhost:3000"
DEFAULT_API_KEY="CHANGE_ME"

# Check if required parameters are provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <tool_name> [params...]"
    echo ""
    echo "Examples:"
    echo "  $0 read_file file_id=my_file_123"
    echo "  $0 get_conversation conversation_id=6847468fb698f6eb29230a47"
    echo "  $0 execute_command param1=value1 param2=value2"
    echo ""
    echo "Environment variables:"
    echo "  MCP_HOST - Server host and port (default: $DEFAULT_HOST)"
    echo "  MCP_API_KEY - API key for authentication (default: $DEFAULT_API_KEY)"
    exit 1
fi

# Get tool name
TOOL_NAME="$1"
shift 1  # Remove first parameter, leaving any additional ones

# Configuration from environment or defaults
HOST="${MCP_HOST:-$DEFAULT_HOST}"
API_KEY="${MCP_API_KEY:-$DEFAULT_API_KEY}"

# Build URL
URL="http://${HOST}/tool?tool=${TOOL_NAME}"

# Add any parameters to URL
for param in "$@"; do
    if [[ "$param" == *"="* ]]; then
        URL="${URL}&${param}"
    else
        echo "Warning: Ignoring parameter '$param' (should be key=value format)"
    fi
done

# Make the API call using curl
echo "Calling tool: $TOOL_NAME with parameters: $*"
echo "URL: $URL"
echo "API Key: ${API_KEY:0:8}..." # Show only first 8 chars for security
echo ""

# Execute the curl command
curl -s \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  "$URL" | jq '.' 2>/dev/null || {
    # If jq is not available, just output raw response
    curl -s \
      -H "x-api-key: $API_KEY" \
      -H "Content-Type: application/json" \
      "$URL"
}

echo ""  # Add newline at end