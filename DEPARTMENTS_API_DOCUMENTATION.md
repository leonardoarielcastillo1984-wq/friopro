# Departments API Documentation

## Overview

The Departments API provides a complete system for managing organizational departments within SGI 360. This API enables creation, modification, and deletion of departments, as well as management of department members with role-based access control.

## Base URL

```
http://localhost:3001/departments
```

## Authentication

All endpoints require an authenticated session cookie or JWT token. Endpoints that modify data (POST, PUT, DELETE) require tenant admin privileges.

## Data Models

### Department

```typescript
{
  id: string;                    // UUID
  tenantId: string;              // UUID
  name: string;                  // Department name (unique per tenant)
  description: string | null;    // Department description
  color: string;                 // Hex color code (e.g., #3B82F6)
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  createdById: string | null;    // UUID of creator
  updatedById: string | null;    // UUID of last updater
  deletedAt: string | null;      // ISO 8601 timestamp (soft delete)
  members: DepartmentMember[];   // Department members
  _count: {
    documents: number;           // Count of documents in department
  };
}
```

### DepartmentMember

```typescript
{
  id: string;                    // UUID
  departmentId: string;          // UUID
  userId: string;                // UUID
  role: 'MEMBER' | 'MANAGER';   // Member role
  joinedAt: string;              // ISO 8601 timestamp
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  createdById: string | null;    // UUID of creator
  deletedAt: string | null;      // ISO 8601 timestamp (soft delete)
  user: {
    id: string;
    email: string;
  };
}
```

---

## Endpoints

### GET /departments

**Description:** List all departments in the tenant

**Access:** All authenticated users in tenant

**Query Parameters:** None

**Request:**
```bash
curl -X GET http://localhost:3001/departments \
  -H "Authorization: Bearer <token>" \
  -H "Cookie: <session-cookie>"
```

**Response (200 OK):**
```json
{
  "departments": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenantId": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Human Resources",
      "description": "Personnel Management and Development",
      "color": "#8B5CF6",
      "createdAt": "2026-03-17T10:30:00Z",
      "updatedAt": "2026-03-17T10:30:00Z",
      "createdById": "550e8400-e29b-41d4-a716-446655440002",
      "updatedById": "550e8400-e29b-41d4-a716-446655440002",
      "deletedAt": null,
      "members": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440003",
          "userId": "550e8400-e29b-41d4-a716-446655440004",
          "role": "MANAGER",
          "user": {
            "id": "550e8400-e29b-41d4-a716-446655440004",
            "email": "hr@company.com"
          }
        }
      ],
      "_count": {
        "documents": 5
      }
    }
  ]
}
```

---

### GET /departments/:id

**Description:** Get a specific department with its members and recent documents

**Access:** All authenticated users in tenant

**Path Parameters:**
- `id` (UUID): Department ID

**Request:**
```bash
curl -X GET http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "department": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Human Resources",
    "description": "Personnel Management and Development",
    "color": "#8B5CF6",
    "createdAt": "2026-03-17T10:30:00Z",
    "updatedAt": "2026-03-17T10:30:00Z",
    "members": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "userId": "550e8400-e29b-41d4-a716-446655440004",
        "role": "MANAGER",
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440004",
          "email": "hr@company.com"
        }
      }
    ],
    "documents": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440005",
        "title": "HR Handbook",
        "type": "PROCEDURE",
        "status": "EFFECTIVE",
        "version": 2,
        "updatedAt": "2026-03-17T09:00:00Z"
      }
    ],
    "_count": {
      "documents": 5
    }
  }
}
```

**Error Responses:**
- `404 Not Found` - Department not found
- `400 Bad Request` - Tenant context required

---

### POST /departments

**Description:** Create a new department

**Access:** Tenant admin only

**Request Body:**
```json
{
  "name": "IT & Technology",
  "description": "Information Technology and Digital Infrastructure",
  "color": "#3B82F6"
}
```

**Validation Rules:**
- `name`: Required, 2-100 characters, unique per tenant
- `description`: Optional, max 500 characters
- `color`: Optional, hex format (#RRGGBB), defaults to #3B82F6

**Request:**
```bash
curl -X POST http://localhost:3001/departments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IT & Technology",
    "description": "Information Technology and Digital Infrastructure",
    "color": "#3B82F6"
  }'
```

**Response (201 Created):**
```json
{
  "department": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "550e8400-e29b-41d4-a716-446655440001",
    "name": "IT & Technology",
    "description": "Information Technology and Digital Infrastructure",
    "color": "#3B82F6",
    "createdAt": "2026-03-17T10:30:00Z",
    "updatedAt": "2026-03-17T10:30:00Z",
    "createdById": "550e8400-e29b-41d4-a716-446655440002",
    "updatedById": "550e8400-e29b-41d4-a716-446655440002",
    "deletedAt": null,
    "members": [],
    "_count": {
      "documents": 0
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation error or tenant context required
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Admin access required
- `409 Conflict` - Department name already exists in tenant

---

### PUT /departments/:id

**Description:** Update a department

**Access:** Tenant admin only

**Path Parameters:**
- `id` (UUID): Department ID

**Request Body:**
```json
{
  "name": "IT & Digital Services",
  "description": "Updated description",
  "color": "#2563EB"
}
```

**Validation Rules:**
- All fields optional
- Same validation as POST for provided fields

**Request:**
```bash
curl -X PUT http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IT & Digital Services",
    "color": "#2563EB"
  }'
