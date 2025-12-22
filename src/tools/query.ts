import { supabase } from '../supabase/client.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function queryTable(
  table: string,
  select?: string,
  filter?: Record<string, any>,
  limit?: number
): Promise<CallToolResult> {
  try {
    let query = supabase.from(table).select(select || '*');

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (typeof value === 'object' && value.operator) {
          switch (value.operator) {
            case 'eq':
              query = query.eq(key, value.value);
              break;
            case 'neq':
              query = query.neq(key, value.value);
              break;
            case 'gt':
              query = query.gt(key, value.value);
              break;
            case 'gte':
              query = query.gte(key, value.value);
              break;
            case 'lt':
              query = query.lt(key, value.value);
              break;
            case 'lte':
              query = query.lte(key, value.value);
              break;
            case 'like':
              query = query.like(key, value.value);
              break;
            case 'ilike':
              query = query.ilike(key, value.value);
              break;
            case 'in':
              query = query.in(key, value.value);
              break;
            case 'is':
              query = query.is(key, value.value);
              break;
          }
        } else {
          query = query.eq(key, value);
        }
      });
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

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
          text: JSON.stringify(data, null, 2),
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


