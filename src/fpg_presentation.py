from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image
import fitz,io,os,math
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

OUT=os.getenv('FPG_PRESENTATION_OUT','/mnt/data/Память_поколениям_презентация_ФПГ_2027.pdf')
SRC=os.getenv('FPG_ARCHITECTURE_PDF','/mnt/data/Концепция_Полишко_для_ФПГ.pdf')
for fn,p in [('F','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),('FB','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(fn,p))
W,H=960,540
NAVY=HexColor('#102336'); BLUE=HexColor('#1C3448'); GOLD=HexColor('#C9A975'); PAPER=HexColor('#F5F2EB'); GREY=HexColor('#63717B'); WHITE=HexColor('#FFFFFF'); DANGER=HexColor('#AC8457')
d=fitz.open(SRC)
os.makedirs(os.path.dirname(OUT) or '.',exist_ok=True)
os.makedirs(os.getenv('FPG_WORKDIR','/mnt/data'),exist_ok=True)

def image_page(num, crop=(0,0,0,0)):
 p=d[num-1]; pix=p.get_pixmap(matrix=fitz.Matrix(2.5,2.5),alpha=False)
 im=Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB'); w,h=im.size
 x1=int(w*crop[0]);y1=int(h*crop[1]);x2=w-int(w*crop[2]);y2=h-int(h*crop[3]);im=im.crop((x1,y1,x2,y2));im.thumbnail((1900,1180),Image.Resampling.LANCZOS)
 path=os.path.join(os.getenv('FPG_WORKDIR','/mnt/data'),f'_slide_asset_{num}.jpg');im.save(path,'JPEG',quality=83,optimize=True);return path
cache={}
for page in [2,3,4,5,6,7,8,10,11]:
 cache[page]=image_page(page,(0.02,0.025,0.02,0.03))

def fit_image(c,im,x,y,w,h,cover=True):
 iw,ih=Image.open(im).size
 ratio=max(w/iw,h/ih) if cover else min(w/iw,h/ih)
 dw,dh=iw*ratio,ih*ratio
 c.saveState();p=c.beginPath();p.rect(x,y,w,h);c.clipPath(p,stroke=0,fill=0)
 c.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh)
 c.restoreState()

def rect(c,x,y,w,h,color,r=0):
 c.setFillColor(color)
 if r:c.roundRect(x,y,w,h,r,fill=1,stroke=0)
 else:c.rect(x,y,w,h,fill=1,stroke=0)

def text(c,s,x,y,size=17,bold=False,color=NAVY):
 c.setFillColor(color);c.setFont('FB' if bold else 'F',size);c.drawString(x,y,s)

def para(c,s,x,top,w,size=14,leading=1.4,color=NAVY,bold=False):
 style=ParagraphStyle('x',fontName='FB' if bold else 'F',fontSize=size,leading=size*leading,textColor=color)
 p=Paragraph(s.replace('\n','<br/>'),style)
 pw,ph=p.wrap(w,1000);p.drawOn(c,x,top-ph);return ph

def heading(c,eyebrow,title,subtitle=None):
 text(c,eyebrow.upper(),50,490,11,True,GOLD);text(c,title,50,447,27,True,NAVY)
 if subtitle:para(c,subtitle,50,430,860,12,color=GREY)

def footer(c,num,source='Визуализации: архитектурная концепция Д. В. Полишко и И. П. Федянина'):
 text(c,source,50,22,8,False,GREY)
 text(c,f'{num:02d} / 09',870,22,9,True,GREY)

c=canvas.Canvas(OUT,pagesize=(W,H),pageCompression=1)
c.setTitle('Память поколениям | Мемориально-просветительский комплекс | ФПГ 2027')
c.setAuthor('ПРОО Лига ветеранов службы по борьбе с организованной преступностью')

