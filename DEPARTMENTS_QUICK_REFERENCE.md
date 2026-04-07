# Departments System - Quick Reference

## 🚀 Quick Start

### For Admins: Create Your First Department

```bash
# 1. Go to Admin → Departments
# 2. Click "New Department"
# 3. Enter:
#    - Name: "Human Resources"
#    - Description: "Personnel management"
#    - Color: Pick a color
# 4. Click "Create Department"
# 5. Click "Add Member" to add team members
```

### For Developers: API Quick Reference

```bash
# Get all departments
curl http://localhost:3001/departments

# Create department (admin only)
curl -X POST http://localhost:3001/departments \
  -H "Content-Type: application/json" \
  -d '{"name":"IT","description":"IT Department","color":"#3B82F6"}'

# Add member to department (admin only)
curl -X POST http://localhost:3001/departments/DEPT_ID/members \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","role":"MANAGER"}'

# Get documents in department
curl "http://localhost:3001/departments/DEPT_ID/documents"
```

---

## 📁 File Locations

### Backend
```
apps/api/
├── prisma/schema.prisma           ← Models
├── prisma/migrations/0011_*/      ← Migration
├── src/routes/departments.ts       ← API endpoints
├── src/routes/documents.ts         ← Updated for departments
└── src/scripts/seedDepartments.ts  ← Sample data
```

### Frontend
```
apps/web/
└── src/app/(app)/admin/departments/page.tsx  ← Admin UI
```

### Documentation
```
SGI 360/
├── DEPARTMENTS_API_DOCUMENTATION.md        ← API guide
├── DEPARTMENT_MANAGEMENT_GUIDE.md          ← User guide
├── DEPARTMENTS_IMPLEMENTATION_SUMMARY.md   ← Technical summary
└── DEPARTMENTS_QUICK_REFERENCE.md         ← This file
```

---

## 🔑 Key Concepts

### Department
- Organizational unit (team, function, division)
- Has name, description, color
- Contains members and documents
- Unique name per tenant

### Department Member
- User assigned to department
- Two roles: MEMBER or MANAGER
- Can belong to multiple departments
- Shows join date

### Association with Documents
- Documents can be assigned to department
- Department unassignment on department delete
- Filter documents by department
- Optional (documents can be unassigned)

---

## 🛡️ Permissions

| Action | Required Role |
|--------|---------------|
| View departments | Tenant User |
| Create department | Tenant Admin |
| Edit department | Tenant Admin |
| Delete department | Tenant Admin |
| Add/remove members | Tenant Admin |
| View documents | Tenant User |

---

## 📊 Database Schema Quick Look

### Department
```sql
id (UUID)
tenantId (UUID)
name (VARCHAR)
description (TEXT)
color (VARCHAR)
createdAt, updatedAt (TIMESTAMP)
createdById, updatedById (UUID)
deletedAt (TIMESTAMP, nullable)
```

### DepartmentMember
```sql
id (UUID)
departmentId (UUID)
userId (UUID)
role ('MEMBER' | 'MANAGER')
joinedAt (TIMESTAMP)
createdAt, updatedAt (TIMESTAMP)
createdById (UUID)
deletedAt (TIMESTAMP, nullable)
```

### Document (Modified)
```sql
Added: departmentId (UUID, nullable)
```

---

## 🔗 API Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/departments` | List all | User |
| GET | `/departments/:id` | Get one | User |
| POST | `/departments` | Create | Admin |
| PUT | `/departments/:id` | Update | Admin |
| DELETE | `/departments/:id` | Delete | Admin |
| GET | `/departments/:id/documents` | Documents | User |
| POST | `/departments/:id/members` | Add member | Admin |
| PUT | `/departments/:id/members/:uid` | Update role | Admin |
| DELETE | `/departments/:id/members/:uid` | Remove | Admin |

---

## 🌈 Sample Color Palette

