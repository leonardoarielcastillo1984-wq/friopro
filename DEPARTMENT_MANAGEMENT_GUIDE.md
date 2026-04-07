# Department Management Guide for SGI 360

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Managing Departments](#managing-departments)
4. [Managing Department Members](#managing-department-members)
5. [Assigning Documents to Departments](#assigning-documents-to-departments)
6. [Viewing Department Analytics](#viewing-department-analytics)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Department Management system in SGI 360 allows you to organize your company into logical business units, manage team members, and assign documents to specific departments. This helps with:

- **Organization**: Structure your company into meaningful departments
- **Access Control**: Manage who belongs to each department
- **Document Management**: Associate documents with responsible departments
- **Reporting**: Track compliance and documents by department
- **Collaboration**: Enable team-based workflows

### Key Features

✓ Create and manage unlimited departments
✓ Assign team members as Members or Managers
✓ Color-code departments for easy identification
✓ Attach documents to departments
✓ Filter documents by department
✓ View department statistics and activity

---

## Getting Started

### Accessing Department Management

1. Log in to SGI 360
2. Click on **Admin** in the main navigation (top right)
3. Select **Departments** from the admin menu
4. You will see the Department Management dashboard

### Required Permissions

To access department management, you must have:
- **Tenant Admin** role (or higher)
- Active membership in the tenant

### First-Time Setup

If no departments exist yet:

1. Click the **"New Department"** button in the top right
2. Enter department details (name, description, color)
3. Click **"Create Department"**
4. Add team members to the department

---

## Managing Departments

### Creating a New Department

**Step 1: Open Create Form**
- Click **"New Department"** button in the top right of the dashboard

**Step 2: Fill Department Details**

| Field | Required | Description |
|-------|----------|-------------|
| Department Name | Yes | 2-100 characters, unique within tenant |
| Description | No | Up to 500 characters, brief overview |
| Color | No | Click color picker to choose (defaults to blue) |

**Step 3: Submit**
- Click **"Create Department"**
- Success message will appear
- New department appears in the list

**Example:**
```
Name: Human Resources
Description: Personnel management, recruitment, and employee development
Color: #8B5CF6 (Purple)
```

### Editing a Department

**Step 1: Locate Department**
- Find the department in the list using the search bar if needed
- Click anywhere on the department card to expand details

**Step 2: Click Edit**
- Click the **Edit** button (pencil icon) on the department card
- Form appears with current values

**Step 3: Update**
- Modify any field (name, description, color)
- Click **"Save"** to save changes
- Click **"Cancel"** to discard changes

**Note:** Editing a department does NOT affect existing documents or members

### Deleting a Department

**Step 1: Locate Department**
- Find the department you want to delete

**Step 2: Initiate Deletion**
- Click the **Delete** button (trash icon)
- Confirmation dialog appears

**Step 3: Confirm**
- Click **"Delete"** to confirm (this action cannot be undone)
- Documents assigned to the department will be unassigned
- Department members will lose their department assignment

**Warning:** Before deleting a department:
- Review documents that will be unassigned
- Notify team members who will be removed
- Consider archiving instead if possible

### Viewing Department Details

**To expand department details:**
- Click anywhere on the department card

**You will see:**
- Department name and description
- Team members and their roles
- Recent documents (up to 5 most recent)
- Document count for the department

**Example:**
```
┌─ Human Resources (Purple bar)
│  Personnel management and recruitment
│
├─ Members (3):
│  • john@company.com (Manager)
│  • jane@company.com (Member)
│  • mike@company.com (Member)
│
├─ Recent Documents:
│  • HR Handbook (EFFECTIVE)
│  • Recruitment Policy (DRAFT)
│  • Training Records (EFFECTIVE)
│
└─ Total Documents: 15
```

---

## Managing Department Members

### Adding a Member to a Department

**Step 1: Expand Department**
- Click on the department card to expand details

**Step 2: Click "Add Member"**
- Click the **"Add Member"** button in the Members section
- Form appears with user and role fields

**Step 3: Select User**
- Enter the user's ID (UUID) in the "User" field
- Or search from available users (if available)

**Note:** The user must already be a member of your tenant to be added to a department

**Step 4: Choose Role**
- **Member**: Regular team member with limited authority
- **Manager**: Can oversee department operations

**Step 5: Save**
- Click **"Add"** to add the member
- User appears in the members list

### Changing a Member's Role

**Step 1: Expand Department**
- Click on the department card

**Step 2: Locate Member**
- Find the team member in the Members list

**Step 3: Update Role**
- Click the role badge or **Edit** option for that member
- Select new role (Member or Manager)
- Click **"Save"**

### Removing a Member

**Step 1: Expand Department**
- Click on the department card

**Step 2: Find Member**
- Locate the team member you want to remove

**Step 3: Remove**
- Click the **Remove** button (X icon) next to the member
- Confirmation may appear
- Member is removed from the department

**Note:** Removing a member does NOT delete the user account, only removes department assignment

---

## Assigning Documents to Departments

### When Uploading a New Document

**Step 1: Go to Documents**
- Navigate to **Documents** section
- Click **"Upload Document"** or **"Add Document"**

**Step 2: Fill Document Details**
- Enter title and type
- **NEW:** Select department (optional dropdown)

**Step 3: Choose Department**
- Click the Department dropdown
- Select the appropriate department
- Leave empty for unassigned documents

**Step 4: Upload and Submit**
- Complete document upload as usual
- Document will be assigned to selected department

### Changing Document Department

**Step 1: Open Document**
- Navigate to the document in Documents view
- Click to open document details

**Step 2: Edit Assignment**
- Click **"Edit Department"** or the Department field
- Select new department or clear assignment
- Save changes

### Filtering Documents by Department

**Step 1: Go to Documents**
- Navigate to Documents section

**Step 2: Use Filter**
- Find the **Department Filter** dropdown
- Select a department name
- List will show only documents from that department

**Step 3: View Results**
- Browse documents assigned to the selected department
- Click **"Clear Filter"** to see all documents

---

## Viewing Department Analytics

### Department Dashboard

On the Department Management page, each department card shows:

- **Member Count**: Number of team members
- **Document Count**: Number of assigned documents
- **Department Color**: Visual identifier

### Detailed Department View

Click on a department to see:

**Members Tab:**
- List of all members
- Member roles (Manager/Member)
- Join dates
- Contact information (email)

**Documents Tab:**
- List of documents assigned to department
- Document status (Draft, Effective, Obsolete)
- Document version
- Last modified date

**Statistics:**
- Total documents
- Active (Effective) documents
- Draft documents
- Archived documents

### Department Reports

Future feature: Department-specific compliance reports and analytics

---

## Best Practices

### 1. Department Naming

✓ **Do:**
- Use clear, descriptive names
- Use consistent naming convention
- Use functional titles (e.g., "Quality Assurance" not "QA_Team_1")

✗ **Don't:**
- Use abbreviations unless widely known
- Use person names (departments should be stable)
- Use special characters

**Examples of good names:**
- Human Resources
- Finance & Accounting
- IT & Technology
- Operations
- Quality & Compliance
- Marketing & Communications

### 2. Department Structure

**Recommended approach:**
- Create departments based on functional areas
- Align with organizational structure
- Keep 5-15 departments (sweet spot for most companies)
- Don't create per-person departments

**Example structure for medium company:**
```
Administration
├── Human Resources
├── Finance & Accounting
└── Legal

Operations
├── IT & Technology
├── Facilities
└── Supply Chain

Quality
├── Quality Assurance
└── Compliance

Sales & Marketing
├── Sales
└── Marketing
```

### 3. Member Management

✓ **Do:**
- Assign clear managers to each department
- Review membership quarterly
- Update roles as responsibilities change
- Document why members are in departments

✗ **Don't:**
- Leave departments without managers
- Add users to too many departments
- Forget to remove members who leave
- Use departments for access control alone

### 4. Document Organization

✓ **Do:**
- Assign documents to the responsible department
- Use consistent document types per department
- Keep departments and documents synchronized
- Review unassigned documents regularly

✗ **Don't:**
- Assign documents to wrong departments for convenience
- Leave critical documents unassigned
- Create departments just for document storage

### 5. Color Coding

Use colors consistently:
- **Blue** (#3B82F6): Default, administrative
- **Purple** (#8B5CF6): HR, People-related
- **Green** (#10B981): Finance, Compliance
- **Amber** (#F59E0B): Operations, Planning
- **Red** (#EF4444): Critical, Safety
- **Pink** (#EC4899): Marketing, Communications
- **Cyan** (#06B6D4): Sales, Customer-facing
- **Orange** (#F97316): Quality, Auditing

---

## Troubleshooting

### Common Issues

#### Issue: "Admin access required"

**Solution:**
- You must have Tenant Admin role
- Contact your system administrator to request access
- Verify your membership status in tenant

#### Issue: Cannot add user to department

**Possible causes:**
1. User is not a member of the tenant
   - Solution: Add user to tenant first
2. User ID format is incorrect
   - Solution: Verify user UUID (not email)
3. User is already in the department
   - Solution: Check members list to confirm

**Action:**
1. Go to Tenant Settings → Members
2. Verify user is active in tenant
3. Copy correct user ID (UUID format)
4. Retry adding to department

#### Issue: Cannot create department with that name

**Cause:** Department name already exists in your tenant

**Solution:**
- Department names must be unique within tenant
- Use a different name
- Or delete the existing department first

#### Issue: Deleted department is still showing

**Cause:** Page is not refreshed

**Solution:**
- Refresh page (F5 or Cmd+R)
- Wait a few seconds for UI to update
- Clear browser cache if problem persists

#### Issue: Documents are still unassigned after deletion

**Expected behavior:** When a department is deleted:
- Documents previously assigned to it become unassigned
- Documents are NOT deleted
- You can reassign documents to another department

**Solution:**
- Go to Documents section
- Filter by "Unassigned"
- Reassign documents to appropriate departments

### Getting Help

If you encounter issues:

1. **Check this guide** - Look for your scenario in troubleshooting
2. **Review API Documentation** - See DEPARTMENTS_API_DOCUMENTATION.md
3. **Check Application Logs** - Look for error messages
4. **Contact Admin** - Reach out to your system administrator
5. **Report Bug** - If you find a bug, provide:
   - Steps to reproduce
   - Error messages
   - Browser and version
   - Time of occurrence

---

## FAQ

### Can I rename a department?

Yes! Edit the department and change the name. All documents and members stay assigned.

### What happens when I delete a department?

- Department is soft-deleted (can be recovered by admin)
- Documents lose department assignment (but aren't deleted)
- Members lose department membership
- You can reassign documents to other departments

### Can users belong to multiple departments?

Yes! A user can be a member of multiple departments with potentially different roles.

### Can I see which documents are unassigned?

Not in the current UI, but you can filter in Documents and sort by Department.

### How do I view all documents in a department?

Click on the department card to expand, then click the department link or view the Documents tab.

### Can I set department permissions?

Department membership is currently informational. For access control, use document-level or tenant-level permissions.

### What's the difference between Member and Manager?

- **Member**: Regular department participant
- **Manager**: Designated leader (currently informational, future feature may add permissions)

### Can I export department data?

Future feature. Currently, you can view and manage departments through the UI.

### How often should I review departments?

- **Annually**: Full review of all departments
- **Quarterly**: Review membership changes
- **Monthly**: Update documents and assignments

---

## Related Topics

- [Documents Management Guide](./DOCUMENTS_GUIDE.md)
- [User Management Guide](./USER_MANAGEMENT_GUIDE.md)
- [API Documentation](./DEPARTMENTS_API_DOCUMENTATION.md)
- [Compliance & Audit](./AUDIT_LOGGING_GUIDE.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-17 | Initial release |

---

**Last Updated:** 2026-03-17
**Status:** Production Ready
**Support:** admin@sgi360.com
