#!/bin/bash

# MCP Proxy Client Script
# Provides easy access to the rest-mcp-proxy API endpoints

# Default configuration
DEFAULT_HOST="localhost"
DEFAULT_PORT="3000"
DEFAULT_API_KEY="CHANGE_ME"

# Parse command line arguments
HOST=${MCP_HOST:-$DEFAULT_HOST}
PORT=${MCP_PORT:-$DEFAULT_PORT}
API_KEY=${MCP_API_KEY:-$DEFAULT_API_KEY}
BASE_URL="http://$HOST:$PORT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print usage
usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  health              Check server health and status"
    echo "  tools               List all available tools"
    echo "  serialize-tools     Get tools in serialized JSON format"
    echo ""
    echo "Environment Variables:"
    echo "  MCP_HOST           Server host (default: $DEFAULT_HOST)"
    echo "  MCP_PORT           Server port (default: $DEFAULT_PORT)"
    echo "  MCP_API_KEY        API key for authentication (default: $DEFAULT_API_KEY)"
    echo ""
    echo "Examples:"
    echo "  $0 health"
    echo "  MCP_HOST=192.168.1.100 $0 tools"
    echo "  MCP_API_KEY=mykey123 $0 serialize-tools"
}

# Function to make HTTP request with error handling
make_request() {
    local endpoint="$1"
    local url="$BASE_URL$endpoint"
    
    echo -e "${BLUE}Making request to: $url${NC}"
    
    response=$(curl -s -w "%{http_code}" \
        -H "x-api-key: $API_KEY" \
        -H "Accept: application/json" \
        "$url")
    
    http_code="${response: -3}"
    body="${response%???}"
    
    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        echo -e "${GREEN}✓ Success (HTTP $http_code)${NC}"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Error (HTTP $http_code)${NC}"
        echo "$body"
        return 1
    fi
}

# Function to check if required tools are available
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}Error: curl is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}Warning: jq not found - JSON output will not be formatted${NC}"
    fi
}

# Main script logic
main() {
    check_dependencies
    
    if [[ $# -eq 0 ]]; then
        usage
        exit 1
    fi
    
    case "$1" in
        "health")
            echo -e "${BLUE}Checking server health...${NC}"
            make_request "/health"
            ;;
        "tools")
            echo -e "${BLUE}Fetching available tools...${NC}"
            make_request "/tools"
            ;;
        "serialize-tools")
            echo -e "${BLUE}Fetching serialized tools...${NC}"
            make_request "/serialize-tools"
            ;;
        "-h"|"--help"|"help")
            usage
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo ""
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"