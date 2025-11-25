-- Drop users table if exists (for recreation)
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    login VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_login ON users(login);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE TRIGGER update_users_updated_at 
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN NEW.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;


INSERT INTO users (username, login, hashed_password, is_active) 
VALUES (
    'testuser', 
    'test@example.com', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewFBdXpQ9gNNx.aK',  -- testpassword123
    1
);
INSERT INTO users (username, login, hashed_password, is_active) 
VALUES (
    'demouser', 
    'demo@example.com', 
    '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- demopass456
    1
);
INSERT INTO users (username, login, hashed_password, is_active) 
VALUES (
    'inactiveuser', 
    'inactive@example.com', 
    '$2b$12$E.6mz0RNl1VyqGP.dWrWAO9NbFq8PtHk4MdFdCnmYsM0v.Zj7h8ku',  -- inactive123
    0
);

PRAGMA table_info(users);
PRAGMA index_list(users);
SELECT 
    id,
    username,
    login,
    CASE WHEN is_active = 1 THEN 'Active' ELSE 'Inactive' END as status,
    created_at,
    updated_at
FROM users
ORDER BY id;

-- count users by status
SELECT 
    CASE WHEN is_active = 1 THEN 'Active' ELSE 'Inactive' END as user_status,
    COUNT(*) as count
FROM users
GROUP BY is_active;

DROP TABLE IF EXISTS preferences;
CREATE TABLE preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    liked_products TEXT,
    disliked_products TEXT,
    allergies TEXT,
    diet_type VARCHAR(100), 
    goals VARCHAR(100), 
    caloric_target INTEGER, 
    last_scanned_products TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_preferences_user_id ON preferences(user_id);
CREATE INDEX idx_preferences_diet_type ON preferences(diet_type);
CREATE INDEX idx_preferences_goals ON preferences(goals);
CREATE INDEX idx_preferences_created_at ON preferences(created_at);
CREATE TRIGGER update_preferences_updated_at 
    AFTER UPDATE ON preferences
    FOR EACH ROW
    WHEN NEW.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
INSERT INTO preferences (
    user_id, 
    liked_products, 
    disliked_products,
    allergies,
    diet_type,
    goals,
    caloric_target,
    last_scanned_products
) VALUES (
    1,
    '["apple", "banana", "chicken", "rice"]',
    '["broccoli", "fish"]',
    '["nuts", "dairy"]',
    'vegetarian',
    'lose weight',
    1800,
    '["apple", "bread", "milk"]'
);
INSERT INTO preferences (
    user_id, 
    liked_products, 
    disliked_products,
    allergies,
    diet_type,
    goals,
    caloric_target,
    last_scanned_products
) VALUES (
    2,
    '["beef", "pasta", "cheese", "tomato"]',
    '["banana", "yogurt"]',
    '["gluten"]',
    'keto',
    'gain weight',
    2500,
    '["beef", "cheese", "pizza"]'
);
INSERT INTO preferences (
    user_id, 
    liked_products, 
    disliked_products,
    allergies,
    diet_type,
    goals,
    caloric_target,
    last_scanned_products
) VALUES (
    3,
    '[]',
    '[]',
    '[]',
    'regular',
    'maintain weight',
    2000,
    '[]'
);
PRAGMA table_info(preferences);

SELECT 
    p.id as pref_id,
    u.username,
    u.login,
    p.diet_type,
    p.goals,
    p.caloric_target,
    p.liked_products,
    p.disliked_products,
    p.allergies,
    p.last_scanned_products,
    p.created_at as pref_created_at
FROM preferences p
JOIN users u ON p.user_id = u.id
ORDER BY p.id;
SELECT 
    diet_type,
    COUNT(*) as user_count
FROM preferences
WHERE diet_type IS NOT NULL
GROUP BY diet_type;
SELECT 
    goals,
    COUNT(*) as user_count
FROM preferences
WHERE goals IS NOT NULL
GROUP BY goals;

SELECT 
    ROUND(AVG(caloric_target), 0) as avg_caloric_target,
    MIN(caloric_target) as min_target,
    MAX(caloric_target) as max_target
FROM preferences
WHERE caloric_target IS NOT NULL;

DROP TABLE IF EXISTS lifestyle_types;
CREATE TABLE lifestyle_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(30), -- 'activity', 'schedule', 'social', 'health'
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS user_lifestyle_preferences;
CREATE TABLE user_lifestyle_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lifestyle_type_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1, -- 1=primary, 2=secondary, etc.
    intensity INTEGER DEFAULT 5, -- 1-10 scale for how strongly this applies
    notes TEXT, -- yser's personal notes about this lifestyle choice
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lifestyle_type_id) REFERENCES lifestyle_types(id) ON DELETE CASCADE,
    UNIQUE(user_id, lifestyle_type_id) --preevent duplicate lifestyle assignments
);
CREATE INDEX idx_user_lifestyle_user_id ON user_lifestyle_preferences(user_id);
CREATE INDEX idx_user_lifestyle_type_id ON user_lifestyle_preferences(lifestyle_type_id);
CREATE INDEX idx_user_lifestyle_priority ON user_lifestyle_preferences(priority);
CREATE INDEX idx_lifestyle_types_category ON lifestyle_types(category);
CREATE INDEX idx_lifestyle_types_active ON lifestyle_types(is_active);
CREATE TRIGGER update_user_lifestyle_updated_at 
    AFTER UPDATE ON user_lifestyle_preferences
    FOR EACH ROW
    WHEN NEW.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE user_lifestyle_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
