"""Read-only monitoring of explicitly allowed Telegram groups, using a separate user account."""
import argparse
import asyncio
import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from telethon import TelegramClient, events, utils
from rules import classify

ROOT = Path(__file__).resolve().parent
PRIVATE = ROOT / ".local"
PRIVATE.mkdir(exist_ok=True)
DB = PRIVATE / "leads.sqlite3"
SESSION = PRIVATE / "work_account"

def db_connect():
    conn = sqlite3.connect(DB)
    conn.execute("""CREATE TABLE IF NOT EXISTS leads(
        chat_id INTEGER NOT NULL, message_id INTEGER NOT NULL,
        group_name TEXT NOT NULL, observed_utc TEXT NOT NULL,
        route TEXT NOT NULL, score INTEGER NOT NULL,
        link TEXT, status TEXT NOT NULL DEFAULT 'new',
        PRIMARY KEY(chat_id, message_id)
    )""")
    conn.execute("DELETE FROM leads WHERE observed_utc < ?",
                 ((datetime.now(timezone.utc)-timedelta(days=30)).isoformat(),))
    conn.commit()
    return conn

def capture(conn, chat_id, message_id, title, username, text, date):
    finding = classify(text, title)
    if finding is None:
        return False
    safe_user = username if username and username.replace("_","").isalnum() else None
    url = f"https://t.me/{safe_user}/{message_id}" if safe_user else None
    at = date if date and date.tzinfo else datetime.now(timezone.utc)
    cursor = conn.execute(
        "INSERT OR IGNORE INTO leads(chat_id,message_id,group_name,observed_utc,route,score,link) VALUES (?,?,?,?,?,?,?)",
        (chat_id, message_id, title[:100], at.isoformat(),
         finding["route"], finding["score"], url))
    conn.commit()
    if cursor.rowcount:
        print(json.dumps({"route":finding["route"],"score":finding["score"],
                          "chat":title[:100],"url":url,"message_id":message_id},ensure_ascii=False),flush=True)
    return bool(cursor.rowcount)

def report(conn):
    for route, total, high in conn.execute(
        "SELECT route,COUNT(*),SUM(CASE WHEN score>=75 THEN 1 ELSE 0 END) FROM leads GROUP BY route ORDER BY route"):
        print(f"{route}: {total} candidates ({high} high-priority)")
    print("Details are in the local database only. No sender usernames, phones or message texts are stored.")

async def run(args):
    api_id = os.getenv("TELEGRAM_API_ID","").strip()
    api_hash = os.getenv("TELEGRAM_API_HASH","").strip()
    if not api_id.isdigit() or not api_hash:
        raise SystemExit("Set TELEGRAM_API_ID and TELEGRAM_API_HASH privately on your device.")
    client = TelegramClient(str(SESSION), int(api_id), api_hash)
    await client.start()  # On first run: interactive Telegram OTP/2FA prompt, not in ChatGPT.
    me = await client.get_me()
    if getattr(me,"bot",False):
        raise SystemExit("Use a separate USER account, not a Bot API token.")
    if args.login:
        print("Separate work account authorized. Session kept on this device only.")
        await client.disconnect()
        return

    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    names = config.get("group_allowlist",[])
    if not isinstance(names,list) or not names or len(names)>50:
        raise SystemExit("Set 1-50 joined, approved groups in config.json.")
    targets = {}
    for name in names:
        if not isinstance(name,str) or not name.strip():
            raise SystemExit("Invalid group allowlist item.")
        chat = await client.get_entity(name.strip())
        if not (getattr(chat,"megagroup",False) or getattr(chat,"gigagroup",False)
                or chat.__class__.__name__=="Chat"):
            print(f"SKIPPED (not a discussion group): {name}")
            continue
        chat_id = utils.get_peer_id(chat)
        targets[chat_id] = (getattr(chat,"title",name),getattr(chat,"username",None),chat)
    if not targets:
        raise SystemExit("No valid joined groups. Join discussion groups with the work account first.")
    conn = db_connect()
    try:
        if args.scan:
            for chat_id,(title,username,entity) in targets.items():
                async for message in client.iter_messages(entity,limit=min(args.limit,100)):
                    if message.raw_text and not message.out:
                        capture(conn,chat_id,message.id,title,username,message.raw_text,message.date)
            report(conn)
            return
        @client.on(events.NewMessage)
        async def on_message(event):
            if event.out or not event.is_group or event.chat_id not in targets or not event.raw_text:
                return
            title, username, _ = targets[event.chat_id]
            capture(conn,event.chat_id,event.id,title,username,event.raw_text,event.date)
        print(f"READ ONLY: listening to {len(targets)} explicitly allowed groups. Ctrl+C to stop.")
        await client.run_until_disconnected()
    finally:
        conn.close()
        await client.disconnect()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--login",action="store_true",help="Authorize work account locally")
    parser.add_argument("--scan",action="store_true",help="Inspect limited recent messages once")
    parser.add_argument("--limit",type=int,default=50,help="Max 100 recent messages per group")
    parser.add_argument("--report",action="store_true",help="Show local lead counts")
    args=parser.parse_args()
    if args.report:
        conn=db_connect()
        try: report(conn)
        finally: conn.close()
    else: asyncio.run(run(args))
if __name__=="__main__":
    main()
