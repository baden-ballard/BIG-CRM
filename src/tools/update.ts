import { supabase } from '../supabase/client.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function updateRecord(
  table: string,
  filter: Record<string, any>,
  data: Record<string, any>
): Promise<CallToolResult> {
  try {
    let query = supabase.from(table).update(data);

    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data: result, error } = await query.select().single();

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

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
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