```
Blue       #3B82F6  (IT, Administration)
Purple     #8B5CF6  (HR, People)
Green      #10B981  (Finance, Compliance)
Amber      #F59E0B  (Operations, Planning)
Red        #EF4444  (Critical, Safety)
Pink       #EC4899  (Marketing, Communications)
Cyan       #06B6D4  (Sales, Customer-facing)
Teal       #14B8A6  (Research & Development)
Orange     #F97316  (Quality, Auditing)
```

---

## 🧪 Testing Endpoints

### Create Department
```bash
curl -X POST http://localhost:3001/departments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Department",
    "description": "For testing",
    "color": "#3B82F6"
  }'
```

### List Departments
```bash
curl http://localhost:3001/departments
```

### Get Single Department
```bash
curl http://localhost:3001/departments/550e8400-e29b-41d4-a716-446655440000
```

### Add Member (need real UUIDs)
```bash
curl -X POST http://localhost:3001/departments/DEPT_ID/members \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_UUID_HERE",
    "role": "MANAGER"
  }'
```

### Get Department Documents
```bash
curl "http://localhost:3001/departments/DEPT_ID/documents?page=1&pageSize=20"
```

---

## 📝 Common Tasks

### Add Department Member
1. Go to Admin → Departments
2. Click department to expand
3. Click "Add Member"
4. Enter user UUID
5. Select role (Member/Manager)
6. Click "Add"

### Remove Department Member
1. Go to Admin → Departments
2. Click department to expand
3. Find member in list
4. Click X button next to member

### Change Member Role
1. Go to Admin → Departments
2. Click department to expand
3. Find member
4. Click role badge
5. Select new role
6. Click "Save"

### Assign Document to Department
**When Creating:**
1. Go to Documents → Add/Upload
2. Fill document details
3. Select department from dropdown
4. Complete upload

**When Updating:**
1. Open document
2. Click "Edit Department"
3. Select new department or clear
4. Save

### Filter Documents by Department
1. Go to Documents
2. Click Department filter
3. Select department name
4. View only documents in that department

---

## ⚠️ Important Notes

- Department names must be unique per tenant
- Deleting a department unassigns documents (doesn't delete them)
- Members can belong to multiple departments
- Super admin can bypass all permission checks
- RLS policies enforce tenant isolation at database level

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't create department | Check you have admin role |
| Can't add member | Verify user is in tenant first |
| Name already exists | Use different name or check duplicate |
| Can't see other users' departments | Tenant isolation working as designed |
| Documents lost after delete | They're unassigned, not deleted |

---

## 📚 Related Documentation

- **API Reference:** DEPARTMENTS_API_DOCUMENTATION.md
- **User Guide:** DEPARTMENT_MANAGEMENT_GUIDE.md
- **Technical Details:** DEPARTMENTS_IMPLEMENTATION_SUMMARY.md
- **Database Guide:** DATABASE_SCHEMA.md
- **API Guide:** API_DOCUMENTATION_GUIDE.md

---

## 🚀 Deployment Checklist

```
□ Review migration SQL
□ Run: npx prisma migrate deploy
□ Run: npm run seed (optional, loads sample data)
□ Build backend: npm run build
□ Build frontend: npm run build
□ Start servers
□ Test API endpoints
□ Test admin UI
□ Verify RLS policies active
□ Review logs for errors
□ Create backup
□ Train users
```

---

## 💡 Pro Tips

1. **Use Color Coding** - Assign consistent colors per function
2. **Assign Managers** - Each department should have at least one manager
3. **Keep Updated** - Review department structure annually
4. **Document Assignment** - Always assign documents to responsible department
5. **Regular Cleanup** - Remove members who leave
6. **Backup First** - Always backup before major changes

---

## 📞 Support

**API Issues?** → Check DEPARTMENTS_API_DOCUMENTATION.md
**UI Issues?** → Check DEPARTMENT_MANAGEMENT_GUIDE.md
**Setup Issues?** → Check DEPARTMENTS_IMPLEMENTATION_SUMMARY.md
**Implementation Issues?** → Review source code and comments

---

**Version:** 1.0
**Last Updated:** 2026-03-17
**Status:** Production Ready ✅
