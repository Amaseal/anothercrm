import { sqliteTable as table } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';
import { type InferSelectModel } from 'drizzle-orm';

export type User = InferSelectModel<typeof user>;
export type Client = InferSelectModel<typeof client>;
export type Product = InferSelectModel<typeof product>;
export type Session = InferSelectModel<typeof session>;
export type Material = InferSelectModel<typeof material>;
export type Task = InferSelectModel<typeof task>;
export type Tab = InferSelectModel<typeof tab>;
export type TaskMaterial = InferSelectModel<typeof taskMaterial>;
export type TaskProduct = InferSelectModel<typeof taskProduct>;
export type File = InferSelectModel<typeof file>;
export type Notification = InferSelectModel<typeof notification>;
export type DailyWord = InferSelectModel<typeof dailyWord>;
export type GameStats = InferSelectModel<typeof gameStats>;
export type GameAttempt = InferSelectModel<typeof gameAttempts>;

const timestamps = {
	updated_at: t.int({ mode: 'timestamp' }).$onUpdate(() => new Date()),
	created_at: t.int({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
};

export const user = table('users', {
	id: t.text('id').primaryKey(),
	email: t.text('email').notNull(),
	password: t.text('password').notNull(),
	name: t.text('name'),
	nextcloud: t.text('nextcloud'),
	nextcloud_username: t.text('nextcloud_username'),
	nextcloud_password: t.text('nextcloud_password'), // App password for security
	...timestamps
});

export const session = table('session', {
	id: t.text('id').primaryKey(),
	userId: t
		.text('user_id')
		.notNull()
		.references(() => user.id),
	expiresAt: t
		.integer('expires_at', {
			mode: 'timestamp'
		})
		.notNull()
});

export const client = table('clients', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	name: t.text('name').notNull(),
	email: t.text('email'),
	phone: t.text('phone'),
	description: t.text('description'),
	address: t.text('address'), // Added address field to match the desired output
	type: t.text('type').$type<'BTC' | 'BTB'>().default('BTC').notNull(),
	totalOrdered: t.int('total_ordered'),
	...timestamps
});

// Materials
export const material = table('materials', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	title: t.text('title').notNull(),
	article: t.text('article').notNull(),
	image: t.text('image'),
	manufacturer: t.text('manufacturer'),
	gsm: t.int('gsm'),
	width: t.int('width'),
	remaining: t.int('remaining').notNull().default(0),
	...timestamps
});

export const product = table('products', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	title: t.text('title').notNull(),
	description: t.text('description'),
	cost: t.int('cost').notNull(),
	...timestamps
});

export const tab = table('tabs', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	title: t.text('title').notNull(),
	color: t.text('color').notNull(),
	order: t.int('order').default(0).notNull(),
	isProtected: t.integer('is_protected', { mode: 'boolean' }).default(false).notNull(), // Prevent deletion if true
	...timestamps
});

export const notification = table('notification', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	message: t.text('message').notNull(),
	userId: t
		.text('user_id')
		.notNull()
		.references(() => user.id),
	taskId: t
		.int('task_id')
		.references(() => task.id),
	isRead: t.integer('is_read', { mode: 'boolean' }).default(false).notNull(),
	...timestamps
});

export const inviteCodes = table('invite_codes', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	code: t.text('code').notNull().unique(),
	expiresAt: t.text('expires_at').notNull(),
	used: t.integer('used', { mode: 'boolean' }).notNull().default(false)
});

// Game tables for Wordle-like game
export const dailyWord = table('daily_words', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	word: t.text('word').notNull(),
	date: t.text('date').notNull().unique(), // YYYY-MM-DD format
	...timestamps
});

export const gameStats = table('game_stats', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	userId: t
		.text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	totalGames: t.int('total_games').notNull().default(0),
	totalWins: t.int('total_wins').notNull().default(0),
	averageGuesses: t.real('average_guesses').default(0),
	averageTime: t.real('average_time').default(0), // in seconds
	bestTime: t.int('best_time'), // best time in seconds
	currentStreak: t.int('current_streak').notNull().default(0),
	maxStreak: t.int('max_streak').notNull().default(0),
	...timestamps
});

export const gameAttempts = table('game_attempts', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	userId: t
		.text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	dailyWordId: t
		.int('daily_word_id')
		.notNull()
		.references(() => dailyWord.id),
	guesses: t.text('guesses').notNull(), // JSON array of guess attempts
	solved: t.integer('solved', { mode: 'boolean' }).notNull().default(false),
	guessCount: t.int('guess_count').notNull(),
	timeSpent: t.int('time_spent'), // time in seconds
	...timestamps
});