```

**Response (200 OK):**
```json
{
  "department": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "550e8400-e29b-41d4-a716-446655440001",
    "name": "IT & Digital Services",
    "description": "Information Technology and Digital Infrastructure",
    "color": "#2563EB",
    "createdAt": "2026-03-17T10:30:00Z",
    "updatedAt": "2026-03-17T11:00:00Z",
    "createdById": "550e8400-e29b-41d4-a716-446655440002",
    "updatedById": "550e8400-e29b-41d4-a716-446655440002",
    "deletedAt": null,
    "members": [],
    "_count": {
      "documents": 0
    }
  }
}
```

**Error Responses:**
- `404 Not Found` - Department not found
- `400 Bad Request` - Validation error or tenant context required
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Admin access required
- `409 Conflict` - Department name already exists in tenant

---

### DELETE /departments/:id

**Description:** Delete a department (soft delete). Associated documents are unassigned.

**Access:** Tenant admin only

**Path Parameters:**
- `id` (UUID): Department ID

**Request:**
```bash
curl -X DELETE http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "ok": true
}
```

**Error Responses:**
- `404 Not Found` - Department not found
- `400 Bad Request` - Tenant context required
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Admin access required

**Note:** Deleted departments are soft-deleted (deletedAt is set). Associated documents are unassigned but not deleted.

---

### GET /departments/:id/documents

**Description:** Get all documents in a department

**Access:** All authenticated users in tenant

**Path Parameters:**
- `id` (UUID): Department ID

**Query Parameters:**
- `page` (number): Page number, defaults to 1
- `pageSize` (number): Items per page, defaults to 20
- `status` (string): Filter by document status (DRAFT, EFFECTIVE, OBSOLETE)

**Request:**
```bash
curl -X GET "http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000/documents?page=1&pageSize=20&status=EFFECTIVE" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "documents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "title": "HR Handbook",
      "type": "PROCEDURE",
      "status": "EFFECTIVE",
      "version": 2,
      "createdAt": "2026-03-17T08:00:00Z",
      "updatedAt": "2026-03-17T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "pages": 1
  }
}
```

**Error Responses:**
- `404 Not Found` - Department not found
- `400 Bad Request` - Tenant context required

---

### POST /departments/:id/members

**Description:** Add a member to a department

**Access:** Tenant admin only

**Path Parameters:**
- `id` (UUID): Department ID

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440010",
  "role": "MANAGER"
}
```

**Validation Rules:**
- `userId`: Required, UUID format, must be active tenant member
- `role`: Optional, must be "MEMBER" or "MANAGER", defaults to "MEMBER"

**Request:**
```bash
curl -X POST http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000/members \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440010",
    "role": "MANAGER"
  }'
```

**Response (201 Created):**
```json
{
  "member": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "departmentId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "550e8400-e29b-41d4-a716-446655440010",
    "role": "MANAGER",
    "joinedAt": "2026-03-17T10:30:00Z",
    "createdAt": "2026-03-17T10:30:00Z",
    "updatedAt": "2026-03-17T10:30:00Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "email": "john@company.com"
    }
  }
}
```

**Error Responses:**
- `404 Not Found` - Department not found
- `400 Bad Request` - Validation error, user not tenant member, or tenant context required
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Admin access required
- `409 Conflict` - User is already a member of this department

---

### PUT /departments/:id/members/:userId

**Description:** Update a department member's role

**Access:** Tenant admin only

**Path Parameters:**
- `id` (UUID): Department ID
- `userId` (UUID): User ID

**Request Body:**
```json
{
  "role": "MEMBER"
}
```

**Validation Rules:**
- `role`: Required, must be "MEMBER" or "MANAGER"

**Request:**
```bash
curl -X PUT http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440010 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "MEMBER"}'
```

**Response (200 OK):**
```json
{
  "member": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "departmentId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "550e8400-e29b-41d4-a716-446655440010",
    "role": "MEMBER",
    "joinedAt": "2026-03-17T10:30:00Z",
    "createdAt": "2026-03-17T10:30:00Z",
    "updatedAt": "2026-03-17T11:00:00Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "email": "john@company.com"
    }
  }
}
```