# Cover
rect(c,0,0,W,H,NAVY);fit_image(c,cache[5],330,0,630,H)
rect(c,0,0,420,H,NAVY)
rect(c,52,428,4,48,GOLD)
text(c,'ПЕНЗА  ·  2027',76,456,13,True,GOLD)
text(c,'ПАМЯТЬ',51,341,42,True,WHITE);text(c,'ПОКОЛЕНИЯМ',51,283,39,True,WHITE)
para(c,'Мемориально-просветительское пространство, объединяющее память о героях, диалог поколений и цифровой архив.',52,229,335,15,1.47,WHITE)
text(c,'Проект для Фонда президентских грантов',52,53,10,False,GOLD)
c.showPage()

# 2
rect(c,0,0,W,H,PAPER);heading(c,'Концепция','Память, доступная новым поколениям')
text(c,'ЕДИНАЯ СИСТЕМА',52,392,13,True,NAVY)
items=[('01','МЕМОРИАЛЬНАЯ ПЛОЩАДКА','Постоянное место памяти, встреч и общественных мероприятий.'),('02','ЖИВЫЕ СОБЫТИЯ','Уроки мужества, встречи с ветеранами, экскурсии и памятные даты.'),('03','ЦИФРОВОЙ АРХИВ','Биографии, документальные материалы, фотографии и QR-навигация.')]
for i,(n,t,v) in enumerate(items):
 x=51+i*303;rect(c,x,135,276,216,WHITE,12);rect(c,x,329,276,4,GOLD)
 text(c,n,x+18,293,25,True,GOLD);para(c,t,x+18,255,250,13,1.18,NAVY,True);para(c,v,x+18,209,240,12,1.5,GREY)
text(c,'Не отдельный памятник и не отдельный сайт — единое место памяти и просвещения.',52,92,14,True,BLUE);footer(c,2)
c.showPage()

# 3
rect(c,0,0,W,H,PAPER);heading(c,'Основание проекта','Зачем необходима площадка')
fit_image(c,cache[7],515,108,400,282)
rect(c,45,102,438,288,WHITE,12)
para(c,'Постоянная точка памяти',65,364,380,20,1.3,NAVY,True)
para(c,'Комплекс формирует физическое пространство для работы с молодёжью, встреч поколений и проведения памятных мероприятий.',65,317,385,13,1.55,BLUE)
para(c,'QR-навигация свяжет реальные мемориальные объекты с архивными материалами в открытом цифровом доступе.',65,242,385,13,1.5,BLUE)
rect(c,62,119,5,41,GOLD)
para(c,'Строительство — этап создания пространства; общественная работа — его назначение.',79,158,359,12,1.38,NAVY,True)
footer(c,3);c.showPage()

# 4
rect(c,0,0,W,H,PAPER);heading(c,'Архитектурная концепция','Продуманная площадка в Пензе')
fit_image(c,cache[2],42,126,485,285,False)
fit_image(c,cache[6],555,231,358,180)
fit_image(c,cache[10],555,126,358,95)
para(c,'Пересечение улиц Свердлова и Калинина: единая композиция, мемориальные элементы и организованное общественное пространство.',53,111,853,11,1.4,BLUE)
footer(c,4,'Концептуальные изображения. Состав финансируемых работ определяется сметой проекта.')
c.showPage()

# 5
rect(c,0,0,W,H,NAVY)
text(c,'ПРОГРАММА РАБОТЫ',50,490,11,True,GOLD);text(c,'Что происходит на площадке',50,447,27,True,WHITE)
blocks=[('01','Встречи с ветеранами','Личные свидетельства и диалог поколений.'),('02','Уроки мужества','Совместная работа с образовательными организациями.'),('03','Экскурсии и памятные даты','Обращение к истории через реальные мемориальные объекты.'),('04','Архивные публикации','Открытый доступ к проверенным материалам о героях.')]
for i,(n,h,t) in enumerate(blocks):
 row,col=divmod(i,2);x=51+col*455;y=256-row*155;rect(c,x,y,421,133,BLUE,12);text(c,n,x+18,y+93,20,True,GOLD)
 para(c,h,x+62,y+111,340,14,1.15,WHITE,True);para(c,t,x+62,y+70,330,11.5,1.42,WHITE)
