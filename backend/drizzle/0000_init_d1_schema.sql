-- Migration: Create database schema for D1
-- Generated: 2025-08-28

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at INTEGER,
    nickname TEXT,
    avatar_url TEXT,
    locale TEXT,
    signin_type TEXT,
    signin_ip TEXT,
    signin_provider TEXT,
    signin_openid TEXT,
    invite_code TEXT NOT NULL DEFAULT '',
    updated_at INTEGER,
    invited_by TEXT NOT NULL DEFAULT '',
    is_affiliate INTEGER NOT NULL DEFAULT 0
);

-- Create index for email and signin_provider
CREATE INDEX IF NOT EXISTS email_provider_unique_idx ON users (email, signin_provider);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE,
    created_at INTEGER,
    user_uuid TEXT NOT NULL DEFAULT '',
    user_email TEXT NOT NULL DEFAULT '',
    amount INTEGER NOT NULL,
    interval TEXT,
    expired_at INTEGER,
    status TEXT NOT NULL,
    stripe_session_id TEXT,
    credits INTEGER NOT NULL,
    currency TEXT,
    sub_id TEXT,
    sub_interval_count INTEGER,
    sub_cycle_anchor INTEGER,
    sub_period_end INTEGER,
    sub_period_start INTEGER,
    sub_times INTEGER,
    product_id TEXT,
    product_name TEXT,
    valid_months INTEGER,
    order_detail TEXT,
    paid_at INTEGER,
    paid_email TEXT,
    paid_detail TEXT
);

-- API Keys table
CREATE TABLE IF NOT EXISTS apikeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT NOT NULL UNIQUE,
    title TEXT,
    user_uuid TEXT NOT NULL,
    created_at INTEGER,
    status TEXT
);

-- Credits table
CREATE TABLE IF NOT EXISTS credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trans_no TEXT NOT NULL UNIQUE,
    created_at INTEGER,
    user_uuid TEXT NOT NULL,
    trans_type TEXT NOT NULL,
    credits INTEGER NOT NULL,
    order_no TEXT,
    expired_at INTEGER
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    slug TEXT,
    title TEXT,
    description TEXT,
    content TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    status TEXT,
    cover_url TEXT,
    author_name TEXT,
    author_avatar_url TEXT,
    locale TEXT
);

-- Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uuid TEXT NOT NULL,
    created_at INTEGER,
    status TEXT NOT NULL DEFAULT '',
    invited_by TEXT NOT NULL,
    paid_order_no TEXT NOT NULL DEFAULT '',
    paid_amount INTEGER NOT NULL DEFAULT 0,
    reward_percent INTEGER NOT NULL DEFAULT 0,
    reward_amount INTEGER NOT NULL DEFAULT 0
);

-- Feedbacks table
CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER,
    status TEXT,
    user_uuid TEXT,
    content TEXT,
    rating INTEGER
);