// Drizzle ORM imports for PostgreSQL database schema definition
import {
	pgTable, // Creates a PostgreSQL table definition
	serial, // Auto-incrementing integer column
	integer, // Integer column type
	text, // Text/string column type
	timestamp, // Timestamp with timezone support
	pgEnum, // PostgreSQL enum type
	boolean, // Boolean column type
	unique, // Unique constraint
	real
} from 'drizzle-orm/pg-core';
import { check } from 'drizzle-orm/pg-core'; // Check constraint for custom validation rules
import { sql } from 'drizzle-orm/sql/sql'; // Raw SQL template for complex constraints
import { relations } from 'drizzle-orm'; // Define relationships between tables

// ==================== ENUMS ====================
// PostgreSQL enums for type-safe column values

// User role types: defines whether a user is an admin or a client
export const userRoleEnum = pgEnum('user_role', ['admin', 'client']);


// Client type classification: BTC (Business-to-Consumer) or BTB (Business-to-Business)
// Client type classification: BTC (Business-to-Consumer) or BTB (Business-to-Business)
export const clientTypeEnum = pgEnum('client_type', ['BTC', 'BTB']);

// ==================== REUSABLE TIMESTAMP FIELDS ====================
// Common timestamp columns for tracking record creation and updates
// These are spread into tables that need audit trail tracking
const timestamps = {
	// Automatically set to current time when record is created
	created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	// Automatically updated to current time whenever the record is modified
	updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()) // This callback runs on every update operation
};

// ==================== USER & AUTHENTICATION TABLES ====================

/**
 * USER TABLE
 * Stores core user account information for both admins and clients
 * This is the central authentication and identity table
 */
export const user = pgTable('user', {
	id: text('id').primaryKey(), // Unique identifier (likely UUID or custom ID)
	email: text('email').unique().notNull(), // Email must be unique across all users
	password: text('password').notNull(), // Hashed password (never store plain text!)
	name: text('name').unique().notNull(), // Username/display name, must be unique
	type: userRoleEnum('type').notNull().default('client') // User role: defaults to 'client', can be 'admin'
});

/**
 * SESSION TABLE
 * Manages active user sessions for authentication
 * Foreign Key: userId -> user.id (no explicit onDelete, so defaults to NO ACTION)
 * Behavior: If a user is deleted without cleaning up sessions first, the deletion will fail
 * This prevents orphaned sessions but requires manual session cleanup
 */
export const session = pgTable('session', {
	id: text('id').primaryKey(), // Session identifier (token)
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }), // Links to user table - CASCADE: deletes sessions if user is deleted
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull() // Session expiration time
});

export const companySettings = pgTable('company_settings', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(), // Fast Break SIA
	registrationNumber: text('registration_number').notNull(), // 54103128281
	vatNumber: text('vat_number').notNull(), // LV54103128281
	address: text('address').notNull(), // Brīvības iela 19, Ogre, Ogres nov., LV-5001
	bankName: text('bank_name').notNull(), // Citadele banka AS
	bankCode: text('bank_code').notNull(), // PARXLV22
	bankAccount: text('bank_account').notNull(), // LV44 PARX 0022 8121 1000 1
	email: text('email'),
	phone: text('phone'),
	website: text('website'),
	logo: text('logo'), // Path to company logo
	isActive: boolean('is_active').default(true).notNull(),
	...timestamps
});

// Invoices
export const invoice = pgTable('invoices', {
	id: serial('id').primaryKey(),
	invoiceNumber: text('invoice_number').notNull().unique(), // e.g., "18062025-7k"
	documentType: text('document_type')
		.$type<'invoice' | 'delivery_note' | 'invoice_delivery'>()
		.default('invoice')
		.notNull(),
	taskId: integer('task_id').references(() => task.id), clientId: integer('client_id')
		.notNull()
		.references(() => client.id),
	companyId: integer('company_id').references(() => companySettings.id), // Reference to company settings
	status: text('status')
		.$type<'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'>()
		.default('draft')
		.notNull(),
	issueDate: text('issue_date').notNull(), // Date when invoice was issued
	dueDate: text('due_date').notNull(), // Payment due date (Apmaksas termiņš)
	paymentTermDays: integer('payment_term_days').default(7), // Default 7 days
	subtotal: integer('subtotal').notNull().default(0), // Amount in cents before tax
	taxRate: real('tax_rate').default(21.0), // Tax rate percentage (21% in Latvia)
	taxAmount: integer('tax_amount').notNull().default(0), // Tax amount in cents
	total: integer('total').notNull().default(0), // Total amount in cents
	totalInWords: text('total_in_words'), // Amount in words (Summa vārdiem)
	currency: text('currency').default('EUR').notNull(), // Currency
	notes: text('notes'), // Additional notes or terms
	language: text('language').default('lv').notNull(), // Language for the invoice PDF (lv/en)
	isElectronic: boolean('is_electronic').default(true).notNull(), // Electronic document flag
	...timestamps
});

