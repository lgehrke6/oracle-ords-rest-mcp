# ORDS MCP
A project to query Oracle ORDS REST Services and make them available through the MCP Protocol.

## Pre-Word

This project was heavly inspired by thatjeffsmith and his blog post https://www.thatjeffsmith.com/archive/2025/05/build-an-mcp-to-connect-ai-to-oracle-database-w-openapi/
I highly suggest you checkout his version which is build with python, since Python is not up my forth i tried my luck with Typescript :)


## Prerequisites

- Nodejs
- Oracle Database instance accessible with ORDS (preferably version 22+)
- REST Modules to query
- OAuth2 Client that is allowed to query the REST modules if they are protected by a privilege

## Installation

1. **Clone the repository:**
    ```sh
    git clone https://github.com/lgehrke6/oracle-ords-rest-mcp.git
    cd oracle-ords-rest-mcp
    ```

2. **Configure environment variables:**
    - Copy `.env.example` to `.env` and update the values as needed.

3. **Build:**
    ```sh
    npm install
    npm run build
    ```

## Usage (stdio)

1. Open VS Code

2. Click on Tools -> Add more Tools -> Add MCP Server -> Command (stdio)

3. node <full_qualified_path>\\ords-mcp\\dist\\index.js

4. Open up your mcp.json (found in your .vscode folder of the ords-mcp repo)

5. Click Start above the mcp-server name

6. Ask Copilot a question about your Endpoints

7. Enjoy

## Future Improvements Planned

- [ ] Make a Docker image for the MCP Server
- [ ] Simplify the Setup & Starting
- [ ] Add OpenTelementry for Metrics
