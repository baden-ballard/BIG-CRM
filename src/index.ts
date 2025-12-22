#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { queryTable } from './tools/query.js';
import { insertRecord, insertMultipleRecords } from './tools/insert.js';
import { updateRecord } from './tools/update.js';
import { deleteRecord } from './tools/delete.js';
import { listTables, getTableSchema } from './tools/schema.js';
import { executeSQL } from './tools/execute-sql.js';

const PORT = process.env.PORT || 3003;

class SupabaseMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'supabase-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'query_table',
          description:
            'Query records from a Supabase table. Supports filtering, selecting specific columns, and limiting results.',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'The name of the table to query',
              },
              select: {
                type: 'string',
                description:
                  'Comma-separated list of columns to select (default: "*" for all columns)',
              },
              filter: {
                type: 'object',
                description:
                  'Filter conditions. Use simple key-value pairs for equality, or objects with operator/value for advanced filters (eq, neq, gt, gte, lt, lte, like, ilike, in, is)',
                additionalProperties: true,
              },
              limit: {
                type: 'number',
                description: 'Maximum number of records to return',
              },
            },
            required: ['table'],
          },
        },
        {
          name: 'insert_record',
          description: 'Insert a single record into a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'The name of the table to insert into',
              },
              data: {
                type: 'object',
                description: 'The record data to insert',
                additionalProperties: true,
              },
            },
            required: ['table', 'data'],
          },
        },
        {
          name: 'insert_multiple_records',
          description: 'Insert multiple records into a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'The name of the table to insert into',
              },
              data: {
                type: 'array',
                description: 'Array of record data to insert',
                items: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
            required: ['table', 'data'],
          },
        },
        {
          name: 'update_record',
          description:
            'Update records in a Supabase table matching the filter criteria',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'The name of the table to update',
              },
              filter: {
                type: 'object',
                description:
                  'Filter conditions to identify which records to update (key-value pairs for equality matching)',
                additionalProperties: true,
              },
              data: {
                type: 'object',
                description: 'The data to update',
                additionalProperties: true,
              },
            },
            required: ['table', 'filter', 'data'],
          },
        },
        {
          name: 'delete_record',
          description:
            'Delete records from a Supabase table matching the filter criteria',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'The name of the table to delete from',
              },
              filter: {
                type: 'object',
                description:
                  'Filter conditions to identify which records to delete (key-value pairs for equality matching)',
                additionalProperties: true,
              },
            },
            required: ['table', 'filter'],
          },
        },
        {
          name: 'get_table_schema',
          description:
            'Get the schema (column names) of a table by querying a sample row',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'The name of the table',
              },
            },
            required: ['table'],
          },
        },
        {
          name: 'list_tables',
          description: 'Get information about listing tables (note: requires direct database access)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'execute_sql',
          description:
            'Execute SQL statements (CREATE TABLE, ALTER TABLE, etc.). Requires DATABASE_URL in .env file. Get it from Supabase Dashboard > Settings > Database > Connection string.',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'The SQL statement to execute (e.g., CREATE TABLE, ALTER TABLE, INSERT, etc.)',
              },
            },
            required: ['sql'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!args) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'No arguments provided' }, null, 2),
            },
          ],
          isError: true,
        };
      }

      try {
        switch (name) {
          case 'query_table':
            return await queryTable(
              args.table as string,
              args.select as string | undefined,
              args.filter as Record<string, any> | undefined,
              args.limit as number | undefined
            );

          case 'insert_record':
            return await insertRecord(
              args.table as string,
              args.data as Record<string, any>
            );

          case 'insert_multiple_records':
            return await insertMultipleRecords(
              args.table as string,
              args.data as Record<string, any>[]
            );

          case 'update_record':
            return await updateRecord(
              args.table as string,
              args.filter as Record<string, any>,
              args.data as Record<string, any>
            );

          case 'delete_record':
            return await deleteRecord(
              args.table as string,
              args.filter as Record<string, any>
            );

          case 'get_table_schema':
            return await getTableSchema(args.table as string);

          case 'list_tables':
            return await listTables();

          case 'execute_sql':
            return await executeSQL(args.sql as string);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { error: error.message, stack: error.stack },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Supabase MCP server running on stdio');
  }
}

// Run the MCP server (stdio mode)
// This can be used by MCP clients via stdio
if (process.env.MCP_MODE === 'stdio') {
  const server = new SupabaseMCPServer();
  server.run().catch(console.error);
} else {
  // Import and run HTTP server by default
  import('./server.js').catch(console.error);
}