/**
 * INVITE CODES TABLE
 * Stores registration invite codes for controlling user registration
 * No foreign keys - standalone table for managing invitations
 */
export const inviteCodes = pgTable('invite_codes', {
	id: text('id').primaryKey(), // Unique identifier for the invite
	code: text('code').notNull().unique(), // The actual invite code (must be unique)
	expiresAt: text('expires_at').notNull(), // When this code expires (stored as text)
	used: boolean('used').notNull().default(false), // Whether the code has been redeemed
	codeFor: userRoleEnum('type').notNull().default('client'), // What type of user this code creates
	clientId: integer('client_id').references(() => client.id, { onDelete: 'cascade' }) // Optional: Link to specific client (if role is client)
});

/**
 * PASSWORD RESET TOKEN TABLE
 * Manages password reset tokens for the forgot password flow
 * Foreign Key: userId -> user.id with CASCADE DELETE
 * Cascade Behavior: When a user is deleted, ALL their password reset tokens are automatically deleted
 * This is safe because reset tokens are meaningless without the associated user
 */
export const passwordResetToken = pgTable('password_reset_token', {
	id: text('id').primaryKey(), // Unique identifier for the reset request
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }), // CASCADE: Deleting user removes all their reset tokens
	token: text('token').notNull().unique(), // The unique reset token sent to user
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(), // Token expiration
	used: boolean('used').notNull().default(false), // Whether the token has been used
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow() // When token was created
});

/**
 * SETTINGS TABLE
 * Stores user-specific application settings and Nextcloud integration credentials
 * Foreign Key: userId -> user.id (no explicit onDelete, defaults to NO ACTION)
 * Behavior: User deletion will fail if settings exist - settings must be deleted first
 * This could be changed to CASCADE if settings should auto-delete with user
 */
export const settings = pgTable('settings', {
	id: text('id').primaryKey(), // Unique identifier for settings record
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }), // CASCADE: User deletion removes all their settings
	language: text('language').notNull(), // User's preferred language code
	nextcloud: text('nextcloud'), // Nextcloud server URL (optional)
	nextcloud_username: text('nextcloud_username'), // Nextcloud username for integration (optional)
	nextcloud_password: text('nextcloud_password') // Nextcloud password (should be encrypted!) (optional)
});

// ==================== MATERIALS & PRODUCTS TABLES ====================

/**
 * MATERIAL TABLE
 * Inventory management for raw materials/fabrics
 * No foreign keys - independent inventory tracking
 */
export const material = pgTable('material', {
	id: serial('id').primaryKey(), // Auto-incrementing ID
	title: text('title').notNull(), // Material name/title
	article: text('article').notNull(), // Article/SKU number
	image: text('image'), // Image URL/path (optional)
	manufacturer: text('manufacturer'), // Manufacturer name (optional)
	gsm: text('gsm'), // Grams per square meter (fabric weight) (optional)
	width: text('width'), // Material width (optional)
	remaining: integer('remaining').notNull().default(0), // Quantity remaining in stock
	...timestamps // Includes created_at and updated_at
});

/**
 * PRODUCT TABLE
 * Catalog of products/services offered
 * No foreign keys - independent product catalog
 */
export const product = pgTable('products', {
	id: serial('id').primaryKey(), // Auto-incrementing ID
	title: text('title').notNull(), // Product name
	description: text('description'), // Product description (optional)
	cost: integer('cost').notNull(), // Product cost (likely in cents)
	price: integer('price').notNull().default(0), // Selling price (in cents)
	...timestamps // Includes created_at and updated_at
});

