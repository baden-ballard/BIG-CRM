# BIG CRM - Supabase MCP Server

A Model Context Protocol (MCP) server for managing Supabase database operations in your CRM system.

## Features

- **Query Tables**: Query records with filtering, column selection, and pagination
- **Insert Records**: Insert single or multiple records
- **Update Records**: Update records based on filter criteria
- **Delete Records**: Delete records based on filter criteria
- **Schema Inspection**: Get table schemas and column information
- **SQL Execution**: Execute SQL statements (CREATE TABLE, ALTER TABLE, etc.) - requires DATABASE_URL

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service_role key (for admin operations)
   - `DATABASE_URL`: (Optional) Database connection string for SQL execution. Get it from Supabase Dashboard > Settings > Database > Connection string

3. **Build the Project**
   ```bash
   npm run build
   ```

4. **Run in Development**
   ```bash
   npm run dev
   ```
   
   The server will run on `localhost:3003` (or the port specified in your `.env` file).

## MCP Tools

### `query_table`
Query records from a Supabase table.

**Parameters:**
- `table` (required): Table name
- `select` (optional): Comma-separated columns to select
- `filter` (optional): Filter conditions
- `limit` (optional): Maximum number of records

**Example:**
```json
{
  "table": "customers",
  "select": "id,name,email",
  "filter": {
    "status": "active",
    "created_at": {
      "operator": "gte",
      "value": "2024-01-01"
    }
  },
  "limit": 10
}
```

### `insert_record`
Insert a single record.

**Parameters:**
- `table` (required): Table name
- `data` (required): Record data object

### `insert_multiple_records`
Insert multiple records at once.

**Parameters:**
- `table` (required): Table name
- `data` (required): Array of record data objects

### `update_record`
Update records matching filter criteria.

**Parameters:**
- `table` (required): Table name
- `filter` (required): Filter conditions
- `data` (required): Data to update

### `delete_record`
Delete records matching filter criteria.

**Parameters:**
- `table` (required): Table name
- `filter` (required): Filter conditions

### `get_table_schema`
Get table schema information.

**Parameters:**
- `table` (required): Table name

### `execute_sql`
Execute SQL statements (CREATE TABLE, ALTER TABLE, etc.). Requires `DATABASE_URL` in `.env` file.

**Parameters:**
- `sql` (required): The SQL statement to execute

**Note:** To use this tool, you need to add `DATABASE_URL` to your `.env` file:
1. Go to Supabase Dashboard > Settings > Database
2. Find "Connection string" section
3. Copy the URI connection string (starts with `postgresql://`)
4. Add it to your `.env` file as: `DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
5. Replace `[YOUR-PASSWORD]` with your actual database password

## Deployment to Vercel

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**
   ```bash
   vercel
   ```

3. **Set Environment Variables in Vercel**
   - Go to your Vercel project settings
   - Add `SUPABASE_URL` and `SUPABASE_KEY` environment variables

## Development

- `npm run dev`: Run in development mode with hot reload
- `npm run build`: Build TypeScript to JavaScript
- `npm start`: Run the built server
- `npm run type-check`: Type check without building

## HTTP API Endpoints

The server also exposes REST API endpoints for direct HTTP access:

### Health Check
```
GET /health
```

### Query Table
```
POST /api/query
Body: { "table": "customers", "select": "id,name", "filter": {...}, "limit": 10 }
```

### Insert Record
```
POST /api/insert
Body: { "table": "customers", "data": { "name": "John", "email": "john@example.com" } }
```

### Insert Multiple Records
```
POST /api/insert-multiple
Body: { "table": "customers", "data": [{ "name": "John" }, { "name": "Jane" }] }
```

### Update Record
```
PUT /api/update
Body: { "table": "customers", "filter": { "id": 1 }, "data": { "name": "John Updated" } }
```

### Delete Record
```
DELETE /api/delete
Body: { "table": "customers", "filter": { "id": 1 } }
```

### Get Table Schema
```
GET /api/schema/:table
```

### List Tables
```
GET /api/tables
```

### Execute SQL
```
POST /api/execute-sql
Body: { "sql": "CREATE TABLE customers (id SERIAL PRIMARY KEY, name VARCHAR(255))" }
```

**Note:** Requires `DATABASE_URL` in `.env` file. Get it from Supabase Dashboard > Settings > Database > Connection string.

## Notes

- The MCP server can communicate via stdio (set `MCP_MODE=stdio` environment variable) or HTTP
- For local development, the HTTP server runs on `localhost:3003` by default
- Make sure your Supabase project has Row Level Security (RLS) configured appropriately
- Use the Supabase dashboard to manage your database schema
- All API endpoints support CORS for cross-origin requests

