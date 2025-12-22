import { supabase } from '../supabase/client.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function listTables(): Promise<CallToolResult> {
  try {
    // Note: Supabase doesn't have a direct API to list tables
    // This would typically require querying the information_schema
    // For now, we'll return a message indicating this limitation
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: 'To list tables, query the information_schema or use Supabase dashboard',
            note: 'You can query specific tables directly using the query_table tool',
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

export async function getTableSchema(table: string): Promise<CallToolResult> {
  try {
    // Query a single row to infer schema (or return empty if table is empty)
    const { data, error } = await supabase.from(table).select('*').limit(1);

    if (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2),
          },
        ],
        isError: true,
      };
    }

    const schema = data && data.length > 0 ? Object.keys(data[0]) : [];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              table,
              columns: schema,
              sample: data && data.length > 0 ? data[0] : null,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}