export const productTranslation = pgTable(
	'product_translations',
	{
		id: serial('id').primaryKey(), // Auto-incrementing translation ID
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }), // CASCADE: Deleting product removes its translations
		language: text('language').notNull(), // Language code: 'en', 'lv', etc.
		title: text('title').notNull(), // Translated title for this product
		description: text('description'), // Translated description
		...timestamps // Includes created_at and updated_at
	},
	(table) => [
		unique().on(table.productId, table.language) // One translation per language per product
	]
);

export const clientProductPrice = pgTable(
	'client_product_prices',
	{
		id: serial('id').primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		clientId: integer('client_id')
			.notNull()
			.references(() => client.id, { onDelete: 'cascade' }),
		price: integer('price').notNull(), // Specific price for this client (in cents)
		...timestamps
	},
	(table) => [
		unique().on(table.productId, table.clientId) // One specific price per client per product
	]
);


export const taskMaterial = pgTable('taskMaterials', {
	id: serial('id').primaryKey(),
	taskId: integer('task_id').notNull().references(() => task.id),
	materialId: integer('material_id').notNull().references(() => material.id),
	...timestamps
});

// TaskProducts
export const taskProduct = pgTable('taskProducts', {
	id: serial('id').primaryKey(),
	taskId: integer('task_id').notNull().references(() => task.id),
	productId: integer('product_id').notNull().references(() => product.id),
	count: integer('count').default(1),
	...timestamps
});


export const materialRelations = relations(material, ({ many }) => ({
	taskMaterials: many(taskMaterial)
}));

export const productRelations = relations(product, ({ many }) => ({
	taskProducts: many(taskProduct),
	translations: many(productTranslation),
	clientPrices: many(clientProductPrice)
}));

export const productTranslationRelations = relations(productTranslation, ({ one }) => ({
	product: one(product, {
		fields: [productTranslation.productId],
		references: [product.id]
	})
}));

export const clientProductPriceRelations = relations(clientProductPrice, ({ one }) => ({
	product: one(product, {
		fields: [clientProductPrice.productId],
		references: [product.id]
	}),
	client: one(client, {
		fields: [clientProductPrice.clientId],
		references: [client.id]
	})
}));


// ==================== CLIENT MANAGEMENT TABLE ====================

/**
 * CLIENT TABLE
 * Stores information about customers/clients (both B2C and B2B)
 * No foreign keys - independent client records
 *
 * Table-level constraint: Ensures at least email OR phone is provided (cannot have both null)
 * This is enforced via a CHECK constraint to maintain data integrity
 */
export const client = pgTable(
	'clients',
	{
		id: serial('id').primaryKey(), // Auto-incrementing client ID
		name: text('name').notNull(), // Client name (required)
		email: text('email'), // Email address (optional, but email OR phone required)
		phone: text('phone'), // Phone number (optional, but email OR phone required)
		description: text('description'), // Additional notes about the client
		address: text('address'), // Physical/mailing address
		vatNumber: text('vat_number'), // VAT/Tax ID number (for B2B clients)
		registrationNumber: text('registration_number'), // Business registration number
		bankName: text('bank_name'), // Bank name for payments
		bankCode: text('bank_code'), // Bank routing/SWIFT code
		bankAccount: text('bank_account'), // Bank account number
		sportType: text('sport_type'), // Client sport type: defaults to none
		type: clientTypeEnum('type').default('BTC').notNull(), // Client type: defaults to B2C
		vatRate: real('vat_rate').default(21.0).notNull(), // Custom VAT rate for this client (default 21%)
		totalOrdered: integer('total_ordered'), // Lifetime order total (optional tracking)
		...timestamps // Includes created_at and updated_at
	},
	// Table constraints defined in this callback function
	(table) => [
		// CHECK constraint: Ensures at least one contact method exists
		// SQL: (email IS NOT NULL) OR (phone IS NOT NULL)
		// This prevents creating a client with no way to contact them
		check('email_or_phone_required', sql`${table.email} IS NOT NULL OR ${table.phone} IS NOT NULL`)
	]
);

// ==================== TAB SYSTEM TABLES ====================
// The tab system provides a customizable organizational structure with multi-language support

