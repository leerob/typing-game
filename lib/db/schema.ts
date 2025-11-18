import { pgTable, text, timestamp, integer, boolean, check, jsonb } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

// Better Auth tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  timerDuration: integer("timerDuration").notNull().default(30), // Timer preference: 15 or 30 seconds
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

// Game data tables
export const gameResults = pgTable("gameResults", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  userId: text("userId")
    .references(() => user.id, { onDelete: "cascade" }),
  wpm: integer("wpm").notNull(),
  accuracy: integer("accuracy").notNull(),
  duration: integer("duration").notNull(), // in seconds
  textExcerpt: text("textExcerpt").notNull(),
  wpmHistory: jsonb("wpmHistory").$type<Array<{ time: number; wpm: number }>>(), // Array of {time: seconds, wpm: number}
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => ({
  // Database-level constraints to prevent invalid data
  wpmCheck: check("wpm_check", sql`${table.wpm} >= 0 AND ${table.wpm} <= 350`),
  accuracyCheck: check("accuracy_check", sql`${table.accuracy} >= 0 AND ${table.accuracy} <= 100`),
  durationCheck: check("duration_check", sql`${table.duration} >= 0 AND ${table.duration} <= 300`),
}));

export const shareableResults = pgTable("shareableResults", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  shortId: text("shortId").notNull().unique(),
  gameResultId: text("gameResultId")
    .references(() => gameResults.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// Relations
export const userRelations = relations(user, ({ many }) => ({
  gameResults: many(gameResults),
}));

export const gameResultsRelations = relations(gameResults, ({ one }) => ({
  user: one(user, {
    fields: [gameResults.userId],
    references: [user.id],
  }),
}));

