import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from rules import classify

class RouteTests(unittest.TestCase):
    def test_order(self):
        self.assertEqual(classify("Получил судебный приказ, как его отменить?")["route"],"lex")
    def test_urgent(self):
        self.assertEqual(classify("Приставы списали деньги, как вернуть?")["route"],"lex")
    def test_local_land(self):
        self.assertEqual(classify("Куплю участок под ИЖС, бюджет 2 млн. Подскажите варианты","Пенза недвижимость")["route"],"lesnoe_ozero")
    def test_nonlocal_land(self):
        self.assertEqual(classify("Ищу участок под строительство дома, где посмотреть варианты?","Москва")["route"],"zemlibank")
    def test_seller_excluded(self):
        self.assertIsNone(classify("Продаю участок в Пензе, отличная цена, звоните"))
    def test_irrelevant(self):
        self.assertIsNone(classify("Всем доброе утро и хорошего настроения!"))
if __name__=="__main__":
    unittest.main()