/**
 * TAB GROUP TABLE
 * Top-level organizational categories that contain tabs
 * Example: "Projects", "Sales", "Support" groups
 * No foreign keys - root level organizational structure
 */
export const tabGroup = pgTable('tab_groups', {
	id: serial('id').primaryKey(), // Auto-incrementing group ID
	sortOrder: integer('sort_order').notNull().default(0), // Display order (lower numbers first)
	color: text('color').notNull().default('#FFFFFF'), // Visual color
	...timestamps // Includes created_at and updated_at
});

/**
 * TAB GROUP TRANSLATION TABLE
 * Stores translated names for tab groups (i18n support)
 * Foreign Key: tabGroupId -> tabGroup.id with CASCADE DELETE
 * Cascade Behavior: When a tab group is deleted, ALL its translations are automatically deleted
 * This maintains referential integrity - translations are meaningless without their parent group
 *
 * Unique Constraint: One translation per language per tab group
 */
export const tabGroupTranslation = pgTable(
	'tab_group_translations',
	{
		id: serial('id').primaryKey(), // Auto-incrementing translation ID
		tabGroupId: integer('tab_group_id')
			.notNull()
			.references(() => tabGroup.id, { onDelete: 'cascade' }), // CASCADE: Deleting group removes all translations
		language: text('language').notNull(), // Language code: 'en', 'lv', 'de', etc.
		name: text('name').notNull(), // Translated name for this group
		...timestamps // Includes created_at and updated_at
	},
	// Table constraints
	(table) => [
		// UNIQUE constraint: Prevents duplicate translations for same group+language combination
		unique().on(table.tabGroupId, table.language)
	]
);

/**
 * TAB TABLE
 * Individual tabs within groups - can be shared (groupId only) or personal (has userId)
 * Foreign Keys:
 *   1. groupId -> tabGroup.id with RESTRICT DELETE (optional for personal tabs)
 *   2. userId -> user.id with CASCADE DELETE (for personal tabs)
 *
 * Cascade Behaviors:
 *   - Deleting a tab group removes all tabs in that group (if they have groupId)
 *   - Deleting a user removes all their personal tabs
 *   - Shared tabs (userId = null) MUST have a groupId
 *   - Personal tabs (userId NOT NULL) can optionally be outside any group (groupId = null)
 *
 * CHECK Constraint: Ensures shared tabs always have a group, while personal tabs can be groupless
 */
export const tab = pgTable(
	'tabs',
	{
		id: serial('id').primaryKey(), // Auto-incrementing tab ID
		groupId: integer('group_id').references(() => tabGroup.id, { onDelete: 'restrict' }), // RESTRICT: Prevents deletion if tabs exist (nullable for personal tabs)
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }), // CASCADE: Deleting user removes their personal tabs (nullable for shared tabs)
		sortOrder: integer('sort_order').notNull().default(0), // Display order within the group
		color: text('color').notNull().default('#FFFFFF'), // Visual color coding for the tab
		...timestamps // Includes created_at and updated_at
	},
	(table) => [
		// CHECK constraint: Shared tabs (userId IS NULL) must have a groupId
		// Personal tabs (userId IS NOT NULL) can optionally have no group
		check(
			'shared_tabs_require_group',
			sql`(${table.userId} IS NOT NULL) OR (${table.groupId} IS NOT NULL)`
		)
	]
);

/**
 * USER TAB PREFERENCE TABLE
 * Stores user-specific customization for tabs (visibility, custom ordering)
 * This allows each user to arrange tabs differently without affecting others
 *
 * Foreign Keys (both with CASCADE DELETE):
 *   1. userId -> user.id
 *   2. tabId -> tab.id
 *
 * Cascade Behaviors:
 *   - Deleting a user removes all their tab preferences
 *   - Deleting a tab removes all user preferences for that tab
 *   Both are safe cascades as preferences are meaningless without their parent records
 *
 * Unique Constraint: One preference record per user per tab
 */
export const userTabPreference = pgTable(
	'user_tab_preferences',
	{
		id: serial('id').primaryKey(), // Auto-incrementing preference ID
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }), // CASCADE: Deleting user removes their preferences
		tabId: integer('tab_id')
			.notNull()
			.references(() => tab.id, { onDelete: 'cascade' }), // CASCADE: Deleting tab removes all user preferences for it
		sortOrder: integer('sort_order').notNull(), // User's custom sort order for this tab
		isVisible: boolean('is_visible').notNull().default(true), // Whether user has hidden this tab
		...timestamps // Includes created_at and updated_at
	},
	// Table constraints
	(table) => [
		// UNIQUE constraint: One preference per user per tab
		unique().on(table.userId, table.tabId)
	]
);

