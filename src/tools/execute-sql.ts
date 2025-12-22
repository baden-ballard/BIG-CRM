import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import pkg from 'pg';
const { Client } = pkg;

export async function executeSQL(sql: string): Promise<CallToolResult> {
  // Try to use DATABASE_URL if available, otherwise provide helpful instructions
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    return await executeSQLWithConnection(sql);
  }

  // If no DATABASE_URL, provide instructions
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            error: 'DATABASE_URL not found in environment variables.',
            message: 'To enable SQL execution, add DATABASE_URL to your .env file.',
            instructions: [
              '1. Go to Supabase Dashboard > Settings > Database',
              '2. Find "Connection string" section',
              '3. Copy the URI connection string (starts with postgresql://)',
              '4. Add it to your .env file as: DATABASE_URL=postgresql://...',
              '5. Replace [YOUR-PASSWORD] with your actual database password',
            ],
            example: 'DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres',
            note: 'Alternatively, you can execute SQL directly in the Supabase Dashboard SQL Editor.',
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

// Function that executes SQL if DATABASE_URL is provided
export async function executeSQLWithConnection(sql: string): Promise<CallToolResult> {
  let client: pkg.Client | null = null;

  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'DATABASE_URL not found in environment variables.',
                message: 'Add DATABASE_URL to your .env file to enable SQL execution.',
                instructions: 'Get the connection string from Supabase Dashboard > Settings > Database > Connection string',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    // Create PostgreSQL client
    client = new Client({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false, // Supabase requires SSL
      },
    });

    await client.connect();

    // Execute SQL
    const result = await client.query(sql);

    await client.end();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              command: result.command,
              rowCount: result.rowCount,
              rows: result.rows,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    if (client) {
      try {
        await client.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error.message,
              code: (error as any).code,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
