"""Deterministic, privacy-minimising lead routing. No scraping or AI model training."""
import re

LEX = [
    (r"судебн\w* приказ\w*", 30),
    (r"(?:отменить|отмена|оспорить)\s+(?:судебн\w*\s+)?приказ", 45),
    (r"(?:пристав\w*|фссп)\s+(?:арестовал\w*|списал\w*|взыскал\w*)", 55),
    (r"(?:арестовал\w*|заблокировал\w*)\s+(?:сч[её]т\w*|карт\w*)", 45),
    (r"(?:списал\w*|взыскал\w*)\s+ден\w*", 40),
    (r"(?:нужен|нужна|составить|подготовить)\s+(?:договор|претензи\w*|заявлени\w*)", 35),
]
REALTY = [
    (r"\b(?:куплю|ищу|ищем|хочу купить|планирую купить)\s+(?:земл\w*|участ\w*|дом\w*|коттедж\w*)", 65),
    (r"\b(?:нужен|нужна|подбираю|присматриваю)\s+(?:земл\w*|участ\w*|дом\w*)", 60),
    (r"\b(?:где|как)\s+(?:купить|выбрать|подобрать)\s+(?:земл\w*|участ\w*|дом\w*)", 55),
    (r"\b(?:хочу|планирую|собираюсь)\s+(?:строить|построить)\s+дом", 35),
]
BUYER_NEGATIVE = re.compile(r"\b(?:продаю|продам|сдаю|предлагаем|ваканси\w*|купите у нас)\b", re.I)
QUESTION = re.compile(r"\?|подскажите|посоветуйте|помогите|кто знает|как сделать|ищу|куплю|нужен|нужна", re.I)
LOCAL = re.compile(r"пенза|пензенск\w*|бессонов\w*|бессон\w*|заречн\w*|ахун\w*|лесное озеро", re.I)

def classify(message: str, group_title: str = "") -> dict | None:
    """Return route/score/keyword evidence; never include message or sender data."""
    text = re.sub(r"\s+", " ", (message or "").lower()).strip()[:3500]
    if len(text) < 12 or text.startswith(("http://", "https://")):
        return None
    if any(x in text for x in ("#реклама", "подпишитесь на", "пишите в личку, продам")):
        return None

    lex_hits = [pat for pat, _ in LEX if re.search(pat, text)]
    realty_hits = [pat for pat, _ in REALTY if re.search(pat, text)]
    lex_score = min(95, sum(weight for pat, weight in LEX if re.search(pat, text)))
    land_score = min(95, sum(weight for pat, weight in REALTY if re.search(pat, text)))
    if QUESTION.search(text):
        lex_score = min(100, lex_score + 15) if lex_score else 0
        land_score = min(100, land_score + 10) if land_score else 0
    if BUYER_NEGATIVE.search(text):
        land_score = 0
    if not lex_score and not land_score:
        return None
    if lex_score >= land_score and lex_score >= 45:
        return {"route": "lex", "score": lex_score, "signals": len(lex_hits)}
    if land_score >= 55:
        is_local = bool(LOCAL.search(text + " " + group_title))
        return {"route": "lesnoe_ozero" if is_local else "zemlibank",
                "score": land_score, "signals": len(realty_hits)}
    return None