/**
 * TAB TRANSLATION TABLE
 * Stores translated names for tabs (i18n support)
 * Foreign Key: tabId -> tab.id with CASCADE DELETE
 * Cascade Behavior: When a tab is deleted, ALL its translations are automatically deleted
 * This is safe because translations are meaningless without their parent tab
 *
 * Unique Constraint: One translation per language per tab
 */
export const tabTranslation = pgTable(
	'tab_translations',
	{
		id: serial('id').primaryKey(), // Auto-incrementing translation ID
		tabId: integer('tab_id')
			.notNull()
			.references(() => tab.id, { onDelete: 'cascade' }), // CASCADE: Deleting tab removes all its translations
		language: text('language').notNull(), // Language code: 'en', 'lv', etc.
		name: text('name').notNull(), // Translated name for this tab
		...timestamps // Includes created_at and updated_at
	},
	// Table constraints
	(table) => [
		// UNIQUE constraint: Prevents duplicate translations for same tab+language
		unique().on(table.tabId, table.language)
	]
);

// ==================== TASK MANAGEMENT TABLES ====================

/**
 * TASK TABLE
 * Core task/project management - tracks work items with assignments and client associations
 *
 * Foreign Keys (with different deletion behaviors):
 *   1. tabId -> tab.id with RESTRICT
 *   2. clientId -> client.id with SET NULL
 *   3. assignedToUserId -> user.id with SET NULL
 *   4. managerId -> user.id (no explicit onDelete, defaults to NO ACTION)
 *
 * Cascade Behaviors:
 *   - RESTRICT on tabId: Cannot delete a tab if it has tasks - tasks must be moved or deleted first
 *     This prevents accidental data loss by protecting tasks from tab deletion
 *
 *   - SET NULL on clientId: When a client is deleted, tasks remain but clientId becomes null
 *     This preserves task history even when client records are removed
 *
 *   - SET NULL on assignedToUserId: When a user is deleted, tasks they were assigned to remain
 *     but the assignment is cleared, allowing reassignment to another user
 *
 *   - NO ACTION on managerId: User deletion fails if they are a manager on any task
 *     Manager must be changed or task deleted before user can be removed
 */
export const task = pgTable('tasks', {
	id: serial('id').primaryKey(), // Auto-incrementing task ID
	title: text('title').notNull(), // Task title/name (required)
	description: text('description'), // Detailed description (optional)
	tabId: integer('tab_id')
		.notNull()
		.references(() => tab.id, { onDelete: 'restrict' }), // RESTRICT: Cannot delete tab with tasks
	clientId: integer('client_id').references(() => client.id, { onDelete: 'set null' }), // SET NULL: Task survives client deletion
	assignedToUserId: text('assigned_to_user_id').references(() => user.id, { onDelete: 'set null' }), // SET NULL: Task survives user deletion
	createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }), // SET NULL: Task survives user deletion
	seamstress: text('seamstress'), // Name of seamstress (stored as text, not FK)
	count: integer('count'), // Quantity/count for this task (optional)
	endDate: text('end_date'), // Due date (stored as text) (optional)
	isDone: boolean('is_done').notNull().default(false), // Completion status
	isPrinted: boolean('is_printed'), // Whether task has been printed (optional)
	price: integer('price'), // Task price (likely in cents) (optional)
	preview: text('preview'), // Preview image URL/path (optional)
	...timestamps // Includes created_at and updated_at
});

// ==================== TASK HISTORY & EDITING TRACKING ====================

/**
 * TASK HISTORY TABLE
 * Tracks all changes and activities for tasks using simple text descriptions
 * Foreign Keys:
 *   - taskId -> task.id with CASCADE DELETE
 *   - userId -> user.id with SET NULL (preserve history even if user is deleted)
 *
 * Cascade Behaviors:
 *   - DELETE task: All history records are deleted (CASCADE)
 *   - DELETE user: History remains but userId becomes null (SET NULL)
 */