INSERT INTO lifestyle_types (name, description, category) VALUES
-- activity level
('sedentary', 'Minimal physical activity, desk job', 'activity'),
('lightly-active', 'Light exercise 1-3 days/week', 'activity'),
('moderately-active', 'Moderate exercise 3-5 days/week', 'activity'),
('very-active', 'Hard exercise 6-7 days/week', 'activity'),
('extremely-active', 'Very hard exercise, physical job', 'activity'),
-- schedule patterns
('early-bird', 'Prefers early morning meals and activities', 'schedule'),
('night-owl', 'Late evening meals and late sleep schedule', 'schedule'),
('regular-schedule', 'Consistent meal and sleep times', 'schedule'),
('irregular-schedule', 'Varying meal and sleep patterns', 'schedule'),
-- social eating patterns
('family-oriented', 'Prefers family meals and cooking', 'social'),
('social-eater', 'Often eats out or with friends', 'social'),
('solo-eater', 'Prefers eating alone or simple meals', 'social'),
('meal-prepper', 'Likes to prepare meals in advance', 'social'),
-- health focus
('weight-management', 'Focused on maintaining healthy weight', 'health'),
('muscle-building', 'Focused on building muscle mass', 'health'),
('endurance-training', 'Focused on cardiovascular endurance', 'health'),
('recovery-focused', 'Eating for recovery and healing', 'health'),
('stress-management', 'Using diet to manage stress levels', 'health');
INSERT INTO user_lifestyle_preferences (user_id, lifestyle_type_id, priority, intensity, notes) VALUES
-- user 1 (testuser) - moderately active, meal prepper
(1, (SELECT id FROM lifestyle_types WHERE name = 'moderately-active'), 1, 7, 'Goes to gym 4 times a week'),
(1, (SELECT id FROM lifestyle_types WHERE name = 'meal-prepper'), 2, 8, 'Prepares meals on Sundays'),
(1, (SELECT id FROM lifestyle_types WHERE name = 'regular-schedule'), 3, 6, 'Tries to eat at consistent times'),
(1, (SELECT id FROM lifestyle_types WHERE name = 'weight-management'), 4, 7, 'Maintaining current weight'),
-- user 2 (demouser) - very active, social eater
(2, (SELECT id FROM lifestyle_types WHERE name = 'very-active'), 1, 9, 'Trains for competitions'),
(2, (SELECT id FROM lifestyle_types WHERE name = 'social-eater'), 2, 6, 'Often eats with workout partners'),
(2, (SELECT id FROM lifestyle_types WHERE name = 'muscle-building'), 3, 9, 'Focused on gaining muscle mass'),
(2, (SELECT id FROM lifestyle_types WHERE name = 'early-bird'), 4, 7, 'Prefers morning workouts and meals'),

-- user 3 (inactiveuser) - sedentary, simple lifestyle
(3, (SELECT id FROM lifestyle_types WHERE name = 'sedentary'), 1, 8, 'Office job, minimal exercise'),
(3, (SELECT id FROM lifestyle_types WHERE name = 'solo-eater'), 2, 7, 'Prefers simple, quick meals'),
(3, (SELECT id FROM lifestyle_types WHERE name = 'irregular-schedule'), 3, 6, 'Work schedule varies');
PRAGMA table_info(lifestyle_types);
PRAGMA table_info(user_lifestyle_preferences);
SELECT 
    category,
    name,
    description,
    COUNT(ulp.id) as user_count
FROM lifestyle_types lt
LEFT JOIN user_lifestyle_preferences ulp ON lt.id = ulp.lifestyle_type_id
GROUP BY lt.category, lt.name, lt.description
ORDER BY lt.category, lt.name;

SELECT 
    u.username,
    lt.category,
    lt.name as lifestyle_type,
    ulp.priority,
    ulp.intensity,
    ulp.notes,
    ulp.created_at
FROM users u
JOIN user_lifestyle_preferences ulp ON u.id = ulp.user_id
JOIN lifestyle_types lt ON ulp.lifestyle_type_id = lt.id
ORDER BY u.username, ulp.priority;
SELECT 
    lt.category,
    COUNT(ulp.id) as preference_count
FROM lifestyle_types lt
LEFT JOIN user_lifestyle_preferences ulp ON lt.id = ulp.lifestyle_type_id
GROUP BY lt.category
ORDER BY preference_count DESC;

SELECT 'Nutri AI database successfully initialized!' as message;
SELECT 'Users created: ' || COUNT(*) as info FROM users;
SELECT 'Preferences created: ' || COUNT(*) as pref_info FROM preferences;
SELECT 'Lifestyle types created: ' || COUNT(*) as lifestyle_types_info FROM lifestyle_types;
SELECT 'User lifestyle preferences created: ' || COUNT(*) as user_lifestyle_info FROM user_lifestyle_preferences;
SELECT 'Current date and time: ' || DATETIME('now') as timestamp;