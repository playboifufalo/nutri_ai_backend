echo "🗄️  Nutri AI Backend - Database Initialization"
echo "================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/database_init.sql"
DB_FILE="$SCRIPT_DIR/nutri_ai.db"




if ! command -v sqlite3 &> /dev/null; then
    echo "sqlite3 not found,please install SQLite."
    echo "macOS: brew install sqlite"
    echo "ubuntu: sudo apt-get install sqlite3"
    exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
    echo "SQL file not found: $SQL_FILE"
    exit 1
fi

echo "📄 SQL file: $SQL_FILE"
echo "🗄️  Database: $DB_FILE"
if [ -f "$DB_FILE" ]; then
    echo "removing existing database..."
    rm "$DB_FILE"
fi

echo "executing SQL initialization..."
if sqlite3 "$DB_FILE" < "$SQL_FILE"; then
    echo "database successfully created!"
    
    # Show database information
    echo ""
    echo "database information:"
    echo "file size: $(du -h "$DB_FILE" | cut -f1)"
    
    # Display user count
    USER_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users;")
    echo "users created: $USER_COUNT"
    
    # Display user list
    echo ""
    echo "users list:"
    sqlite3 "$DB_FILE" -header -column "SELECT id, username, login, CASE WHEN is_active = 1 THEN 'Active' ELSE 'Inactive' END as status FROM users ORDER BY id;"
    
    echo ""
    echo "everything is set up!"
    echo "to start API use: uvicorn app.main:app --reload --port 8080"
    
else
    echo "there was an error during SQL initialization"
    exit 1
fi