export const taskHistory = pgTable('task_history', {
	id: serial('id').primaryKey(), // Auto-incrementing history ID
	taskId: integer('task_id')
		.notNull()
		.references(() => task.id, { onDelete: 'cascade' }), // CASCADE: Delete history when task is deleted
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }), // Who performed the action (nullable if user deleted)
	description: text('description').notNull(), // Human-readable description of what happened
	changeType: text('change_type'), // Type of change: e.g., 'created', 'updated', 'status_change'
	changeData: text('change_data'), // JSON string containing details { field: 'status', from: 'open', to: 'closed' }
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const taskEditSession = pgTable('task_edit_sessions', {
	id: serial('id').primaryKey(), // Auto-incrementing session ID
	taskId: integer('task_id')
		.notNull()
		.references(() => task.id, { onDelete: 'cascade' }) // CASCADE: Delete sessions when task is deleted
		.unique(), // UNIQUE: Only one active edit session per task
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }), // CASCADE: Delete sessions when user is deleted
	startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(), // When editing started
	lastActivityAt: timestamp('last_activity_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.defaultNow(), // Last activity timestamp (updated on every action)
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull() // Session expires after X minutes of inactivity
});

/**
 * FILE TABLE
 * Stores file attachments associated with tasks
 * Foreign Key: taskId -> task.id (no explicit onDelete, defaults to NO ACTION)
 *
 * Cascade Behavior:
 *   - NO ACTION: Task deletion will fail if files are attached
 *   Files must be deleted first before the task can be removed
 *   This could be changed to CASCADE to auto-delete files with their task
 */
export const file = pgTable('files', {
	id: serial('id').primaryKey(), // Auto-incrementing file ID
	filename: text('filename').notNull(), // Original filename
	downloadUrl: text('download_url').notNull(), // URL or path to download the file
	size: integer('size').notNull(), // File size in bytes
	taskId: integer('task_id').references(() => task.id, { onDelete: 'cascade' }), // CASCADE: Deletes files if task is deleted
	...timestamps // Includes created_at and updated_at
});

// ==================== MANY-TO-MANY JUNCTION TABLE ====================

/**
 * USER-CLIENT JUNCTION TABLE
 * Links users to clients in a many-to-many relationship
 * Allows multiple users to be associated with a client, and users to have multiple clients
 *
 * Foreign Keys (both with CASCADE DELETE):
 *   1. userId -> user.id
 *   2. clientId -> client.id
 *
 * Cascade Behaviors:
 *   - Deleting a user removes all their client associations
 *   - Deleting a client removes all user associations to that client
 *   Both cascades are safe for junction tables - the associations become meaningless
 *   when either side is deleted
 */
export const userClient = pgTable('user_client', {
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }), // CASCADE: Deleting user removes their client links
	clientId: integer('client_id')
		.notNull()
		.references(() => client.id, { onDelete: 'cascade' }), // CASCADE: Deleting client removes user links
	...timestamps // Includes created_at and updated_at
});

// ==================== DRIZZLE ORM RELATIONS ====================
// These define the relationships for Drizzle's relational query API
// They enable type-safe queries with joins like: db.query.user.findMany({ with: { assignedTasks: true } })

/**
 * TAB GROUP RELATIONS
 * One tab group can have:
 *   - Many translations (one per language)
 *   - Many tabs (children in the group)
 */
/**
 * TAB GROUP RELATIONS
 * One tab group can have:
 *   - Many translations (one per language)
 *   - Many tabs (children in the group)
 */
export const tabGroupRelations = relations(tabGroup, ({ many }) => ({
	translations: many(tabGroupTranslation), // All language translations for this group
	tabs: many(tab) // All tabs belonging to this group
}));

/**
 * TAB GROUP TRANSLATION RELATIONS
 * Each translation belongs to:
 *   - One tab group (parent)
 */
export const tabGroupTranslationRelations = relations(tabGroupTranslation, ({ one }) => ({
	tabGroup: one(tabGroup, {
		fields: [tabGroupTranslation.tabGroupId], // Foreign key in this table
		references: [tabGroup.id] // Primary key in parent table
	})
}));

