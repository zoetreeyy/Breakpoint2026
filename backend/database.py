import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'tournament.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS GameState (
            id INTEGER PRIMARY KEY,
            data TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def get_state():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT data FROM GameState WHERE id = 1')
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return None

def save_state(state_dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    data_str = json.dumps(state_dict)
    
    # Check if exists
    cursor.execute('SELECT id FROM GameState WHERE id = 1')
    if cursor.fetchone():
        cursor.execute('UPDATE GameState SET data = ? WHERE id = 1', (data_str,))
    else:
        cursor.execute('INSERT INTO GameState (id, data) VALUES (1, ?)', (data_str,))
        
    conn.commit()
    conn.close()
