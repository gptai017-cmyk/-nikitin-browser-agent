"""Local operator console. Run only on the Russian server via an authenticated shell.
Never expose this script through HTTP, public logs, or remote monitoring.
"""
from __future__ import annotations
import argparse
import os
import sqlite3
from pathlib import Path

def main():
    p=argparse.ArgumentParser(description="ЛЕКС · локальный просмотр заявок")
    p.add_argument("command",choices=["list","show","wrike"],help="list: последние, show: одна, wrike: по ID задачи")
    p.add_argument("key",nargs="?",help="код заявки или ID Wrike для show/wrike")
    p.add_argument("--limit",type=int,default=30)
    args=p.parse_args()
    if args.command!="list" and not args.key:
        p.error("Укажите код заявки или ID задачи")
    path=Path(os.environ.get("LAND_RU_DB_PATH","/var/lib/lex-land/requests.sqlite")).resolve()
    if not path.is_file() or path.stat().st_mode&0o077:
        raise SystemExit("Database missing or insecure permissions; refusing access")
    if args.limit<1 or args.limit>100:
        p.error("--limit must be between 1 and 100")
    db=sqlite3.connect(f"file:{path}?mode=ro",uri=True)
    db.row_factory=sqlite3.Row
    if args.command=="list":
        rows=db.execute("SELECT id,created_at,city,kind,lot_id,name,phone,wrike_task_id FROM land_requests ORDER BY created_at DESC LIMIT ?",(args.limit,)).fetchall()
    elif args.command=="show":
        rows=db.execute("SELECT * FROM land_requests WHERE upper(substr(id,1,8))=?",(args.key.upper(),)).fetchall()
    else:
        rows=db.execute("SELECT * FROM land_requests WHERE wrike_task_id=?",(args.key,)).fetchall()
    if not rows:
        print("Заявки не найдены")
    for row in rows:
        print(" | ".join(f"{k}={row[k] or '-'}" for k in row.keys() if k not in {"consent_version"}))
    db.close()

if __name__=="__main__":
    main()
