-- =====================================================
-- Nutri AI Backend - SQL Query Examples
-- =====================================================
-- Useful SQL queries for working with user database
-- =====================================================

-- =====================================================
-- BASIC USER SEARCH QUERIES
-- =====================================================

-- Find all users
SELECT id, username, login, is_active, created_at 
FROM users 
ORDER BY created_at DESC;

-- Find active users
SELECT id, username, login, created_at 
FROM users 
WHERE is_active = 1 
ORDER BY username;

-- Find inactive users
SELECT id, username, login, created_at 
FROM users 
WHERE is_active = 0 
ORDER BY username;

-- Find user by username
SELECT id, username, login, is_active, created_at 
FROM users 
WHERE username = 'testuser';

-- Find user by email/login
SELECT id, username, login, is_active, created_at 
FROM users 
WHERE login = 'test@example.com';

-- Search users by partial name (case-insensitive)
SELECT id, username, login, is_active 
FROM users 
WHERE LOWER(username) LIKE LOWER('%test%');

-- Search by email domain
SELECT id, username, login, is_active 
FROM users 
WHERE login LIKE '%@example.com';

-- =====================================================
-- STATISTICAL QUERIES
-- =====================================================

-- General user statistics
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
    SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_users,
    ROUND(
        (SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 
        2
    ) as active_percentage
FROM users;

-- Registration statistics by day
SELECT 
    DATE(created_at) as registration_date,
    COUNT(*) as users_registered
FROM users 
GROUP BY DATE(created_at) 
ORDER BY registration_date DESC;

-- Users registered in the last 7 days
SELECT id, username, login, created_at 
FROM users 
WHERE created_at >= datetime('now', '-7 days') 
ORDER BY created_at DESC;

-- Users registered today
SELECT id, username, login, created_at 
FROM users 
WHERE DATE(created_at) = DATE('now');

-- =====================================================
-- ADMINISTRATION QUERIES
-- =====================================================

-- Check username uniqueness
SELECT username, COUNT(*) as count 
FROM users 
GROUP BY username 
HAVING COUNT(*) > 1;

-- Check login uniqueness
SELECT login, COUNT(*) as count 
FROM users 
GROUP BY login 
HAVING COUNT(*) > 1;

-- Find users with longest usernames
SELECT username, LENGTH(username) as username_length 
FROM users 
ORDER BY username_length DESC 
LIMIT 5;

-- Find users without updates
SELECT id, username, login, created_at, updated_at 
FROM users 
WHERE updated_at IS NULL;

-- =====================================================
-- DATA UPDATE QUERIES
-- =====================================================

-- Deactivate user
-- UPDATE users SET is_active = 0 WHERE username = 'testuser';

-- Activate user
-- UPDATE users SET is_active = 1 WHERE username = 'testuser';

-- Update user email
-- UPDATE users SET login = 'newemail@example.com' WHERE username = 'testuser';

-- Mass deactivation of users by domain
-- UPDATE users SET is_active = 0 WHERE login LIKE '%@spam.com';

-- Update password (must hash first!)
-- UPDATE users 
-- SET hashed_password = '$2b$12$new_password_hash_here' 
-- WHERE username = 'testuser';

-- =====================================================
-- DELETE QUERIES (CAREFUL!)
-- =====================================================

-- Delete inactive user
-- DELETE FROM users WHERE username = 'inactiveuser' AND is_active = 0;

-- Delete users inactive for more than 30 days
-- DELETE FROM users 
-- WHERE is_active = 0 
-- AND created_at < datetime('now', '-30 days');

-- =====================================================
-- DEBUG AND DIAGNOSTIC QUERIES
-- =====================================================

-- Check table structure
PRAGMA table_info(users);

-- Check indexes
PRAGMA index_list(users);

-- Check database size
SELECT 
    name,
    COUNT(*) as row_count
FROM sqlite_master 
WHERE type = 'table' 
GROUP BY name;

-- Check database integrity
PRAGMA integrity_check;

-- Analyze space usage
PRAGMA database_list;

-- Vacuum database (free space)
-- VACUUM;

-- =====================================================
-- COMPLEX ANALYTICAL QUERIES
-- =====================================================

-- Top email domains
SELECT 
    SUBSTR(login, INSTR(login, '@') + 1) as email_domain,
    COUNT(*) as user_count
FROM users 
WHERE login LIKE '%@%'
GROUP BY email_domain 
ORDER BY user_count DESC;

-- Username length statistics
SELECT 
    MIN(LENGTH(username)) as min_length,
    MAX(LENGTH(username)) as max_length,
    AVG(LENGTH(username)) as avg_length,
    ROUND(AVG(LENGTH(username)), 2) as avg_length_rounded
FROM users;

-- Users with shortest and longest names
(
    SELECT 'Shortest' as category, username, LENGTH(username) as length 
    FROM users 
    ORDER BY LENGTH(username) ASC 
    LIMIT 3
)
UNION ALL
(
    SELECT 'Longest' as category, username, LENGTH(username) as length 
    FROM users 
    ORDER BY LENGTH(username) DESC 
    LIMIT 3
);

-- =====================================================
-- REPORTING QUERIES
-- =====================================================

-- User activity report
SELECT 
    'Active users' as status,
    COUNT(*) as count,
    GROUP_CONCAT(username, ', ') as usernames
FROM users 
WHERE is_active = 1

UNION ALL

SELECT 
    'Inactive users' as status,
    COUNT(*) as count,
    GROUP_CONCAT(username, ', ') as usernames
FROM users 
WHERE is_active = 0;

-- Monthly registration report
SELECT 
    strftime('%Y-%m', created_at) as month,
    COUNT(*) as registrations
FROM users 
GROUP BY strftime('%Y-%m', created_at) 
ORDER BY month DESC;

-- =====================================================
-- TRANSACTION EXAMPLES
-- =====================================================

-- Safe user creation with checks
/*
BEGIN TRANSACTION;

-- Check if user doesn't exist
SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM users WHERE username = 'newuser' OR login = 'new@example.com')
    THEN RAISE(ABORT, 'User already exists')
END;

-- Create user
INSERT INTO users (username, login, hashed_password, is_active) 
VALUES ('newuser', 'new@example.com', 'hashed_password', 1);

COMMIT;
*/

-- =====================================================
-- BACKUP AND RESTORE
-- =====================================================

-- Create backup of user data only
-- sqlite3 nutri_ai.db ".dump users" > users_backup.sql

-- Export to CSV
-- sqlite3 -header -csv nutri_ai.db "SELECT * FROM users;" > users_export.csv

-- =====================================================
-- LIFESTYLE PREFERENCES TABLES
-- =====================================================

-- Create lifestyle types lookup table
DROP TABLE IF EXISTS lifestyle_types;
CREATE TABLE lifestyle_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(30), -- 'activity', 'schedule', 'social', 'health'
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert lifestyle types
INSERT INTO lifestyle_types (name, description, category) VALUES
-- Activity level
('sedentary', 'Minimal physical activity, desk job', 'activity'),
('lightly-active', 'Light exercise 1-3 days/week', 'activity'),
('moderately-active', 'Moderate exercise 3-5 days/week', 'activity'),
('very-active', 'Hard exercise 6-7 days/week', 'activity'),
('extremely-active', 'Very hard exercise, physical job', 'activity'),

-- Schedule patterns
('early-bird', 'Prefers early morning meals and activities', 'schedule'),
('night-owl', 'Late evening meals and late sleep schedule', 'schedule'),
('regular-schedule', 'Consistent meal and sleep times', 'schedule'),
('irregular-schedule', 'Varying meal and sleep patterns', 'schedule'),

-- Social eating patterns
('family-oriented', 'Prefers family meals and cooking', 'social'),
('social-eater', 'Often eats out or with friends', 'social'),
('solo-eater', 'Prefers eating alone or simple meals', 'social'),
('meal-prepper', 'Likes to prepare meals in advance', 'social'),

-- Health focus
('weight-management', 'Focused on maintaining healthy weight', 'health'),
('muscle-building', 'Focused on building muscle mass', 'health'),
('endurance-training', 'Focused on cardiovascular endurance', 'health'),
('recovery-focused', 'Eating for recovery and healing', 'health'),
('stress-management', 'Using diet to manage stress levels', 'health');

-- Create user lifestyle preferences junction table
DROP TABLE IF EXISTS user_lifestyle_preferences;
CREATE TABLE user_lifestyle_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lifestyle_type_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1, -- 1=primary, 2=secondary, etc.
    intensity INTEGER DEFAULT 5, -- 1-10 scale for how strongly this applies
    notes TEXT, -- User's personal notes about this lifestyle choice
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lifestyle_type_id) REFERENCES lifestyle_types(id) ON DELETE CASCADE,
    UNIQUE(user_id, lifestyle_type_id) -- Prevent duplicate lifestyle assignments
);

