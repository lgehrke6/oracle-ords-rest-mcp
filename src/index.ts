import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeTools, toolRegistry, toolInputSchema, ToolInput } from './tools/generated_tools.js';
import * as dotenv from 'dotenv';
import * as path from 'path'; 

// Adjusted path to .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });


// Create an MCP server
const server = new McpServer({
  name: "ords-bns",
  version: "1.0.0"
});

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

async function main() {

  // Pre-Check
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    console.error("Client ID or Client Secret not configured in .env file");
    process.exit(1);
  }
  console.log("Client ID and Client Secret are configured.");

  // Initialize dynamic tools
  await initializeTools();

  // Register tools from toolRegistry
  toolRegistry.forEach((toolDefinition, toolName) => {
    server.tool(
      toolName,
      toolDefinition.description,
      toolInputSchema.shape,
      async (input: ToolInput) => {
        try {
          const result = await toolDefinition.func(input);
          // Attempt to parse the body if it's JSON, otherwise return as text
          let parsedBody;
          try {
            parsedBody = JSON.parse(result.body);
          } catch (e) {
            parsedBody = result.body; // Keep as text if not JSON
          }
          return {
            content: [{ type: "text", text: JSON.stringify({ status_code: result.status_code, body: parsedBody }) }]
          };
        } catch (error: any) {
          console.error(`Error executing tool ${toolName}:`, error);
          return {
            content: [{ type: "text", text: JSON.stringify({ error: error.message || 'Unknown error' }) }],
            isError: true
          };
        }
      }
    );
  });

  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP Server connected and dynamic tools registered.");
}

main().catch(console.error);