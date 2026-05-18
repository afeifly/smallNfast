import sqlite3
import sys
import time
from datetime import datetime

DB_PATH = "Logger.db"

def format_table(rows, headers):
    if not rows: return "No data found."
    widths = [len(str(h)) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            widths[i] = max(widths[i], len(str(val)))
    
    fmt = " | ".join(["{:<" + str(w) + "}" for w in widths])
    sep = "-+-".join(["-" * w for w in widths])
    
    result = [fmt.format(*headers), sep]
    for row in rows:
        result.append(fmt.format(*[str(v) if v is not None else "-" for v in row]))
    return "\n".join(result)

def get_sessions():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT ID, Descriptions, StartTime, EndTime, StartTimeStamp, EndTimeStamp, LoggerFileName FROM FileInformationTable")
    sessions = cursor.fetchall()
    conn.close()
    return sessions

def view_session(session):
    sid, desc, start, end, sts, ets, suffix = session
    print(f"\n" + "="*40)
    print(f"SESSION: {desc}")
    print(f"RANGE:   {start} -> {end}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    header_table = f"ChannelHeader_{suffix}"
    data_table = f"ChannelData_{suffix}"
    
    # Check for index
    cursor.execute(f"PRAGMA index_list('{data_table}')")
    has_index = any('timestamp' in str(idx[1]).lower() for idx in cursor.fetchall())
    if not has_index:
        print("STATUS:  [!] NO INDEX (Queries will be slow)")
    else:
        print("STATUS:  [OK] Indexed")
    print("="*40)
    
    cursor.execute(f"SELECT Item, ChannelDescription, Unit FROM {header_table} LIMIT 8")
    headers_info = cursor.fetchall()
    
    col_names = ["TimeStamp"] + [f"CH{h[0]}" for h in headers_info]
    display_headers = ["Time"] + [f"{h[1]} ({h[2]})" for h in headers_info]

    state = {
        "q_start": sts,
        "q_end": ets,
        "limit": 20,
        "page_offset": 0,
        "total_in_range": 0
    }

    def execute_query():
        count_start = time.time()
        cursor.execute(f"SELECT COUNT(*) FROM {data_table} WHERE TimeStamp BETWEEN ? AND ?", (state["q_start"], state["q_end"]))
        state["total_in_range"] = cursor.fetchone()[0]
        count_time = (time.time() - count_start) * 1000

        query_start = time.time()
        cursor.execute(f"""
            SELECT {', '.join(col_names)} FROM {data_table} 
            WHERE TimeStamp BETWEEN ? AND ? 
            ORDER BY TimeStamp ASC 
            LIMIT ? OFFSET ?
        """, (state["q_start"], state["q_end"], state["limit"], state["page_offset"]))
        rows = cursor.fetchall()
        query_time = (time.time() - query_start) * 1000

        formatted_rows = []
        for r in rows:
            ts = datetime.fromtimestamp(r[0]/1000).strftime('%H:%M:%S.%f')[:-3]
            formatted_rows.append((ts,) + r[1:])
            
        print("-" * 20)
        print(format_table(formatted_rows, display_headers))
        print("-" * 20)
        print(f"[Stats] Range Total: {state['total_in_range']} | Offset: {state['page_offset']} | Limit: {state['limit']}")
        print(f"[Stats] Query: {query_time:.2f}ms | Count: {count_time:.2f}ms")
        
        if state["page_offset"] + state["limit"] < state["total_in_range"]:
            print(f"\n-- Type 'n' for next {state['limit']} records --")

    while True:
        print("\nCommands: [all] | [last 10m] | [<start> <end>] | [n]ext | [p]rev | [back]")
        raw_cmd = input("view > ").strip().lower()
        if not raw_cmd: continue
        if raw_cmd == 'back': break
        
        parts = raw_cmd.split()
        cmd = parts[0]

        if cmd in ['n', 'next']:
            if state["page_offset"] + state["limit"] < state["total_in_range"]:
                state["page_offset"] += state["limit"]
                execute_query()
            else:
                print("End of range.")
            continue
            
        if cmd in ['p', 'prev']:
            state["page_offset"] = max(0, state["page_offset"] - state["limit"])
            execute_query()
            continue

        state["page_offset"] = 0 
        try:
            if cmd == "all":
                state["q_start"], state["q_end"] = sts, ets
                if len(parts) > 1: state["limit"] = int(parts[1])
            elif cmd == "last":
                duration = parts[1]
                val = int(duration[:-1])
                unit = duration[-1]
                delta = val * 60 * 1000 if unit == 'm' else val * 3600 * 1000
                state["q_start"] = ets - delta
                state["q_end"] = ets
                if len(parts) > 2: state["limit"] = int(parts[2])
            elif cmd.isdigit() or (cmd.startswith('-') and cmd[1:].isdigit()):
                state["q_start"] = sts + int(parts[0]) * 1000
                state["q_end"] = sts + int(parts[1]) * 1000
                if len(parts) > 2: state["limit"] = int(parts[2])
            else:
                print("Unknown command.")
                continue
            
            execute_query()
        except Exception as e:
            print(f"Error: {e}")

    conn.close()

def main():
    while True:
        try:
            sessions = get_sessions()
            print("\n=== Available Logger Sessions ===")
            for i, s in enumerate(sessions):
                print(f"[{i}] {s[1]} ({s[2]})")
            print("[a] Add All Indexes (Speed up)")
            print("[r] Remove All Indexes")
            print("[q] Quit")
            
            raw_input = input("\nSelect session or command: ").strip().lower()
            if raw_input == 'q': break
            
            if raw_input == 'a':
                conn = sqlite3.connect(DB_PATH)
                print("Optimizing all tables...")
                for s in sessions:
                    suffix = s[6]
                    print(f"  Indexing {suffix}...", end="\r")
                    conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{suffix}_ts ON ChannelData_{suffix} (TimeStamp)")
                conn.commit()
                conn.close()
                print("\nDone! All tables indexed.")
                continue

            if raw_input == 'r':
                conn = sqlite3.connect(DB_PATH)
                print("Cleaning all indexes...")
                for s in sessions:
                    suffix = s[6]
                    conn.execute(f"DROP INDEX IF EXISTS idx_{suffix}_ts")
                conn.commit()
                conn.close()
                print("Done! All indexes removed.")
                continue

            view_session(sessions[int(raw_input)])
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()