/**
 * TAB RELATIONS
 * Each tab:
 *   - Belongs to one group (parent)
 *   - May belong to one user (owner, for personal tabs) - optional
 *   - Has many translations (one per language)
 *   - Has many tasks
 *   - Has many user preferences (one per user who customized it)
 */
export const tabRelations = relations(tab, ({ one, many }) => ({
	group: one(tabGroup, {
		fields: [tab.groupId],
		references: [tabGroup.id]
	}),
	owner: one(user, {
		// Optional - only for personal tabs
		fields: [tab.userId],
		references: [user.id],
		relationName: 'personalTab' // Named relation to distinguish from other user relations
	}),
	translations: many(tabTranslation), // All language translations for this tab
	tasks: many(task), // All tasks in this tab
	userPreferences: many(userTabPreference) // All user-specific customizations for this tab
}));

/**
 * TAB TRANSLATION RELATIONS
 * Each translation belongs to:
 *   - One tab (parent)
 */
export const tabTranslationRelations = relations(tabTranslation, ({ one }) => ({
	tab: one(tab, {
		fields: [tabTranslation.tabId],
		references: [tab.id]
	})
}));

/**
 * TASK RELATIONS
 * Each task:
 *   - Belongs to one tab (required)
 *   - May be associated with one client (optional)
 *   - May be assigned to one user (optional)
 *   - May have one manager (optional)
 *   - Can have many file attachments
 */
export const taskRelations = relations(task, ({ one, many }) => ({
	tab: one(tab, {
		fields: [task.tabId],
		references: [tab.id]
	}),
	client: one(client, {
		// Optional client association
		fields: [task.clientId],
		references: [client.id]
	}),
	assignedToUser: one(user, {
		// Optional user assignment
		fields: [task.assignedToUserId],
		references: [user.id],
		relationName: 'assignedTasks' // Named relation to distinguish from managedTasks
	}),
	creator: one(user, {
		// Optional manager assignment
		fields: [task.createdById],
		references: [user.id],
		relationName: 'createdTasks' // Named relation to distinguish from assignedTasks
	}),
	files: many(file), // All files attached to this task
	history: many(taskHistory), // Add history relation
	editSession: one(taskEditSession), // Add current edit session (one-to-one)
	taskProducts: many(taskProduct),
	taskMaterials: many(taskMaterial)
}));

/**
 * TASK HISTORY RELATIONS
 */
export const taskHistoryRelations = relations(taskHistory, ({ one }) => ({
	task: one(task, {
		fields: [taskHistory.taskId],
		references: [task.id]
	}),
	user: one(user, {
		fields: [taskHistory.userId],
		references: [user.id],
		relationName: 'taskHistories'
	})
}));

/**
 * TASK EDIT SESSION RELATIONS
 */
export const taskEditSessionRelations = relations(taskEditSession, ({ one }) => ({
	task: one(task, {
		fields: [taskEditSession.taskId],
		references: [task.id]
	}),
	user: one(user, {
		fields: [taskEditSession.userId],
		references: [user.id],
		relationName: 'taskEditSessions'
	})
}));

/**
 * USER TAB PREFERENCE RELATIONS
 * Each preference:
 *   - Belongs to one user
 *   - Belongs to one tab
 */
export const userTabPreferenceRelations = relations(userTabPreference, ({ one }) => ({
	user: one(user, {
		fields: [userTabPreference.userId],
		references: [user.id]
	}),
	tab: one(tab, {
		fields: [userTabPreference.tabId],
		references: [tab.id]
	})
}));

/**
 * FILE RELATIONS
 * Each file belongs to:
 *   - One task (optional - can be null if not yet associated)
 */
export const fileRelations = relations(file, ({ one }) => ({
	task: one(task, {
		fields: [file.taskId],
		references: [task.id]
	})
}));

/**
 * CLIENT RELATIONS
 * Each client can have:
 *   - Many tasks (work orders/projects for this client)
 *   - Many user associations (through junction table)
 */
export const clientRelations = relations(client, ({ many }) => ({
	tasks: many(task), // All tasks/projects for this client
	userClients: many(userClient), // All user associations (junction table records)
	productPrices: many(clientProductPrice) // Client specific product prices
}));