// Files - Simple file storage for tasks
export const file = table('files', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	filename: t.text('filename').notNull(), // Filename as uploaded by user
	downloadUrl: t.text('download_url').notNull(), // URL to access/download the file
	size: t.int('size').notNull(), // File size in bytes for display purposes
	taskId: t.int('task_id').references(() => task.id), // Direct reference to the task, now nullable for initial upload
	...timestamps
});

// TaskMaterials (junction table for task-material many-to-many)
export const taskMaterial = table('taskMaterials', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	taskId: t
		.int('task_id')
		.notNull()
		.references(() => task.id),
	materialId: t
		.int('material_id')
		.notNull()
		.references(() => material.id),
	...timestamps
});

// TaskProducts
export const taskProduct = table('taskProducts', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	taskId: t
		.int('task_id')
		.notNull()
		.references(() => task.id),
	productId: t
		.int('product_id')
		.notNull()
		.references(() => product.id),
	count: t.int('count').default(1),
	...timestamps
});

// Tasks
export const task = table('tasks', {
	id: t.int('id').primaryKey({ autoIncrement: true }),
	title: t.text('title').notNull(),
	description: t.text('description'), // Can contain JSON for rich text if needed
	tabId: t.int('tab').references(() => tab.id),
	clientId: t.int('client').references(() => client.id),
	managerId: t.text('manager').references(() => user.id),
	seamstress: t.text('seamstress'), // Optional seamstress field
	responsiblePersonId: t.text('responsible_person').references(() => user.id),
	count: t.int('count'),
	endDate: t.text('end_date'),
	isPrinted: t.integer('is_printed', { mode: 'boolean' }), // boolean as integer
	price: t.int('price'),
	preview: t.text('preview'),
	...timestamps
});

// Relations for Task
export const taskRelations = relations(task, ({ one, many }) => ({
	client: one(client, {
		fields: [task.clientId],
		references: [client.id]
	}),
	manager: one(user, {
		fields: [task.managerId],
		references: [user.id],
		relationName: 'managedTasks'
	}),
	responsiblePerson: one(user, {
		fields: [task.responsiblePersonId],
		references: [user.id],
		relationName: 'responsibleTasks'
	}),	materials: many(taskMaterial),
	taskProducts: many(taskProduct),
	files: many(file, { relationName: 'taskFiles' }), // Add files relation
	notifications: many(notification),
	tab: one(tab, {
		fields: [task.tabId],
		references: [tab.id]
	})
}));

// Relations for TaskMaterial
export const taskMaterialRelations = relations(taskMaterial, ({ one }) => ({
	task: one(task, {
		fields: [taskMaterial.taskId],
		references: [task.id]
	}),
	material: one(material, {
		fields: [taskMaterial.materialId],
		references: [material.id]
	})
}));

// Relations for TaskProduct
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

export const userRelations = relations(user, ({ many, one }) => ({
	managedTasks: many(task, { relationName: 'managedTasks' }),
	responsibleTasks: many(task, { relationName: 'responsibleTasks' }),
	notifications: many(notification),
	gameStats: one(gameStats),
	gameAttempts: many(gameAttempts)
}));

// Relations for Tab
export const tabRelations = relations(tab, ({ many, one }) => ({
	tasks: many(task)
}));

export const materialRelations = relations(material, ({ many }) => ({
	taskMaterials: many(taskMaterial)
}));

export const productRelations = relations(product, ({ many }) => ({
	taskProducts: many(taskProduct)
}));

export const clientRelations = relations(client, ({ many }) => ({
	tasks: many(task)
}));

// Notification relations
export const notificationRelations = relations(notification, ({ one }) => ({
	user: one(user, {
		fields: [notification.userId],
		references: [user.id]
	}),
	task: one(task, {
		fields: [notification.taskId],
		references: [task.id]
	})
}));

// File relations
export const fileRelations = relations(file, ({ one }) => ({
	task: one(task, {
		fields: [file.taskId],
		references: [task.id],
		relationName: 'taskFiles'
	})
}));

// Relations for Invite Code

// Game relations
export const dailyWordRelations = relations(dailyWord, ({ many }) => ({
	attempts: many(gameAttempts)
}));

export const gameStatsRelations = relations(gameStats, ({ one }) => ({
	user: one(user, {
		fields: [gameStats.userId],
		references: [user.id]
	})
}));

export const gameAttemptsRelations = relations(gameAttempts, ({ one }) => ({
	user: one(user, {
		fields: [gameAttempts.userId],
		references: [user.id]
	}),
	dailyWord: one(dailyWord, {
		fields: [gameAttempts.dailyWordId],
		references: [dailyWord.id]
	})
}));