-- Create indexes for performance
CREATE INDEX idx_user_lifestyle_user_id ON user_lifestyle_preferences(user_id);
CREATE INDEX idx_user_lifestyle_type_id ON user_lifestyle_preferences(lifestyle_type_id);
CREATE INDEX idx_user_lifestyle_priority ON user_lifestyle_preferences(priority);
CREATE INDEX idx_lifestyle_types_category ON lifestyle_types(category);
CREATE INDEX idx_lifestyle_types_active ON lifestyle_types(is_active);

-- Create trigger for updating user_lifestyle_preferences updated_at
CREATE TRIGGER update_user_lifestyle_updated_at 
    AFTER UPDATE ON user_lifestyle_preferences
    FOR EACH ROW
    WHEN NEW.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE user_lifestyle_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- LIFESTYLE PREFERENCES SAMPLE DATA
-- =====================================================

-- Add lifestyle preferences for test users
INSERT INTO user_lifestyle_preferences (user_id, lifestyle_type_id, priority, intensity, notes) VALUES
-- User 1 (testuser) - moderately active, meal prepper
(1, (SELECT id FROM lifestyle_types WHERE name = 'moderately-active'), 1, 7, 'Goes to gym 4 times a week'),
(1, (SELECT id FROM lifestyle_types WHERE name = 'meal-prepper'), 2, 8, 'Prepares meals on Sundays'),
(1, (SELECT id FROM lifestyle_types WHERE name = 'regular-schedule'), 3, 6, 'Tries to eat at consistent times'),
(1, (SELECT id FROM lifestyle_types WHERE name = 'weight-management'), 1, 7, 'Maintaining current weight'),

