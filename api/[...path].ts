import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryTable } from '../src/tools/query.js';
import { insertRecord, insertMultipleRecords } from '../src/tools/insert.js';
import { updateRecord } from '../src/tools/update.js';
import { deleteRecord } from '../src/tools/delete.js';
import { listTables, getTableSchema } from '../src/tools/schema.js';
import { executeSQL } from '../src/tools/execute-sql.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.query.path as string[] | string;
  const route = Array.isArray(path) ? path.join('/') : path || '';

  try {
    // Health check
    if (req.method === 'GET' && route === 'health') {
      return res.json({ status: 'ok', service: 'supabase-mcp-server' });
    }

    // Query table
    if (req.method === 'POST' && route === 'api/query') {
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
      return res.json(data);
    }

    // Insert single record
    if (req.method === 'POST' && route === 'api/insert') {
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
      return res.status(201).json(responseData);
    }

    // Insert multiple records
    if (req.method === 'POST' && route === 'api/insert-multiple') {
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
      return res.status(201).json(responseData);
    }

    // Update record
    if (req.method === 'PUT' && route === 'api/update') {
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
      return res.json(responseData);
    }

    // Delete record
    if (req.method === 'DELETE' && route === 'api/delete') {
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
      return res.json(responseData);
    }

    // Get table schema
    if (req.method === 'GET' && route.startsWith('api/schema/')) {
      const table = route.split('api/schema/')[1];
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
      return res.json(responseData);
    }

    // List tables
    if (req.method === 'GET' && route === 'api/tables') {
      const result = await listTables();
      if (result.isError) {
        const content = result.content[0];
        const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
        return res.status(400).json(errorData);
      }
      const content = result.content[0];
      const responseData = content && 'text' in content ? JSON.parse(content.text) : [];
      return res.json(responseData);
    }

    // Execute SQL
    if (req.method === 'POST' && route === 'api/execute-sql') {
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
      return res.json(responseData);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

