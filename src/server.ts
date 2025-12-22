import express, { Request, Response } from 'express';
import { queryTable } from './tools/query.js';
import { insertRecord, insertMultipleRecords } from './tools/insert.js';
import { updateRecord } from './tools/update.js';
import { deleteRecord } from './tools/delete.js';
import { listTables, getTableSchema } from './tools/schema.js';
import { executeSQL } from './tools/execute-sql.js';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'supabase-mcp-server' });
});

// Query table endpoint
app.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { table, select, filter, limit } = req.body;
    
    if (!table) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    const result = await queryTable(table, select, filter, limit);
    
    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      return res.status(400).json(errorData);
    }

    const content = result.content[0];
    const data = content && 'text' in content ? JSON.parse(content.text) : [];
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Insert single record endpoint
app.post('/api/insert', async (req: Request, res: Response) => {
  try {
    const { table, data } = req.body;
    
    if (!table || !data) {
      return res.status(400).json({ error: 'Table name and data are required' });
    }

    const result = await insertRecord(table, data);
    
    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      return res.status(400).json(errorData);
    }

    const content = result.content[0];
    const responseData = content && 'text' in content ? JSON.parse(content.text) : [];
    res.status(201).json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Insert multiple records endpoint
app.post('/api/insert-multiple', async (req: Request, res: Response) => {
  try {
    const { table, data } = req.body;
    
    if (!table || !data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Table name and data array are required' });
    }

    const result = await insertMultipleRecords(table, data);
    
    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      return res.status(400).json(errorData);
    }

    const content = result.content[0];
    const responseData = content && 'text' in content ? JSON.parse(content.text) : [];
    res.status(201).json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update record endpoint
app.put('/api/update', async (req: Request, res: Response) => {
  try {
    const { table, filter, data } = req.body;
    
    if (!table || !filter || !data) {
      return res.status(400).json({ error: 'Table name, filter, and data are required' });
    }

    const result = await updateRecord(table, filter, data);
    
    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      return res.status(400).json(errorData);
    }

    const content = result.content[0];
    const responseData = content && 'text' in content ? JSON.parse(content.text) : [];
    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete record endpoint
app.delete('/api/delete', async (req: Request, res: Response) => {
  try {
    const { table, filter } = req.body;
    
    if (!table || !filter) {
      return res.status(400).json({ error: 'Table name and filter are required' });
    }

    const result = await deleteRecord(table, filter);
    
    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      return res.status(400).json(errorData);
    }

    const content = result.content[0];
    const responseData = content && 'text' in content ? JSON.parse(content.text) : [];
    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get table schema endpoint
app.get('/api/schema/:table', async (req: Request, res: Response) => {
  try {
    const { table } = req.params;
    
    if (!table) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    const result = await getTableSchema(table);
    
    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      return res.status(400).json(errorData);
    }

    const content = result.content[0];
    const responseData = content && 'text' in content ? JSON.parse(content.text) : [];
    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List tables endpoint
app.get('/api/tables', async (req: Request, res: Response) => {
  try {
    const result = await listTables();
    
    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      return res.status(400).json(errorData);
    }

    const content = result.content[0];
    const responseData = content && 'text' in content ? JSON.parse(content.text) : [];
    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute SQL endpoint
app.post('/api/execute-sql', async (req: Request, res: Response) => {
  try {
    const { sql } = req.body;
    
    if (!sql) {
      return res.status(400).json({ error: 'SQL statement is required' });
    }

    const result = await executeSQL(sql);
    
    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      return res.status(400).json(errorData);
    }

    const content = result.content[0];
    const responseData = content && 'text' in content ? JSON.parse(content.text) : [];
    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// MCP protocol endpoint (for MCP clients)
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const { method, params } = req.body;
    
    if (method === 'tools/list') {
      res.json({
        tools: [
          {
            name: 'query_table',
            description: 'Query records from a Supabase table',
          },
          {
            name: 'insert_record',
            description: 'Insert a single record into a Supabase table',
          },
          {
            name: 'insert_multiple_records',
            description: 'Insert multiple records into a Supabase table',
          },
          {
            name: 'update_record',
            description: 'Update records in a Supabase table',
          },
          {
            name: 'delete_record',
            description: 'Delete records from a Supabase table',
          },
          {
            name: 'get_table_schema',
            description: 'Get the schema of a table',
          },
          {
            name: 'list_tables',
            description: 'List available tables',
          },
          {
            name: 'execute_sql',
            description: 'Execute SQL statements (CREATE TABLE, ALTER TABLE, etc.)',
          },
        ],
      });
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      let result;
      switch (name) {
        case 'query_table':
          result = await queryTable(args.table, args.select, args.filter, args.limit);
          break;
        case 'insert_record':
          result = await insertRecord(args.table, args.data);
          break;
        case 'insert_multiple_records':
          result = await insertMultipleRecords(args.table, args.data);
          break;
        case 'update_record':
          result = await updateRecord(args.table, args.filter, args.data);
          break;
        case 'delete_record':
          result = await deleteRecord(args.table, args.filter);
          break;
        case 'get_table_schema':
          result = await getTableSchema(args.table);
          break;
        case 'list_tables':
          result = await listTables();
          break;
        case 'execute_sql':
          result = await executeSQL(args.sql);
          break;
        default:
          return res.status(400).json({ error: `Unknown tool: ${name}` });
      }
      
      if (result.isError) {
        const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
        return res.status(400).json({ error: errorData });
      }
      
      const content = result.content[0];
      const data = content && 'text' in content ? JSON.parse(content.text) : {};
      res.json({ content: [{ type: 'text', text: JSON.stringify(data) }] });
    } else {
      res.status(400).json({ error: `Unknown method: ${method}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Supabase MCP Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoints available at http://localhost:${PORT}/api/*`);
});