-- User 2 (demouser) - very active, social eater
(2, (SELECT id FROM lifestyle_types WHERE name = 'very-active'), 1, 9, 'Trains for competitions'),
(2, (SELECT id FROM lifestyle_types WHERE name = 'social-eater'), 2, 6, 'Often eats with workout partners'),
(2, (SELECT id FROM lifestyle_types WHERE name = 'muscle-building'), 1, 9, 'Focused on gaining muscle mass'),
(2, (SELECT id FROM lifestyle_types WHERE name = 'early-bird'), 3, 7, 'Prefers morning workouts and meals'),

-- User 3 (inactiveuser) - sedentary, simple lifestyle
(3, (SELECT id FROM lifestyle_types WHERE name = 'sedentary'), 1, 8, 'Office job, minimal exercise'),
(3, (SELECT id FROM lifestyle_types WHERE name = 'solo-eater'), 2, 7, 'Prefers simple, quick meals'),
(3, (SELECT id FROM lifestyle_types WHERE name = 'irregular-schedule'), 3, 6, 'Work schedule varies');

-- =====================================================
-- LIFESTYLE QUERIES
-- =====================================================

-- Get all lifestyle types by category
SELECT category, name, description 
FROM lifestyle_types 
WHERE is_active = 1 
ORDER BY category, name;

-- Get user's lifestyle profile
SELECT 
    u.username,
    lt.category,
    lt.name as lifestyle_type,
    ulp.priority,
    ulp.intensity,
    ulp.notes
FROM users u
JOIN user_lifestyle_preferences ulp ON u.id = ulp.user_id
JOIN lifestyle_types lt ON ulp.lifestyle_type_id = lt.id
WHERE u.username = 'testuser'
ORDER BY ulp.priority;

-- Get users with similar lifestyle patterns
SELECT 
    u1.username as user1,
    u2.username as user2,
    COUNT(*) as common_lifestyles
FROM user_lifestyle_preferences ulp1
JOIN user_lifestyle_preferences ulp2 ON ulp1.lifestyle_type_id = ulp2.lifestyle_type_id
JOIN users u1 ON ulp1.user_id = u1.id
JOIN users u2 ON ulp2.user_id = u2.id
WHERE ulp1.user_id < ulp2.user_id  -- in case to avoid duplicates
GROUP BY u1.id, u2.id
HAVING COUNT(*) >= 2  -- At least 2 common lifestyle types
ORDER BY common_lifestyles DESC;

-- Lifestyle statistics by category
SELECT 
    lt.category,
    lt.name,
    COUNT(ulp.id) as user_count,
    AVG(ulp.intensity) as avg_intensity
