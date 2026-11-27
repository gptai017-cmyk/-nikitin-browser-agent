# ChatGPT → Nikitin Browser Agent: проверенный клиентский протокол

Проверено 27.11.2026: GitHub Issue #483, Actions run 45973239326. Подтверждены авторизация владельца, RSA-OAEP-SHA256/AES-256-GCM, запуск существующего workflow и аутентифицированная расшифровка GZIP-ответа. Это подтверждение транспорта, а не доступности каждого внешнего сайта.

## Маршрут

1. Использовать подключённый GitHub аккаунт владельца, репозиторий `gptai017-cmyk/-nikitin-browser-agent`, ветку main. Прочитать актуальные `bridge/public-key.json`, `src/secure-issue.mjs`, соответствующую часть `src/execute-dispatch.js` и `.github/workflows/bootstrap.yml`.
2. В локальной среде Python с cryptography или Node.js с node:crypto создать случайный 32-байтовый AES-ключ, случайный 12-байтовый IV и уникальный request_id. Использовать текущее системное время в миллисекундах UTC (не календарную дату из текста чата). Сохранить AES-ключ только в локальном закрытом файле с правами 0600; не отправлять его в GitHub, память ChatGPT или комментарии.
3. Запрос: JSON {request_id, ts, task}. request_id — 12–64 символа [a-z0-9_-], task — строка до 7500 символов. AES-256-GCM без AAD, отдельный 16-байтовый tag. RSA-OAEP SHA-256 (MGF1 SHA-256) оборачивает ровно 32 байта AES-ключа, используя PEM из актуального public-key.json. Envelope: JSON {version:1,key,iv,ciphertext,tag}; все бинарные поля — обычный base64. Не использовать выдуманные ciphertext или timestamps.
4. Создать Issue от владельца с точным заголовком [CHATGPT-SECURE] <request_id> и телом JSON envelope без Markdown-обёртки. Запуск должен начаться по событию issues.opened, допустимый возраст запроса 15 минут.
5. Найти Actions через GET /repos/{owner}/{repo}/actions/runs?event=issues&per_page=10, сопоставить display_title. Проверить именно job chatgpt_secure_browser, а не пропущенные альтернативные workflows. Получить комментарий SECURE_BROWSER_RESULT_V1 или encrypted artifact private-result.enc (retention 1 день).
6. Декодировать base64, AES-GCM decrypt с сохранённым ключом, reply.iv и reply.tag, затем gzip decompress при encoding=gzip, JSON parse. Проверить точное совпадение request_id. Не считать workflow success или status completed доказательством полезного результата: сверить evidence.url/title/text и output с целью.
7. При пустом DOM, MATCH_NOT_FOUND или иной ошибке сформировать новый запрос с новым ключом/IV/request_id и исправленным способом чтения. Не менять токены, Workers, webhooks, публичный/приватный ключ без установленной необходимости; не обходить CAPTCHA или ограничения доступа. При отсутствии доступа отчитаться точно. Не создавать нового бота. Не использовать TinyFish.

## Минимальный клиент (Python 3 + cryptography)

Скрипт запускается локально, отдельно от GitHub. Параметры: путь к свежему public-key.json, путь к тексту задачи и приватный каталог сессии. Передавать в GitHub только напечатанный title/body. Сохранить сессионный файл до проверки ответа.

```python
import base64, json, os, pathlib, time, uuid, gzip
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def make_request(pub_json, task, directory):
    p = pathlib.Path(directory)
    p.mkdir(mode=0o700, parents=True, exist_ok=True)
    pub = serialization.load_pem_public_key(
        json.loads(pathlib.Path(pub_json).read_text())["public_key"].encode())
    rid = "task-" + uuid.uuid4().hex
    key, iv = os.urandom(32), os.urandom(12)
    request = {"request_id":rid,"ts":int(time.time()*1000),"task":task}
    sealed = AESGCM(key).encrypt(iv,json.dumps(request,ensure_ascii=False).encode(),None)
    wrapped = pub.encrypt(key,padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),
                                           algorithm=hashes.SHA256(),label=None))
    b64 = lambda b: base64.b64encode(b).decode()
    envelope = {"version":1,"key":b64(wrapped),"iv":b64(iv),
                "ciphertext":b64(sealed[:-16]),"tag":b64(sealed[-16:])}
    with os.fdopen(os.open(p/(rid+".key"),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),"wb") as f:
        f.write(key)
    return {"title":"[CHATGPT-SECURE] "+rid,"body":json.dumps(envelope)}

def read_reply(comment, rid, directory):
    prefix = "SECURE_BROWSER_RESULT_V1\n"
    if not comment.startswith(prefix):
        raise ValueError("Unexpected reply")
    env = json.loads(comment[len(prefix):])
    key = (pathlib.Path(directory)/(rid+".key")).read_bytes()
    d = lambda s: base64.b64decode(s,validate=True)
    data = AESGCM(key).decrypt(d(env["iv"]),d(env["ciphertext"])+d(env["tag"]),None)
    if env.get("encoding") == "gzip":
        data = gzip.decompress(data)
    result = json.loads(data)
    if result.get("request_id") != rid:
        raise ValueError("Mismatched request_id")
    return result
```

Для известного DOM предпочтительны поддерживаемые операции DIRECT_JSON (inspect_page_text, inspect_controls и др.). Для неизвестного DOM сначала диагностика или обычное текстовое поручение с явным ограничением на чтение. Не публиковать персональные данные, пароли и ключи в открытом репозитории или логах.

## Контрольный результат 27.11.2026

#483: зашифрованный ответ успешно расшифрован и проверен по request_id. Целевая страница вернула пустой заголовок и тело, поэтому данные сайта не подтверждены. Повторный запрос #484 направлен через главную страницу и поиск. Статус транспорта: VERIFIED; доступность конкретной страницы: отдельно проверяется. Предыдущие #480–482: workflow success и encrypted artifact подтверждены, но это не эквивалентно фактическому чтению сайта.
