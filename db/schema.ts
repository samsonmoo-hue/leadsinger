import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), name: text('name').notNull().unique(),
  cue: text('cue'), revision: integer('revision').notNull().default(0),
});
export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(), roomId: text('room_id').notNull().references(() => rooms.id),
  role: text('role').notNull(), expires: integer('expires').notNull(),
});