/**
 * USER RELATIONS
 * Each user can have:
 *   - Many tasks assigned to them (as the worker)
 *   - Many tasks they manage (as the manager)
 *   - One personal tab (optional)
 *   - Many client associations (through junction table)
 *   - Many tab preferences (customizations)
 *
 * Note: Named relations ('assignedTasks', 'managedTasks', 'personalTab') are used
 * to distinguish multiple relationships to the same table
 */
export const userRelations = relations(user, ({ many, one }) => ({
	assignedTasks: many(task, { relationName: 'assignedTasks' }), // Tasks assigned TO this user
	createdTasks: many(task, { relationName: 'createdTasks' }), // Tasks MANAGED BY this user
	personalTab: one(tab, {
		// User's personal tab (optional)
		fields: [user.id],
		references: [tab.userId],
		relationName: 'personalTab'
	}),
	userClients: many(userClient), // All client associations (junction table records)
	tabPreferences: many(userTabPreference) // All tab customizations by this user
}));

/**
 * USER-CLIENT JUNCTION RELATIONS
 * Each junction record:
 *   - Links to one user
 *   - Links to one client
 * This enables the many-to-many relationship between users and clients
 */
export const userClientRelations = relations(userClient, ({ one }) => ({
	user: one(user, {
		fields: [userClient.userId],
		references: [user.id]
	}),
	client: one(client, {
		fields: [userClient.clientId],
		references: [client.id]
	})
}));

export const invoiceItems = pgTable('invoice_items', {
	id: serial('id').primaryKey(),
	invoiceId: integer('invoice_id')
		.notNull()
		.references(() => invoice.id, { onDelete: 'cascade' }),
	description: text('description').notNull(),
	unit: text('unit'), // e.g., 'gab.', 'st.', 'm'
	quantity: integer('quantity').notNull().default(1),
	price: integer('price').notNull(), // in cents
	total: integer('total').notNull(), // in cents
	section: text('section'), // Optional grouping/section name
	...timestamps
});

export const taskMaterialsRelations = relations(taskMaterial, ({ one }) => ({
	task: one(task, {
		fields: [taskMaterial.taskId],
		references: [task.id]
	}),
	material: one(material, {
		fields: [taskMaterial.materialId],
		references: [material.id]
	})
}));

export const taskProductRelations = relations(taskProduct, ({ one }) => ({
	task: one(task, {
		fields: [taskProduct.taskId],
		references: [task.id]
	}),
	product: one(product, {
		fields: [taskProduct.productId],
		references: [product.id]
	})
}));

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
	task: one(task, {
		fields: [invoice.taskId],
		references: [task.id]
	}),
	client: one(client, {
		fields: [invoice.clientId],
		references: [client.id]
	}),
	company: one(companySettings, {
		fields: [invoice.companyId],
		references: [companySettings.id]
	}),
	items: many(invoiceItems)
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
	invoice: one(invoice, {
		fields: [invoiceItems.invoiceId],
		references: [invoice.id]
	})
}));

// ==================== TYPE EXPORTS ====================
// TypeScript types inferred from the schema for type-safe database operations
// Usage: These types match exactly what the database will return when querying

export type Session = typeof session.$inferSelect; // Session record type
export type User = typeof user.$inferSelect; // User record type
export type Material = typeof material.$inferSelect; // Material record type
export type Product = typeof product.$inferSelect; // Product record type
export type Client = typeof client.$inferSelect; // Client record type
export type UserClient = typeof userClient.$inferSelect; // User-Client junction record type
export type UserRole = typeof user.$inferSelect.type; // 'admin' | 'client' - extracted from enum
export type ClientType = typeof client.$inferSelect.type; // 'BTC' | 'BTB' - extracted from enum
export type TabGroup = typeof tabGroup.$inferSelect; // Tab group record type
export type TabGroupTranslation = typeof tabGroupTranslation.$inferSelect; // Tab group translation record type
export type Tab = typeof tab.$inferSelect; // Tab record type
export type TabTranslation = typeof tabTranslation.$inferSelect; // Tab translation record type
export type Task = typeof task.$inferSelect; // Task record type
export type UserTabPreference = typeof userTabPreference.$inferSelect; // User tab preference record type
export type ProductTranslation = typeof productTranslation.$inferSelect; // Product translation record type
export type ClientProductPrice = typeof clientProductPrice.$inferSelect; // Client specific product price record type
