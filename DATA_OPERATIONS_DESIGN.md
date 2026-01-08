# Data Operations Design Document

**Project:** AnotherCRM  
**Last Updated:** November 12, 2025  
**Purpose:** Comprehensive guide for all data operations, side effects, and cleanup requirements

---

## 🌍 Important: Internationalization (i18n)

**⚠️ CRITICAL**: All user-facing messages, especially task history entries, MUST use i18n translation keys.

**Task History Internationalization:**

- History entries are stored with i18n keys (e.g., `"task.history.created"`)
- Parameters are stored separately for dynamic values
- Display layer translates keys based on user's language preference
- Supported languages: English (`en`), Latvian (`lv`)
- All history description examples in this document use i18n keys

**Translation Key Format:**

```javascript
// Store in database
{
  description: "task.history.title_changed",
  params: { oldTitle: "Old", newTitle: "New" }
}

// Display to user (translated)
// EN: "Title changed from 'Old' to 'New'"
// LV: "Nosaukums mainīts no 'Old' uz 'New'"
```

---

## Table of Contents

1. [Task Operations](#task-operations)
2. [File Operations](#file-operations)
3. [User Operations](#user-operations)
4. [Client Operations](#client-operations)
5. [Tab System Operations](#tab-system-operations)
6. [Authentication Operations](#authentication-operations)
7. [Material & Product Operations](#material--product-operations)
8. [Cleanup & Maintenance Tasks](#cleanup--maintenance-tasks)

---

## Task Operations

### Creating a Task

**Primary Action:** Insert into `task` table

**Required Side Effects:**

1. **History Entry**: Add entry to `taskHistory` with description key for i18n (e.g., `"task.history.created"`)
   - **⚠️ IMPORTANT**: All history descriptions should use i18n keys for translation support
2. **Validation**: Ensure referenced `tabId` exists (RESTRICT enforced by DB)

3. **Permission Checks** (Application Level):
   - **Clients**: Can ONLY create tasks in their own personal tab
   - **Admins**: Can create tasks in any tab (personal or shared)
   - Verify user has permission to create tasks in the specified tab

4. **Optional Associations**:
   - If `clientId` provided, verify client exists
   - If `assignedToUserId` provided, verify user exists
   - If `managerId` provided, verify user exists

**Database Constraints:**

- `tabId` cannot be null (task must belong to a tab)
- If tab doesn't exist, operation will fail (RESTRICT constraint)

**Post-Creation:**

- Set `created_at` and `updated_at` timestamps automatically

---

### Editing a Task

**Primary Action:** Update `task` record

**Required Side Effects:**

1. **Edit Session Management**:
   - **Before Edit**: Check for existing `taskEditSession`
     - If exists and not expired and different user → Show "Task locked" error
     - If exists and same user → Update `lastActivityAt` timestamp
     - If doesn't exist → Create new `taskEditSession` with:
       - `taskId`: Task being edited
       - `userId`: Current user
       - `startedAt`: Current timestamp
       - `lastActivityAt`: Current timestamp
       - `expiresAt`: Current timestamp + session timeout (e.g., 5 minutes)

2. **History Tracking** - Add entries for each changed field using i18n keys:
   - **⚠️ IMPORTANT**: All history entries must use i18n translation keys with parameters
   - Title changed: `"task.history.title_changed"` with params: `{oldTitle, newTitle}`
   - Description changed: `"task.history.description_updated"`
   - Client changed: `"task.history.client_changed"` with params: `{clientName}`
   - Assigned user changed: `"task.history.assigned_to"` with params: `{userName}`
   - Manager changed: `"task.history.manager_changed"` with params: `{managerName}`
   - Status changed to done: `"task.history.marked_done"` (FINAL, non-reversible)
   - End date changed: `"task.history.due_date_changed"` with params: `{newDate}`
   - Price changed: `"task.history.price_changed"` with params: `{newPrice}`
   - Count changed: `"task.history.count_changed"` with params: `{newCount}`
   - Tab changed: `"task.history.moved_to_tab"` with params: `{oldTabName, newTabName}`

3. **Session Activity Update**:
   - Update `lastActivityAt` on the `taskEditSession` every time user makes a change
   - Extend `expiresAt` with each activity

4. **Timestamp Update**:
   - `updated_at` automatically updates via `$onUpdate` callback

**Session Cleanup:**

- When user explicitly saves/closes: Delete the `taskEditSession`
- On session expiry: Background job should clean up expired sessions

---

### Deleting a Task

**Primary Action:** Delete from `task` table

**Required Side Effects (in order):**

1. **Delete Edit Session**: Remove from `taskEditSession` if exists (CASCADE handled by DB)

2. **Delete Files**:
   - **CRITICAL**: For each file in `files` where `taskId` matches:
     - **Delete physical file** from server filesystem at `downloadUrl` path
     - Delete database record from `files` table (CASCADE handled by DB)
   - Files must be deleted BEFORE task deletion

3. **Delete History**: All `taskHistory` entries (CASCADE handled by DB)

4. **Cleanup Complete**: Now safe to delete task record

**Database Cascades (automatic):**

- `taskHistory` → CASCADE DELETE
- `taskEditSession` → CASCADE DELETE
- `files` → CASCADE DELETE

**Manual Actions Required:**

- Delete physical files from filesystem
- Verify no orphaned files remain

---

### Marking Task as Done (FINAL ACTION)

**⚠️ CRITICAL**: Marking a task as done is **FINAL and NON-REVERSIBLE**

**Primary Action:** Update `task.isDone` to `true`

**Required Side Effects (in order):**

1. **Delete All Associated Files**:
   - **CRITICAL**: For each file in `files` where `taskId` matches:
     - Delete physical file from server filesystem at `downloadUrl` path
     - Delete database record from `files` table
   - Once task is done, it serves as **historical reference only**
   - No files should remain attached

2. **Delete Task Images**:
   - If `task.preview` field contains an image path:
     - Delete physical preview image from server
     - Clear `task.preview` field (set to NULL)

3. **History Entry**: Add to `taskHistory` with i18n key:
   - `"task.history.marked_done"` (this is the final entry for this task)

4. **Delete Edit Session**:
   - Remove from `taskEditSession` (task no longer editable)

5. **Timestamp Update**:
   - `updated_at` automatically updates to record when task was completed

**UI Considerations:**

- Show confirmation dialog: "Marking this task as done is permanent. All files will be deleted. Continue?"
- Disable "Mark as Done" button once task is done (non-reversible)
- Display done tasks in read-only mode with "COMPLETED" badge

**Alternative Statuses:**

- For tasks that are "sort of done" or "in progress", use different tabs
- Only use `isDone = true` when task is completely finished and archived

---

### Moving Task to Different Tab

**Primary Action:** Update `task.tabId`

**Required Side Effects:**

1. **Validation**: Ensure target tab exists

2. **Permission Checks** (Application Level):
   - **Clients**: Can ONLY move tasks within their own personal tab (basically can't move tasks)
   - **Admins**: Can move tasks between any tabs
   - Verify user has permission to move task to target tab

3. **History Entry**: Add to `taskHistory` with i18n key:
   - `"task.history.moved_to_tab"` with params: `{oldTabName, newTabName}`

4. **Edit Session Update**: Update `lastActivityAt` if session exists

5. **Timestamp Update**: `updated_at` automatically updates

**Database Constraints:**

- New `tabId` must exist (RESTRICT enforced)
- Cannot move task to non-existent tab

---

## File Operations

### Uploading a File to Task

**Primary Action:** Insert into `files` table

**Required Side Effects:**

1. **Physical File Storage**:
   - Save file to server filesystem (e.g., `uploads/` directory)
   - Generate unique filename to prevent collisions (timestamp + random string)
   - Store original filename in `filename` field
   - Store server path in `downloadUrl` field
   - Calculate and store file `size` in bytes

2. **Database Record**:
   - Create `files` entry with:
     - `filename`: Original filename
     - `downloadUrl`: Path to file on server
     - `size`: File size in bytes
     - `taskId`: Associated task
     - `created_at`: Auto-generated timestamp

3. **History Entry**: Add to `taskHistory` with i18n key:
   - `"task.history.file_uploaded"` with params: `{filename, size}`

4. **Edit Session Update**: Update `lastActivityAt` if session exists

**Validation:**

- Verify `taskId` exists
- Check file size limits
- Validate file types (if restrictions apply)
- Ensure upload directory is writable

---

### Deleting a File from Task

**Primary Action:** Delete from `files` table

**Required Side Effects:**

1. **CRITICAL - Physical File Deletion**:
   - **BEFORE** deleting database record:
     - Read `downloadUrl` from database
     - Delete physical file from server filesystem
     - Verify file deletion was successful
   - If physical file deletion fails:
     - Log error
     - Optionally fail the operation or mark file for cleanup

2. **Database Record Deletion**:
   - Delete from `files` table

3. **History Entry**: Add to `taskHistory` with i18n key:
   - `"task.history.file_deleted"` with params: `{filename}`

4. **Edit Session Update**: Update `lastActivityAt` if session exists

**Error Handling:**

- If file doesn't exist on filesystem: Log warning, proceed with DB deletion
- If file deletion fails: Log error, consider retry mechanism
- Always delete DB record to prevent orphaned references

---

### Downloading a File

**Primary Action:** Read from `files` table and serve file

**Required Side Effects:**

- **None** - Read-only operation
- Optionally: Log download activity for audit trail

**Process:**

1. Query `files` table for file record
2. Verify file exists on filesystem at `downloadUrl`
3. Serve file with appropriate headers (filename, content-type, size)
4. Handle missing files gracefully

---

## User Operations

### Creating a User

**⚠️ CRITICAL**: User registration is **INVITE-ONLY** - requires valid invite code

**Primary Action:** Insert into `user` table

**Required Side Effects:**

1. **Invite Code Validation** (REQUIRED):
   - **MUST** have a valid, unused, non-expired invite code
   - Verify invite code exists in `inviteCodes` table
   - Check: `used = false` AND `expiresAt > NOW()`
   - If invalid/expired: **REJECT** registration

2. **User Type Assignment**:
   - Set `user.type` based on `inviteCodes.codeFor` value
   - **Admin Invite**: Creates admin user (`type = 'admin'`)
   - **Client Invite**: Creates client user (`type = 'client'`)
   - **⚠️ IMPORTANT**: Only admins can create invite codes
   - Clear separation between admin and client invite codes

3. **Client User Setup** (if `type = 'client'`):
   - **Option A - Link to Existing Client**:
     - Prompt: "Do you have an existing client account?"
     - If yes: Show list of clients (search by email/phone)
     - Create `userClient` junction record linking user to selected client
   - **Option B - Create New Client**:
     - Collect client information (name, email, phone, etc.)
     - Create new `client` record
     - Create `userClient` junction record
   - One of these options MUST be completed for client users

4. **Admin User Setup** (if `type = 'admin'`):
   - No client association required
   - Full system access granted

5. **Password Hashing**:
   - **NEVER** store plain text password
   - Hash password using bcrypt/argon2 before storage

6. **Default Settings**:
   - Create `settings` record with default values:
     - `language`: Default to user's preferred language or 'en'
     - `nextcloud`, `nextcloud_username`, `nextcloud_password`: NULL

7. **Mark Invite Code as Used**:
   - Set `inviteCodes.used` = `true`
   - Store `userId` reference (if tracking who used which code)

8. **Create Personal Tab** (Default):
   - Create a new `tab` with `userId` = new user's ID
   - Create `tabTranslation` entries for supported languages
   - This is the user's default workspace
   - **Clients**: Can ONLY create tasks in this personal tab
   - **Admins**: Can create tasks in any tab

**Validation:**

- Valid, unused, non-expired invite code (REQUIRED)
- Email must be unique
- Username must be unique
- Valid email format
- Strong password requirements
- For client users: Must link to existing or create new client record

**Registration Flow:**

```
1. User provides invite code
2. System validates invite code (unused, not expired, exists)
3. User provides account details (email, username, password)
4. System determines user type from invite code
5. If client user:
   a. Ask: "Link to existing client or create new?"
   b. If existing: Select client from list
   c. If new: Collect client details and create client record
6. Hash password
7. Create user record
8. Create settings record
9. Create user-client association (if client user)
10. Create personal tab for user
11. Mark invite code as used
12. Send welcome email
```

---

### Deleting a User

**Primary Action:** Delete from `user` table

**Complex Operation - Multiple Cascades and SET NULL behaviors**

**Before Deletion - Manual Checks:**

1. **Check for Manager Responsibilities**:
   - Query `task` where `managerId` = user.id
   - If any found: **REQUIRE** reassignment or fail deletion
   - Database uses `SET NULL` on `task.managerId`, so tasks will survive

2. **Reassign or Handle Tasks**:
   - Tasks assigned to user (`assignedToUserId`): Will be SET NULL (unassigned)
   - Tasks managed by user (`managerId`): Will be SET NULL (no manager)
   - Consider reassigning to another user before deletion

**Automatic Cascades (handled by database):**

1. **Sessions**: All `session` records → CASCADE DELETE
2. **Password Reset Tokens**: All `passwordResetToken` → CASCADE DELETE
3. **Settings**: User's `settings` record → CASCADE DELETE
4. **Personal Tabs**: User's `tab` record (where `userId` = user) → CASCADE DELETE
5. **Tab Preferences**: All `userTabPreference` records → CASCADE DELETE
6. **Client Associations**: All `userClient` junction records → CASCADE DELETE
7. **Task Edit Sessions**: All `taskEditSession` records → CASCADE DELETE
8. **Task History**: History records preserve, but `userId` → SET NULL

**Required Side Effects:**

1. **Task Assignment Cleanup**:
   - Tasks lose assignee (becomes NULL)
   - Tasks lose manager (becomes NULL)
   - Consider notification to other users about unassigned tasks

2. **Personal Tab Cascade**:
   - Deleting personal tab triggers tab deletion cascade:
     - All tasks in personal tab need reassignment first (RESTRICT will prevent deletion)
     - All tab translations deleted
     - All user preferences for that tab deleted

3. **Client Access Removal**:
   - Remove all client associations via `userClient` deletion

**Recommended Pre-Deletion Workflow:**

```
1. List all tasks assigned to user
2. List all tasks managed by user
3. List user's personal tabs and contained tasks
4. Prompt admin to:
   - Reassign tasks to other users
   - Move tasks from personal tabs to shared tabs
   - Delete or archive unnecessary tasks
5. Only then proceed with user deletion
```

**Post-Deletion Verification:**

- Verify no orphaned sessions
- Verify no orphaned edit sessions
- Check for tasks with NULL assignments that need attention

---

### Updating User Settings

**Primary Action:** Update `settings` table

**Required Side Effects:**

1. **Nextcloud Credentials**:
   - If updating `nextcloud_password`:
     - **Encrypt** password before storage (DO NOT store plain text)
     - Use application-level encryption
   - Validate Nextcloud connection if credentials changed

2. **Language Change**:
   - Update `language` field
   - May trigger UI refresh on client side

**Validation:**

- Valid language code
- Valid Nextcloud URL format (if provided)
- Test Nextcloud connection before saving credentials

---

## Client Operations

### Creating a Client

**Primary Action:** Insert into `client` table

**Required Side Effects:**

1. **Validation**: Ensure at least email OR phone is provided
   - Database CHECK constraint enforces this
   - Provide clear error message if both are null

2. **Type Assignment**:
   - Default to `'BTC'` (Business-to-Consumer)
   - Set to `'BTB'` if business details provided (VAT, registration number)

3. **User Association** (if applicable):
   - Create `userClient` junction record to associate client with current user
   - For admin users, may not need association
   - For client users, associate with their account

**Validation:**

- At least one contact method (email or phone)
- Valid email format (if provided)
- Unique email (optional, but recommended)

---

### Updating a Client

**Primary Action:** Update `client` record

**Required Side Effects:**

1. **Contact Validation**:
   - Ensure at least email OR phone remains populated
   - CHECK constraint will reject if both become null

2. **Type Recalculation** (optional):
   - If business details added (VAT, registration number) → suggest changing type to BTB
   - If business details removed → suggest changing type to BTC

3. **Timestamp Update**: `updated_at` automatically updates

**Validation:**

- At least one contact method must remain
- Valid email format (if provided)

---

### Deleting a Client

**Primary Action:** Delete from `client` table

**Required Side Effects:**

**Automatic Cascades:**

1. **User Associations**: All `userClient` junction records → CASCADE DELETE
2. **Task References**: All tasks where `clientId` matches → SET NULL
   - Tasks survive but lose client association
   - Consider this data loss - may want to prevent or warn

**Manual Considerations:**

1. **Task Impact Warning**:
   - Before deletion, query tasks where `clientId` = client.id
   - Show count to user: "This client has X tasks. They will become unassociated."
   - Offer to:
     - Cancel deletion
     - Reassign tasks to another client
     - Archive client instead of deleting

2. **Historical Data**:
   - Client deletion doesn't delete their tasks
   - Tasks become "orphaned" (no client reference)
   - Consider soft delete instead: Add `deleted_at` field

**Recommended Approach:**

- Implement soft delete for clients
- Add `is_deleted` boolean or `deleted_at` timestamp
- Filter deleted clients from normal queries
- Preserve data for historical reporting

---

## Tab System Operations

### Creating a Tab Group

**Primary Action:** Insert into `tabGroup` table

**Required Side Effects:**

1. **Translations**:
   - Create `tabGroupTranslation` entries for each supported language
   - Required languages: `'en'`, `'lv'` (based on messages/ directory)
   - Each translation needs `name` field populated

2. **Sort Order**:
   - Assign `sortOrder` value
   - Typically: Find MAX(sortOrder) + 1
   - Or allow user to specify position

**Validation:**

- At least one translation must be provided
- Translations for required languages

**Example:**

```sql
-- Create group
INSERT INTO tab_groups (sort_order) VALUES (1);

-- Add translations
INSERT INTO tab_group_translations (tab_group_id, language, name)
VALUES
  (1, 'en', 'Projects'),
  (1, 'lv', 'Projekti');
```

---

### Deleting a Tab Group

**Primary Action:** Delete from `tabGroup` table

**Complex Operation - Prevents deletion if tabs exist**

**Before Deletion - Manual Checks:**

1. **Check for Tabs**:
   - Query `tab` where `groupId` = tabGroup.id
   - If any tabs exist: **DELETION BLOCKED** (RESTRICT constraint)
   - Must delete or move all tabs first

**Required Pre-Deletion Steps:**

1. For each tab in group:
   - Move tab to another group (update `tab.groupId`), OR
   - Delete tab (see "Deleting a Tab" below)

2. Only when group is empty, deletion can proceed

**Automatic Cascades (when group is empty):**

- All `tabGroupTranslation` records → CASCADE DELETE

**Recommended Workflow:**

```
1. List all tabs in group
2. Prompt user to:
   - Move tabs to another group
   - Delete tabs (with all implications)
3. Once empty, delete group
4. Translations automatically deleted
```

---

### Creating a Tab

**Primary Action:** Insert into `tab` table

**Default Behavior:** All tabs are **personal tabs** by default

**Required Side Effects:**

1. **Tab Type** (Default: Personal):
   - **Personal tab** (DEFAULT): `userId` = current user's ID
   - **Shared tab** (Admin only): `userId` = NULL
   - All new tabs default to personal unless explicitly created as shared

2. **Permission Checks** (Application Level):
   - **Clients**: Can ONLY create personal tabs (`userId` = their user ID)
     - Cannot create shared tabs
     - Cannot create tabs for other users
   - **Admins**: Can create:
     - Personal tabs for themselves
     - Personal tabs for other users
     - Shared tabs (`userId` = NULL)

3. **Translations**:
   - Create `tabTranslation` entries for each supported language
   - Required languages: `'en'`, `'lv'`

4. **Sort Order**:
   - Assign `sortOrder` within the group
   - Typically: Find MAX(sortOrder) for group + 1

5. **Color Assignment**:
   - Default to `'#FFFFFF'` or allow user selection
   - Used for visual organization

6. **User Preferences** (for shared tabs only):
   - For shared tabs: Create default `userTabPreference` for all existing users
   - For personal tabs: No preferences needed (user owns the tab)
   - Or create preferences on-demand when user first interacts

**Validation:**

- `groupId` must exist
- `userId` must exist (since personal is default)
- Translations for required languages
- Client users can only set `userId` to their own ID

**Tab Ownership:**

- Personal tabs: User has full control over their own tab
- Shared tabs: Managed by admins, visible to all users (based on preferences)

---

### Deleting a Tab

**Primary Action:** Delete from `tab` table

**Complex Operation - Prevents deletion if tasks exist**

**Before Deletion - Manual Checks:**

1. **Check for Tasks**:
   - Query `task` where `tabId` = tab.id
   - If any tasks exist: **DELETION BLOCKED** (RESTRICT constraint)
   - Must delete or move all tasks first

**Required Pre-Deletion Steps:**

1. For each task in tab:
   - Move task to another tab (update `task.tabId`), OR
   - Delete task (see "Deleting a Task" above)
   - Add history entries for moved tasks

2. Only when tab is empty, deletion can proceed

**Automatic Cascades (when tab is empty):**

1. **Translations**: All `tabTranslation` records → CASCADE DELETE
2. **User Preferences**: All `userTabPreference` records → CASCADE DELETE

**Recommended Workflow:**

```
1. List all tasks in tab
2. Prompt user to:
   - Move tasks to another tab (bulk operation)
   - Delete tasks (with all implications)
3. Once empty, delete tab
4. Translations and preferences automatically deleted
```

---

### Updating User Tab Preferences

**Primary Action:** Insert or update `userTabPreference`

**Required Side Effects:**

1. **Visibility Changes**:
   - User hides tab: Set `isVisible` = false
   - User shows tab: Set `isVisible` = true
   - Tab still exists, just hidden from user's view

2. **Sort Order Changes**:
   - User reorders tabs: Update `sortOrder` for affected preferences
   - May require updating multiple preferences to maintain unique order

3. **Unique Constraint**:
   - One preference per user per tab
   - Use UPSERT (INSERT ... ON CONFLICT UPDATE) pattern

**Validation:**

- `userId` and `tabId` must exist
- `sortOrder` should be unique within user's visible tabs

---

## Authentication Operations

### Creating Invite Codes (Admin Only)

**⚠️ CRITICAL**: Only admins can create invite codes

**Primary Action:** Insert into `inviteCodes` table

**Required Side Effects:**

1. **Permission Check**:
   - **MUST** verify current user is admin (`user.type = 'admin'`)
   - If not admin: **REJECT** operation
   - Clients cannot create invite codes

2. **Code Generation**:
   - Generate unique, random invite code
   - Recommend: 8-12 character alphanumeric code
   - Verify code doesn't already exist (unique constraint)

3. **User Type Selection** (REQUIRED):
   - **Admin Invite** (`codeFor = 'admin'`):
     - Creates admin user when used
     - Should be rare and carefully controlled
     - Consider requiring super-admin approval
   - **Client Invite** (`codeFor = 'client'`):
     - Creates client user when used
     - Standard invite for new clients
   - **⚠️ IMPORTANT**: Clear UI separation between these options
   - Confirm dialog: "You are creating an ADMIN invite code. Continue?"

4. **Expiration**:
   - Set `expiresAt` timestamp
   - Recommended: 7-30 days from creation
   - Admin can customize expiration period
   - Store as ISO string or timestamp

5. **Initial State**:
   - `used` = `false`
   - `code` = generated unique code
   - `id` = unique identifier

**Validation:**

- User must be admin
- Code must be unique
- Valid expiration date (future date)
- `codeFor` must be either 'admin' or 'client'

**UI Recommendations:**

- Separate buttons: "Create Client Invite" vs "Create Admin Invite"
- Show warning for admin invites
- Display created code with copy button
- Show expiration date
- List of active invite codes with status (used/unused)

**Security Considerations:**

- Log all invite code creations (who created, what type, when)
- Monitor admin invite code usage
- Consider approval workflow for admin invites
- Rate limit invite code creation

---

### User Login

**Primary Action:** Verify credentials and create session

**Required Side Effects:**

1. **Password Verification**:
   - Retrieve user by email
   - Compare hashed password with provided password
   - Use timing-safe comparison to prevent timing attacks

2. **Session Creation**:
   - Generate unique session ID (cryptographically secure random)
   - Insert into `session` table:
     - `id`: Generated session ID
     - `userId`: Authenticated user ID
     - `expiresAt`: Current time + session duration (e.g., 7 days)

3. **Session Cookie**:
   - Set HTTP-only cookie with session ID
   - Secure flag (HTTPS only)
   - SameSite attribute

**Security Considerations:**

- Rate limiting on failed attempts
- Log failed login attempts
- Consider 2FA for sensitive accounts

---

### User Logout

**Primary Action:** Delete session

**Required Side Effects:**

1. **Session Cleanup**:
   - Delete from `session` table where `id` = current session
   - Clear session cookie

2. **Edit Session Cleanup**:
   - Delete any active `taskEditSession` for this user
   - Releases locks on tasks they were editing

**Process:**

```
1. Get session ID from cookie
2. Delete session from database
3. Clear session cookie
4. Clean up user's edit sessions
5. Redirect to login page
```

---

### Password Reset Request

**Primary Action:** Create password reset token

**Required Side Effects:**

1. **Token Generation**:
   - Generate cryptographically secure random token
   - Insert into `passwordResetToken`:
     - `id`: Unique identifier
     - `userId`: User requesting reset
     - `token`: Generated token
     - `expiresAt`: Current time + validity period (e.g., 1 hour)
     - `used`: false

2. **Email Notification**:
   - Send email to user with reset link
   - Link format: `/reset-password?token={token}`
   - Include expiration time in email

3. **Old Token Cleanup** (optional):
   - Delete or mark as used any existing unused tokens for this user
   - Prevents token accumulation

**Security:**

- Token should be long and random (32+ characters)
- Short expiration time (1 hour recommended)
- One-time use only

---

### Password Reset Completion

**Primary Action:** Update user password and mark token as used

**Required Side Effects:**

1. **Token Validation**:
   - Verify token exists and is not used
   - Verify token has not expired
   - Verify token belongs to a valid user

2. **Password Update**:
   - Hash new password
   - Update `user.password`

3. **Token Invalidation**:
   - Set `passwordResetToken.used` = true
   - Or delete the token

4. **Session Cleanup**:
   - **Optional but recommended**: Delete all existing sessions for this user
   - Forces re-login on all devices
   - Security best practice after password change

5. **Notification**:
   - Send confirmation email that password was changed
   - Security notification for user

**Process:**

```
1. Validate token
2. Hash new password
3. Update user password
4. Mark token as used
5. Delete all user sessions
6. Send confirmation email
```

---

## Material & Product Operations

### Creating/Updating Materials

**Primary Action:** Insert or update `material` table

**Required Side Effects:**

1. **Image Upload** (if provided):
   - Upload image to server filesystem
   - Store path in `image` field
   - Generate thumbnail (optional)

2. **Inventory Tracking**:
   - Set initial `remaining` quantity
   - Consider creating inventory history table (not in current schema)

3. **Timestamp Management**:
   - `created_at` set on creation
   - `updated_at` updated on modification

**Validation:**

- Unique article number (recommended)
- Valid `remaining` quantity (≥ 0)
- Image file type validation

---

### Deleting Materials

**Primary Action:** Delete from `material` table

**Required Side Effects:**

1. **Image Cleanup**:
   - If `image` field is not null:
     - Delete physical image file from server
     - Delete thumbnail if exists

2. **Dependency Check** (recommended):
   - Check if material is referenced in tasks or orders
   - Warn user or prevent deletion if in use
   - Consider soft delete instead

**No Database Cascades:**

- Materials have no foreign key dependencies in current schema

---

### Creating/Updating Products

**Primary Action:** Insert or update `products` table

**Required Side Effects:**

1. **Cost Validation**:
   - Ensure `cost` is positive
   - Store in smallest currency unit (cents)

2. **Timestamp Management**:
   - `created_at` set on creation
   - `updated_at` updated on modification

**Validation:**

- Non-negative cost
- Valid title

---

### Deleting Products

**Primary Action:** Delete from `products` table

**Required Side Effects:**

1. **Dependency Check** (recommended):
   - Check if product is referenced in tasks or invoices
   - Warn user or prevent deletion if in use
   - Consider soft delete instead

**No Database Cascades:**

- Products have no foreign key dependencies in current schema

---

## Cleanup & Maintenance Tasks

### Background Jobs to Run Periodically

#### 1. Clean Expired Sessions

**Frequency:** Every hour

**Action:**

```sql
DELETE FROM session
WHERE expires_at < NOW();
```

**Purpose:** Remove expired authentication sessions

---

#### 2. Clean Expired Password Reset Tokens

**Frequency:** Daily

**Action:**

```sql
DELETE FROM password_reset_token
WHERE expires_at < NOW() OR used = true;
```

**Purpose:** Remove expired or used password reset tokens

---

#### 3. Clean Expired Invite Codes

**Frequency:** Daily

**Action:**

```sql
DELETE FROM invite_codes
WHERE expires_at < NOW();
```

**Purpose:** Remove expired invite codes

---

#### 4. Clean Expired Task Edit Sessions

**Frequency:** Every 5-10 minutes

**Action:**

```sql
DELETE FROM task_edit_sessions
WHERE expires_at < NOW();
```

**Purpose:** Release locks on tasks when edit sessions expire

**Additional Logging:**

- Log which tasks were unlocked
- Consider notification to users who had sessions expired

---

#### 5. Orphaned File Detection and Cleanup

**Frequency:** Weekly (manual verification recommended)

**Action:**

1. **Database Orphans**: Files in DB without physical file:

   ```sql
   SELECT * FROM files
   WHERE NOT EXISTS (physical file at download_url);
   ```

2. **Filesystem Orphans**: Files on disk not in DB:
   - List all files in uploads directory
   - Compare against `files.download_url`
   - Delete unmatched files (with caution!)

**Purpose:** Clean up orphaned files from failed deletions

**Caution:**

- Always backup before mass deletion
- Verify files are truly orphaned
- Consider quarantine period before deletion

---

#### 6. Task History Archival (Optional)

**Frequency:** Monthly/Quarterly

**Action:**

- Move old task history (>1 year) to archive table
- Compress historical data
- Maintain recent history for quick access

**Purpose:** Improve query performance on active tasks

---

## Critical Operations Summary

### Operations Requiring Physical File Deletion

1. **Mark Task as Done**: Delete ALL associated files AND physical files (FINAL action)
2. **Mark Task as Done**: Delete task preview image if exists
3. **Delete Task**: Delete all associated file records AND physical files
4. **Delete File**: Delete file record AND physical file
5. **Delete Material**: Delete material record AND image file
6. **Delete User**: May need to handle profile pictures (if added)

### Operations Requiring Edit Session Management

1. **Edit Task**: Create/update edit session, update activity timestamp
2. **Add File to Task**: Update edit session activity
3. **Delete File from Task**: Update edit session activity
4. **Mark Task Done**: Delete edit session (task becomes read-only)
5. **Logout**: Clean up user's edit sessions

### Operations Requiring History Entries (with i18n)

**⚠️ ALL history entries must use i18n translation keys**

1. **Create Task**: `"task.history.created"`
2. **Edit Task**: Specific field changes with i18n keys and params
3. **Delete Task**: `"task.history.deleted"` (store before deletion)
4. **Add File**: `"task.history.file_uploaded"` with `{filename, size}`
5. **Delete File**: `"task.history.file_deleted"` with `{filename}`
6. **Move Task**: `"task.history.moved_to_tab"` with `{oldTabName, newTabName}`
7. **Assign Task**: `"task.history.assigned_to"` with `{userName}`
8. **Mark Task Done**: `"task.history.marked_done"` (FINAL, non-reversible)

### Permission-Based Operations (Application Level)

**Client Users:**

- Can ONLY create tasks in their own personal tab
- Can ONLY create personal tabs (for themselves)
- Cannot move tasks between tabs
- Cannot create shared tabs
- Cannot create tasks in other users' tabs

**Admin Users:**

- Can create tasks in any tab (personal or shared)
- Can create personal tabs for any user
- Can create shared tabs
- Can move tasks between any tabs
- Full system access

### Operations with Cascade Restrictions

These operations will FAIL if dependencies exist:

1. **Delete Tab Group**: Fails if group has tabs
2. **Delete Tab**: Fails if tab has tasks

**Required Action:** Move or delete dependencies first

### Operations with SET NULL Behavior

These operations leave orphaned records:

1. **Delete Client**: Tasks lose client reference (SET NULL)
2. **Delete User**: Tasks lose assignee/manager (SET NULL)

**Recommendation:** Implement warnings and reassignment flows

### Invite-Only Registration

**⚠️ CRITICAL**: User creation requires valid invite code

1. **Creating Invite Codes**: Admin-only operation
2. **Invite Code Types**:
   - Admin invites (`codeFor = 'admin'`) - carefully controlled
   - Client invites (`codeFor = 'client'`) - standard registration
3. **Registration Flow**:
   - Client users MUST link to existing client OR create new client record
   - Admin users have full access, no client linking required

### Non-Reversible Operations

**⚠️ WARNING**: These operations are FINAL

1. **Mark Task as Done**:
   - Deletes all files and images
   - Task becomes historical reference only
   - Cannot be undone
   - Show confirmation before executing

---

## Implementation Checklist

When implementing any data operation:

- [ ] Check for CASCADE DELETE constraints
- [ ] Check for RESTRICT constraints (prevent deletion)
- [ ] Check for SET NULL behavior (orphaned data)
- [ ] Implement history logging with i18n keys where applicable
- [ ] Implement edit session management for task operations
- [ ] Delete physical files when deleting file records
- [ ] Update timestamps appropriately
- [ ] Validate foreign key references
- [ ] Implement proper error handling
- [ ] Add user warnings for destructive operations
- [ ] Verify user permissions (client vs admin)
- [ ] Consider transaction boundaries (all-or-nothing)
- [ ] Log errors for debugging
- [ ] Test cascade behaviors in development environment

---

## Transaction Examples

### Mark Task as Done (FINAL, non-reversible)

```typescript
await db.transaction(async (tx) => {
	// 1. Get task details
	const taskData = await tx.query.task.findFirst({
		where: eq(task.id, taskId),
		with: { files: true }
	});

	if (!taskData) throw new Error('Task not found');

	// 2. Delete ALL physical files
	for (const f of taskData.files) {
		await deletePhysicalFile(f.downloadUrl);
	}

	// 3. Delete task preview image if exists
	if (taskData.preview) {
		await deletePhysicalFile(taskData.preview);
	}

	// 4. Add FINAL history entry (with i18n key)
	await tx.insert(taskHistory).values({
		taskId: taskId,
		userId: currentUserId,
		description: 'task.history.marked_done' // i18n key
		// Store params separately if needed for translation
	});

	// 5. Update task to done (this is FINAL)
	await tx
		.update(task)
		.set({
			isDone: true,
			preview: null // Clear preview reference
		})
		.where(eq(task.id, taskId));

	// 6. Delete edit session (task is now read-only)
	await tx.delete(taskEditSession).where(eq(taskEditSession.taskId, taskId));

	// Note: File records in DB are CASCADE deleted automatically
});
```

### Delete Task (with all side effects)

```typescript
await db.transaction(async (tx) => {
	// 1. Get all files for this task
	const files = await tx.query.file.findMany({
		where: eq(file.taskId, taskId)
	});

	// 2. Delete physical files
	for (const f of files) {
		await deletePhysicalFile(f.downloadUrl);
	}

	// 3. Add history entry before deletion (with i18n key)
	await tx.insert(taskHistory).values({
		taskId: taskId,
		userId: currentUserId,
		description: 'task.history.deleted' // i18n key
	});

	// 4. Delete task (cascades handle edit sessions, history, files DB records)
	await tx.delete(task).where(eq(task.id, taskId));
});
```

### Edit Task (with history and session management)

```typescript
await db.transaction(async (tx) => {
	// 1. Check/create edit session
	const existingSession = await tx.query.taskEditSession.findFirst({
		where: eq(taskEditSession.taskId, taskId)
	});

	if (existingSession) {
		if (existingSession.userId !== currentUserId && existingSession.expiresAt > new Date()) {
			throw new Error('Task is being edited by another user');
		}
		// Update activity
		await tx
			.update(taskEditSession)
			.set({
				lastActivityAt: new Date(),
				expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
			})
			.where(eq(taskEditSession.id, existingSession.id));
	} else {
		// Create new session
		await tx.insert(taskEditSession).values({
			taskId: taskId,
			userId: currentUserId,
			startedAt: new Date(),
			lastActivityAt: new Date(),
			expiresAt: new Date(Date.now() + 5 * 60 * 1000)
		});
	}

	// 2. Update task
	await tx.update(task).set(updatedFields).where(eq(task.id, taskId));

	// 3. Add history entries for changed fields (with i18n keys)
	for (const change of changedFields) {
		await tx.insert(taskHistory).values({
			taskId: taskId,
			userId: currentUserId,
			description: change.i18nKey // e.g., 'task.history.title_changed'
			// Store params for translation: { oldTitle: '...', newTitle: '...' }
		});
	}
});
```

### Create User with Invite Code (Client)

```typescript
await db.transaction(async (tx) => {
	// 1. Validate invite code
	const inviteCode = await tx.query.inviteCodes.findFirst({
		where: and(eq(inviteCodes.code, providedCode), eq(inviteCodes.used, false))
	});

	if (!inviteCode) throw new Error('Invalid invite code');
	if (new Date(inviteCode.expiresAt) < new Date()) {
		throw new Error('Invite code expired');
	}

	// 2. Create user
	const newUser = await tx
		.insert(user)
		.values({
			id: generateUserId(),
			email: userData.email,
			name: userData.name,
			password: await hashPassword(userData.password),
			type: inviteCode.codeFor // 'admin' or 'client'
		})
		.returning();

	// 3. Create settings
	await tx.insert(settings).values({
		id: generateSettingsId(),
		userId: newUser[0].id,
		language: userData.preferredLanguage || 'en'
	});

	// 4. If client user, link to client or create new
	if (inviteCode.codeFor === 'client') {
		if (userData.linkToExistingClient) {
			// Link to existing client
			await tx.insert(userClient).values({
				userId: newUser[0].id,
				clientId: userData.existingClientId
			});
		} else {
			// Create new client
			const newClient = await tx
				.insert(client)
				.values({
					name: userData.clientName,
					email: userData.clientEmail,
					phone: userData.clientPhone,
					type: 'BTC' // Default
				})
				.returning();

			// Link user to new client
			await tx.insert(userClient).values({
				userId: newUser[0].id,
				clientId: newClient[0].id
			});
		}
	}

	// 5. Create personal tab for user
	const newTab = await tx
		.insert(tab)
		.values({
			groupId: defaultGroupId, // Your default group
			userId: newUser[0].id, // Personal tab
			sortOrder: 0,
			color: '#FFFFFF'
		})
		.returning();

	// 6. Create tab translations
	await tx.insert(tabTranslation).values([
		{ tabId: newTab[0].id, language: 'en', name: `${userData.name}'s Tasks` },
		{ tabId: newTab[0].id, language: 'lv', name: `${userData.name} uzdevumi` }
	]);

	// 7. Mark invite code as used
	await tx.update(inviteCodes).set({ used: true }).where(eq(inviteCodes.id, inviteCode.id));
});
```

---

## Notes

- This document should be updated when schema changes occur
- All developers should review before implementing CRUD operations
- Test all cascade behaviors in development environment
- Consider implementing soft deletes for critical entities (clients, users, tasks)
- Regular backups are essential given the cascade delete behaviors
- Monitor orphaned file cleanup jobs carefully
- Implement proper error handling for all file system operations
- **All history entries must use i18n translation keys** for proper internationalization
- **Always confirm destructive operations** (mark as done, delete) with users
- **Verify user permissions** before allowing operations (client vs admin restrictions)
