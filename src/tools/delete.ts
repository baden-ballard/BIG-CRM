import { supabase } from '../supabase/client.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function deleteRecord(
  table: string,
  filter: Record<string, any>
): Promise<CallToolResult> {
  try {
    let query = supabase.from(table).delete();

    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data: result, error } = await query.select();

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
          text: JSON.stringify({ deleted: result, count: result?.length || 0 }, null, 2),
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



