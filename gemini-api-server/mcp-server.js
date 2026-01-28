#!/usr/bin/env node

/**
 * MCP Server for Gemini Phone Integration
 * 
 * Exposes tools to control the phone system via Gemini.
 * Transport: stdio (defaults for MCP)
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const { z } = require("zod");

// Define the server
const server = new Server(
    {
        name: "gemini-phone-mcp",
        version: "1.0.1",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Constants
const API_BASE_URL = process.env.GEMINI_API_URL || "http://localhost:3333";

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "make_outbound_call",
                description: "Initiate a physical phone call via PBX system (FreePBX/Asterisk). Use this to call real phone numbers or extensions.",
                inputSchema: zodToJSONSchema(
                    z.object({
                        to: z.string().describe("The phone number (E.164 format, e.g. +155512.5.37) or extension (e.g. 100) to call"),
                        message: z.string().describe("The first sentence the AI should say when the person answers"),
                        mode: z.enum(["conversation", "announce"]).default("conversation").describe("'conversation' for two-way AI chat, 'announce' for one-way message"),
                    })
                ),
            },
        ],
    };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "make_outbound_call") {
        try {
            const { to, message, mode } = args;

            // Validate inputs
            if (!to || !message) {
                throw new Error("Missing required arguments: to, message");
            }

            // Call the local API server which handles the PBX logic
            const response = await fetch(`${API_BASE_URL}/call`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to,
                    message,
                    mode: mode || "conversation"
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to initiate call: ${response.status} ${response.statusText} - ${errorText}`,
                        },
                    ],
                    isError: true,
                };
            }

            const data = await response.json();

            return {
                content: [
                    {
                        type: "text",
                        text: `Call initiated successfully. Call ID: ${data.callId}. The system is dialing ${to} now.`,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error executing tool: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    }

    throw new Error(`Unknown tool: ${name}`);
});

// Helper to convert Zod schema to JSON Schema for MCP
function zodToJSONSchema(zodObj) {
    // Simplified conversion for this specific use case
    // In a full implementation, use zod-to-json-schema package
    const shape = zodObj.shape;
    const properties = {};
    const required = [];

    for (const [key, schema] of Object.entries(shape)) {
        properties[key] = {
            type: "string", // defaulting to string for simplicity in this script
            description: schema.description,
        };

        // Manual adjustment for enum
        if (key === 'mode') {
            properties[key].enum = ["conversation", "announce"];
            properties[key].default = "conversation";
        }

        if (!schema.isOptional()) {
            required.push(key);
        }
    }

    return {
        type: "object",
        properties,
        required,
    };
}

/**
 * Start the server
 */
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Gemini Phone MCP Server running on stdio");
}

runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