FROM lifestyle_types lt
LEFT JOIN user_lifestyle_preferences ulp ON lt.id = ulp.lifestyle_type_id
WHERE lt.is_active = 1
GROUP BY lt.category, lt.name
ORDER BY lt.category, user_count DESC;

-- Find users by activity level
SELECT 
    u.username,
    u.login,
    lt.name as activity_level,
    ulp.intensity
FROM users u
JOIN user_lifestyle_preferences ulp ON u.id = ulp.user_id
JOIN lifestyle_types lt ON ulp.lifestyle_type_id = lt.id
WHERE lt.category = 'activity'
ORDER BY ulp.intensity DESC;

-- Get comprehensive user profile (preferences + lifestyle)
SELECT 
    u.username,
    p.diet_type,
    p.goals,
    p.caloric_target,
    GROUP_CONCAT(
        lt.name || ' (' || ulp.intensity || '/10)',
        ', '
    ) as lifestyle_profile
FROM users u
LEFT JOIN preferences p ON u.id = p.user_id
LEFT JOIN user_lifestyle_preferences ulp ON u.id = ulp.user_id
LEFT JOIN lifestyle_types lt ON ulp.lifestyle_type_id = lt.id
WHERE u.is_active = 1
GROUP BY u.id, u.username, p.diet_type, p.goals, p.caloric_target;

-- Recommend lifestyle types for a user based on their diet goals
SELECT 
    lt.name,
    lt.description,
    lt.category,
    'Recommended for ' || p.goals as reason
FROM lifestyle_types lt, preferences p
WHERE p.user_id = 1  -- Replace with actual user ID
AND (
    (p.goals = 'lose weight' AND lt.name IN ('moderately-active', 'weight-management', 'meal-prepper')) OR
    (p.goals = 'gain weight' AND lt.name IN ('very-active', 'muscle-building', 'family-oriented')) OR
    (p.goals = 'maintain weight' AND lt.name IN ('lightly-active', 'regular-schedule', 'weight-management'))
);

-- =====================================================
-- LIFESTYLE MANAGEMENT QUERIES
-- =====================================================

-- Add lifestyle preference for user
/*
INSERT INTO user_lifestyle_preferences (user_id, lifestyle_type_id, priority, intensity, notes)
VALUES (
    1,  -- user_id
    (SELECT id FROM lifestyle_types WHERE name = 'meal-prepper'),
    2,  -- priority
    8,  -- intensity
    'Prepares meals on weekends'
);
*/

-- Update lifestyle intensity
/*
UPDATE user_lifestyle_preferences 
SET intensity = 9, notes = 'Increased workout frequency'
WHERE user_id = 1 AND lifestyle_type_id = (SELECT id FROM lifestyle_types WHERE name = 'moderately-active');
*/

-- Remove lifestyle preference
/*
DELETE FROM user_lifestyle_preferences 
WHERE user_id = 1 AND lifestyle_type_id = (SELECT id FROM lifestyle_types WHERE name = 'sedentary');
*/

-- Get lifestyle compatibility score between users
WITH user_lifestyles AS (
    SELECT 
        ulp.user_id,
        ulp.lifestyle_type_id,
        ulp.intensity,
        lt.category
    FROM user_lifestyle_preferences ulp
    JOIN lifestyle_types lt ON ulp.lifestyle_type_id = lt.id
)
SELECT 
    u1.username as user1,
    u2.username as user2,
    COUNT(CASE WHEN ABS(ul1.intensity - ul2.intensity) <= 2 THEN 1 END) as compatible_lifestyles,
    COUNT(*) as compared_lifestyles,
    ROUND(
        (COUNT(CASE WHEN ABS(ul1.intensity - ul2.intensity) <= 2 THEN 1 END) * 100.0 / COUNT(*)), 
        1
    ) as compatibility_percentage
FROM user_lifestyles ul1
JOIN user_lifestyles ul2 ON ul1.lifestyle_type_id = ul2.lifestyle_type_id
JOIN users u1 ON ul1.user_id = u1.id
JOIN users u2 ON ul2.user_id = u2.id
WHERE ul1.user_id < ul2.user_id
GROUP BY ul1.user_id, ul2.user_id, u1.username, u2.username
HAVING COUNT(*) >= 2  -- At least 2 comparable lifestyle types
ORDER BY compatibility_percentage DESC;

-- =====================================================
-- END OF FILE
-- =====================================================

-- For SQLite help:
-- .help

-- To exit sqlite3:
-- .quit