text(c,'Показатели, сроки и участники фиксируются в календарном плане заявки.',52,35,10,False,GOLD)
c.showPage()

# 6
rect(c,0,0,W,H,PAPER);heading(c,'Цифровая часть','Архив и QR-навигация')
fit_image(c,cache[11],520,123,396,293)
rect(c,48,123,445,293,WHITE,12)
para(c,'Память не ограничивается памятной датой',69,381,400,19,1.25,NAVY,True)
for j,s in enumerate(['QR-коды направляют к цифровым материалам о героях.','В архив включаются биографии, фотографии, документы и воспоминания.','Ветеранское сообщество участвует в формировании и обновлении материалов.']):
 y=286-j*65;rect(c,70,y+9,7,7,GOLD,3);para(c,s,90,y+39,365,12.1,1.45,BLUE)
footer(c,6);c.showPage()

# 7
rect(c,0,0,W,H,PAPER);heading(c,'Организация','Реализация по этапам')
steps=[('1','Подготовка','Проектные документы, согласования, исторические материалы.'),('2','Создание площадки','Работы по утверждённой смете, изготовление и монтаж элементов.'),('3','Запуск архива','QR-навигация и публикация отобранных материалов.'),('4','Работа с молодёжью','Встречи, экскурсии и последующая деятельность.')]
for i,(n,h,t) in enumerate(steps):
 x=42+i*234;rect(c,x,151,218,238,WHITE,10);rect(c,x,371,218,4,GOLD)
 text(c,n,x+17,320,27,True,GOLD);para(c,h,x+17,290,184,13.5,1.21,NAVY,True);para(c,t,x+17,241,183,11.4,1.5,GREY)
para(c,'Организация-заявитель — Пензенская региональная общественная организация «Лига ветеранов службы по борьбе с организованной преступностью».',50,104,855,11.1,1.45,BLUE)
footer(c,7);c.showPage()

# 8
rect(c,0,0,W,H,NAVY)
text(c,'ЭКОНОМИКА ПРОЕКТА',51,490,11,True,GOLD);text(c,'Сметная основа комплекса',51,447,28,True,WHITE)
for i,(n,amount,sub) in enumerate([('Бронзовая композиция','6 525 000 ₽','КП С. В. Никишина'),('Фундамент, гранит, монтаж','6 992 300 ₽','КП ИП Е. В. Якушевой — без пересечений')]):
 x=50+i*459;rect(c,x,217,438,164,BLUE,13);para(c,n,x+21,355,400,13,1.2,WHITE,True);text(c,amount,x+20,287,29,True,GOLD);para(c,sub,x+22,255,393,10.8,1.35,WHITE)
text(c,'13 517 300 ₽',52,153,33,True,WHITE)
para(c,'Подтверждённая сметная база материальной части. Расходы на команду и цифровую программу учитываются в окончательном бюджете электронной заявки.',50,135,855,11.7,1.4,WHITE)
text(c,'Софинансирование включается только при наличии реального подтверждаемого вклада.',51,44,10,False,GOLD)
c.showPage()

# 9
rect(c,0,0,W,H,PAPER)
fit_image(c,cache[4],415,0,545,H)
rect(c,0,0,490,H,PAPER)
text(c,'ДОЛГОСРОЧНЫЙ РЕЗУЛЬТАТ',49,475,11,True,GOLD)
para(c,'Место памяти.<br/>Пространство диалога.<br/>Архив поколений.',49,444,400,29,1.34,NAVY,True)
para(c,'После завершения гранта мемориальное пространство предполагается использовать для просветительской деятельности Лиги ветеранов и её партнёров.',51,270,367,13,1.5,BLUE)
para(c,'Документы о размещении и последующем содержании оформляются с уполномоченными органами в установленном порядке.',51,164,365,11,1.5,GREY)
text(c,'ПЕНЗА  ·  ПРОЕКТ «ПАМЯТЬ ПОКОЛЕНИЯМ»',51,43,10,True,GOLD)
c.showPage();c.save()
print(OUT,os.path.getsize(OUT))