**Error Responses:**
- `404 Not Found` - Department member not found
- `400 Bad Request` - Validation error or tenant context required
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Admin access required

---

### DELETE /departments/:id/members/:userId

**Description:** Remove a member from a department

**Access:** Tenant admin only

**Path Parameters:**
- `id` (UUID): Department ID
- `userId` (UUID): User ID

**Request:**
```bash
curl -X DELETE http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440010 \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "ok": true
}
```

**Error Responses:**
- `404 Not Found` - Department member not found
- `400 Bad Request` - Tenant context required
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Admin access required

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing the issue"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200  | OK - Request succeeded |
| 201  | Created - Resource created successfully |
| 400  | Bad Request - Invalid input or missing context |
| 401  | Unauthorized - Authentication required |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource not found |
| 409  | Conflict - Business logic constraint violation |
| 500  | Internal Server Error - Unexpected error |

---

## Validation Errors

When validation fails, the response includes details about invalid fields:

```json
{
  "error": "Validation error",
  "issues": [
    {
      "path": "name",
      "message": "Department name must be at least 2 characters"
    },
    {
      "path": "color",
      "message": "Invalid color format. Use hex format (e.g., #FF0000)"
    }
  ]
}
```

---

## Rate Limiting

All endpoints are subject to rate limiting:
- **Limit:** 200 requests per minute per IP
- **Headers:** Rate limit info in response headers
  - `RateLimit-Limit`: Maximum requests
  - `RateLimit-Remaining`: Requests remaining
  - `RateLimit-Reset`: Unix timestamp when limit resets

---

## Best Practices

1. **Tenant Context:** Always ensure your request includes proper tenant context (passed via session or JWT)

2. **Color Format:** Use valid hex color codes for consistency:
   - Example: `#3B82F6` (blue)
   - Invalid: `rgb(59, 130, 246)` or `blue`

3. **Pagination:** For large result sets, always use pagination parameters
   ```bash
   curl "http://localhost:3001/departments/123/documents?page=2&pageSize=50"
   ```

4. **Soft Deletes:** Deleted departments are not returned in list views by default
   - Use the `deletedAt` field to detect soft-deleted records
   - Consider displaying a warning to users when viewing soft-deleted data

5. **Caching:** Implement client-side caching for department lists
   - Invalidate cache when departments are modified
   - Use ETag headers if available

6. **Error Handling:** Always check for errors in responses
   ```javascript
   try {
     const res = await fetch('/departments', { method: 'POST', body: {...} });
     if (!res.ok) {
       const error = await res.json();
       console.error(error.error);
     }
   } catch (err) {
     console.error('Network error', err);
   }
   ```

---

## Examples

### Create a Department with Multiple Members

```bash
# 1. Create department
curl -X POST http://localhost:3001/departments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quality Assurance",
    "description": "Testing and quality control",
    "color": "#10B981"
  }'

# Save the returned department ID
DEPT_ID="550e8400-e29b-41d4-a716-446655440000"

# 2. Add manager
curl -X POST http://localhost:3001/departments/$DEPT_ID/members \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440010",
    "role": "MANAGER"
  }'

# 3. Add team members
curl -X POST http://localhost:3001/departments/$DEPT_ID/members \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440011",
    "role": "MEMBER"
  }'
```

### List Documents in a Department

```bash
curl -X GET "http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000/documents?status=EFFECTIVE&pageSize=10" \
  -H "Authorization: Bearer <token>"
```

### Update Department and Promote Member

```bash
# Update department
curl -X PUT http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QA & Testing",
    "color": "#059669"
  }'

# Promote member to manager
curl -X PUT http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440011 \
  -H "Content-Type: application/json" \
  -d '{"role": "MANAGER"}'
```

---

## Integration with Documents API

Departments are integrated with the Documents API:

### Create a Document with Department Assignment

```bash
curl -X POST http://localhost:3001/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "QA Test Plan",
    "type": "PROCEDURE",
    "departmentId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Upload Document with Department

```bash
curl -X POST http://localhost:3001/documents/upload \
  -F "file=@document.pdf" \
  -F "title=QA Procedures" \
  -F "type=PROCEDURE" \
  -F "departmentId=550e8400-e29b-41d4-a716-446655440000"
```

### Update Document Department Assignment

```bash
curl -X PATCH http://localhost:3001/documents/550e8400-e29b-41d4-a716-446655440005 \
  -H "Content-Type: application/json" \
  -d '{"departmentId": "550e8400-e29b-41d4-a716-446655440000"}'
```

---

## Support

For API support and issues:
- Check the logs in `/api/logs`
- Review error codes and messages in this documentation
- Contact the development team with error details and request IDs
