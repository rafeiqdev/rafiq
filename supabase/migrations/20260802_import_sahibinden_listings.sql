-- Import 20 sahibinden.com listings scraped 2026-08-01 into public.listings.
-- Source photos are hotlinked from sahibinden's own CDN (i0.shbdn.com /
-- image5.sahibinden.com) — they were NOT re-hosted, so treat them as
-- temporary: replace with your own photos per listing from /admin when you
-- can, since a third-party CDN link can disappear or block hotlinking at any
-- time, and republishing another site's listing photos as your own carries a
-- ToS/copyright risk.
--
-- priceUsd was converted from TRY at an approximate rate of 41 TRY/USD —
-- correct individual prices from /admin if you have exact figures.
--
-- Idempotent column guards first, in case this database has not run the
-- earlier real-estate-revamp / description-bathrooms-furnished-images
-- migrations yet.

alter table public.listings
  add column if not exists description   text,
  add column if not exists bathrooms     int,
  add column if not exists furnished     boolean not null default false,
  add column if not exists images        text[] not null default '{}',
  add column if not exists listing_type  text not null default 'sale',
  add column if not exists floor         int,
  add column if not exists total_floors  int,
  add column if not exists build_status  text,
  add column if not exists yield_pct     numeric,
  add column if not exists amenities     text[] not null default '{}',
  add column if not exists updated_at    timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'listings_listing_type_chk') then
    alter table public.listings
      add constraint listings_listing_type_chk
      check (listing_type in ('sale', 'rent', 'commercial'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listings_build_status_chk') then
    alter table public.listings
      add constraint listings_build_status_chk
      check (build_status is null or build_status in ('ready', 'under-construction'));
  end if;
end $$;

insert into public.listings
  (district, rooms, m2, price_usd, citizenship,
   image, sort,
   description, bathrooms, furnished, images,
   listing_type, floor, total_floors, build_status, amenities, updated_at)
values
  (
    'Kağıthane', '4+1', 172, 117073, false,
    'https://i0.shbdn.com/photos/87/84/32/big_1331878432xwr.jpg', 5000,
    'FIRSAT !!! KAĞITHANE TALATPAŞA 4+1 Geniş Daire 170 m²

KAĞITHANE Örnektepe Bölgesinde 4+1 Geniş Daire – 170 m²

 
 ✨ Çift Cepheli – Yatırıma ve Oturuma Uygun
 
 
 Konum: Beyoğlu Örnektepede, merkezi lokasyonda
 
 Büyüklük: 4+1, net 170 m² geniş kullanım alanı
 
 
 
  Lokasyon Avantajları
 
 
 
 
 Ulaşım: Metro, metrobüs, Marmaray, tramvay ve deniz otobüsüne kolay erişim.
 
 Sağlık: Cemil Taşçıoğlu Hastanesi 5 dakika mesafede.
 
 Adalet & İş: Çağlayan Adliyesi 5 dakika uzaklıkta.
 
 Merkezler: Taksim, Eminönü, Şişli, Mecidiyeköy gibi iş ve sosyal merkezlere yakın.
 
 
  Yakın Restoran ve Kafeler
 
 
 Çınar Altı Et ve Uykuluk (Sütlüce, 206 m) – Geleneksel et lezzetleri, yüksek puanlı.
 
 Sahil Restoran (Örnektepe, 448 m) – Haliç manzaralı, balık ve deniz ürünleri.
 
 Kral Lahmacun (Kağıthane, 319 m) – Lahmacun ve kebap çeşitleri.
 
 Es Cafe (Örnektepe, 206 m) – Kahve ve tatlı için popüler bir durak.
 
 Adana Dürüm Evi (Kağıthane, 492 m) – Uygun fiyatlı dürüm seçenekleri.
 
 
  Kültürel ve Sosyal Mekanlar
 
 
 Pera Bölgesi (Beyoğlu) – Sanat galerileri, tarihi binalar, caz barları.
 
 Mikla Restaurant (Pera) – İstanbul’un en prestijli fine-dining restoranlarından biri.
 
 Soho House İstanbul (Pera) – Üyelik bazlı sosyal kulüp, restoran ve etkinlik alanı.
 
 Çiçek Pasajı (İstiklal Caddesi, 261 m) – Tarihi meyhaneler ve restoranlar.
 
 Frej Coffee & Art House (Şişhane) – Sanat ve kahve kültürünü birleştiren yaşam alanı.
 
 
 ️ Günlük Yaşam ve Alışveriş
 İstiklal Caddesi (160 m) – Mağazalar, kafeler, eğlence mekânları.
 
 
 Galatasaray Lisesi ve çevresi (276 m) – Tarihi dokusu ve sosyal yaşamıyla öne çıkan bölge.
 
 Rumeli Han & Tokatlıyan Oteli (200–250 m) – Tarihi yapılar, butik mağazalar.
 
 
  Profesyonel İlan Tasarımı Önerisi
 Metni şu şekilde afiş veya katalogda sunabilirsiniz:
 
 
 Başlık: “Beyoğlu Örnektepe’de 4+1 Geniş Daire – 170 m²”
 
 Alt Başlık: “Çift Cepheli – Metroya 2 Dakika – Merkezi Lokasyon”
 
 Görsel: Yeşilbahçe Gayrimenkul kurumsal yeşil arka plan, Haliç manzaralı fotoğraf.
 
 Yan Bilgi Kutuları:
 
 
 Ulaşım ikonları (metro, metrobüs, Marmaray, tramvay, deniz otobüsü)
 
 Restoran & sosyal yaşam ikonları (kahve, yemek, alışveriş, kültür)
 
 Sağlık & adalet ikonları (hastane, adliye)', 2, false, ARRAY['https://i0.shbdn.com/photos/87/84/32/big_1331878432xwr.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432c6x.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432018.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432oh3.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_133187843279c.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432uyj.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432zts.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432de5.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_13318784323x3.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_133187843208m.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432mgd.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432z4m.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_13318784321ar.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432r9i.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432pxk.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432x2g.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_13318784324jt.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_13318784326ti.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432cw2.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_13318784327no.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_13318784321zj.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_13318784322iv.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432jhu.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432ee2.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432gok.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_13318784326ab.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432hlo.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432s8b.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432hmt.jpg']::text[],
    'sale', 5, 5, 'ready', ARRAY['parking']::text[], '2026-08-01T21:38:24Z'
  ),
  (
    'Bağcılar', '2+1', 65, 140244, false,
    'https://i0.shbdn.com/photos/12/30/98/big_1300123098vi5.jpg', 5010,
    'BAĞCILAR EXPRESS 24 REZİDANS SATILIK CADDE CEPHE 2+1 DAİRE

Detaylı bilgi ver randevu için lütfen iletişime geçiniz', 1, false, ARRAY['https://i0.shbdn.com/photos/12/30/98/big_1300123098vi5.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230981i2.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098gmg.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098796.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098nh0.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098lps.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098vl7.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098t39.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098vwv.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098c73.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230982ec.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230986kp.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098v3i.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_130012309831l.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098p3z.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098cty.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098ae4.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098yzi.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098ykv.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_130012309897u.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098z6o.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098c0h.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098ecd.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098p5r.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098e42.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098mbj.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098iko.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098e0y.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098eva.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098efm.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098b3c.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230985w1.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230989tm.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098vci.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230989pj.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230987c5.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098poz.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098dz0.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098bz7.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230988e1.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230984mm.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098n7j.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098wtc.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098x7f.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098vlg.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230982bu.jpg']::text[],
    'sale', 5, 24, 'ready', ARRAY['parking', 'elevator']::text[], '2026-08-01T21:37:17Z'
  ),
  (
    'Sultangazi', '2+1', 95, 90220, false,
    'https://i0.shbdn.com/photos/68/66/18/big_1316686618cle.jpg', 5020,
    'ÖZGÜR İNŞAAT''TAN ESENTEPE MAH''DE 2+1 105M2 MÜKEMMEL BAHÇE KATI

***ÖZGÜR GAYRİMENKUL***
SİZİ EV SAHİBİ YAPAR...
!!!!KİRA ÖDER GİBİ DAİRE SAHİBİ OLUN!!!!!
EN UYGUN FAİZ ORANIYLA KREDİNİZİ BİZ 
ÇIKARTIYORUZ
✧“SİZİN YERİNİZ”✧

2+1 105M2 
BAHÇE KATI DAİRE
 ULAŞIM 

KREDİYE UYGUN
 %100 KREDİ İMKANI
 SEMT PAZARI, TRAMVAY, OKUL, HASTANE, MARKET YÜRÜME MESAFESİ   

 OFİSİMİZ HAFTANIN 7 GÜNÜ SİZ DEĞERLİ MÜŞTERİLERİMİZE HİZMET VERMEKTEDİR.
KREDİNİZİ BİZ ÇIKARTIYORUZ FİRMAMIZ TARAFINDAN TAKİP EDİLİP EN HIZLI BİR ŞEKİLDE SONUÇLANDIRILIR.
 TAPU VE KREDİ İŞLEMLERİNİZ İÇİN BİZE SADECE BİR GÜNÜNÜZÜ AYIRMANIZ YETERLİDİR.  
Sizleri satış ofisimize BEKLİYORUZ
EVİNİZİN  ÖZGÜR İNŞAAT''TA SAKLI
                       ...SİZLERE EN İYİSİNİ SUNMAK İÇİN BURADAYIZ....

İRTİBAT TELEFONLARIMIZ

 
 Merkez Ofis:0212 619 34 66
 YUSUF ÖZGÜR: 0536 795 80 98
 SALİH ÖZGÜR: 0545-619-34-66
 İSMETPAŞA MAH ORDU CAD NO:270-272A
 SULTANGAZİ/İST', 1, false, ARRAY['https://i0.shbdn.com/photos/68/66/18/big_1316686618cle.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618053.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_131668661846e.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618xr4.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618rlc.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618yo6.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618ucn.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618np1.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618671.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_131668661855b.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618ng4.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618vo7.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_131668661872o.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_13166866181k4.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_13166866180ug.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618o3f.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618k32.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_131668661857t.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618rha.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618bto.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618wm2.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618du0.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618akf.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618kyj.jpg']::text[],
    'sale', NULL, 5, 'ready', ARRAY['elevator']::text[], '2026-08-01T21:36:10Z'
  ),
  (
    'Güngören', '5+1', 145, 193902, false,
    'https://i0.shbdn.com/photos/41/26/30/big_1324412630t0u.jpg', 5030,
    'SAHİBİNDEN GÜNEŞTEPE MAH.DE 182 M² 5+1 TERASLI DUBLEKS

SAHİBİNDEN GÜNGÖREN GÜNEŞTEPE NEVBAHAR SOKAK’TA 182 M² 5+1 TERASLI DUBLEKS DAİRE
İstanbul’un merkezi ve ulaşım avantajı yüksek bölgelerinden Güngören Güneştepe Mahallesi’nde, Nevbahar Sokak üzerinde yer alan 5+1 dubleks dairemiz sahibinden satılıktır.
15 yıllık, toplam 4 katlı binanın son iki katında konumlanan dairemiz; 182 m² brüt, yaklaşık 145 m² net kullanım alanı, ferah oda dağılımı, iki ayrı mutfak alanı ve terasıyla geniş aileler için oldukça kullanışlı bir yaşam alanı sunmaktadır.
Daire Genel Özellikleri
Dairemiz 5+1 plan yapısına sahiptir. Alt katta geniş salon, mutfak, odalar, banyo ve çamaşır alanı olarak da kullanılan alaturka WC bulunmaktadır. Üst katta ise odalar, ikinci mutfak bölümü, banyo, çok amaçlı kullanım alanı ve teras yer almaktadır.
Bu plan yapısı sayesinde daire, kalabalık aileler için rahat bir yaşam sunarken; üst katın ayrı bir yaşam alanı, misafir bölümü, çalışma alanı veya genç odası olarak değerlendirilmesine de imkan tanımaktadır.
Geniş ve Kullanışlı Yaşam Alanı
Dairenin alt katında yer alan geniş salon, aile yaşamı ve misafir ağırlamak için ideal bir kullanım alanı sunar. Oda sayısının fazla olması, her birey için ayrı alan yaratma avantajı sağlar. Gün ışığı alan odaları, kullanışlı iç merdiveni ve fonksiyonel kat dağılımı ile klasik dairelerden ayrılan ferah bir yaşam imkanı sunmaktadır.
İki Ayrı Mutfak Avantajı
Dairede alt katta ana mutfak, üst katta ise ikinci mutfak alanı bulunmaktadır. Bu özellik, dubleks kullanımını çok daha pratik hale getirir. Üst katın ayrı değerlendirilmesi, misafir ağırlama, kalabalık aile yaşamı veya bağımsız kullanım ihtiyacı olan aileler için önemli bir avantaj sağlar.
Konum ve Ulaşım Avantajları
Dairemiz, Güngören Güneştepe Mahallesi’nin merkezi noktalarından biri olan Nevbahar Sokak’ta yer almaktadır.
T1 Kabataş–Bağcılar tramvay hattı üzerindeki Yavuz Selim ve Güneştepe tramvay duraklarına yürüme mesafesindedir. Bu sayede Bağcılar, Güngören, Merter, Zeytinburnu, Cevizlibağ, Topkapı, Aksaray, Laleli, Beyazıt, Eminönü ve Kabataş yönlerine toplu ulaşımla kolay erişim sağlanabilmektedir.
Otobüs ve minibüs/dolmuş duraklarına kısa yürüme mesafesinde olması sayesinde şehir içi ulaşım oldukça pratiktir.
Okullara ve Günlük İhtiyaç Noktalarına Yakınlık
Daire; çevredeki ilkokul, ortaokul, lise ve özel anaokulu seçeneklerine yakın konumdadır. Okul çağında çocuğu olan aileler için avantajlı bir lokasyondadır.
Market, fırın, eczane, sağlık ocağı, semt esnafı, cami, toplu taşıma durakları ve günlük ihtiyaç noktalarına yürüyüş mesafesindedir. Merkezi mahalle yapısı sayesinde araç kullanmadan günlük ihtiyaçlara kolayca ulaşılabilir.
Yatırım ve Kullanım Avantajı
Daire mevcut durumda kiracılıdır. Bu yönüyle yatırım amaçlı alım düşünenler için kira getirisi avantajı sunmaktadır. Geniş metrekareli, çok odalı ve teraslı dubleks daire arayan alıcılar için bölgede öne çıkan alternatiflerden biridir.
Mevcut haliyle kullanılabilir durumda olan daire, alıcının zevkine göre yapılacak kozmetik yenilemelerle çok daha modern ve değerli bir yaşam alanına dönüştürülebilecek yüksek potansiyele sahiptir.

Öne Çıkan Özellikler
Son iki katta yer alan dubleks kullanım
 182 m² brüt geniş yaşam alanı
 5+1 oda düzeni
 İki ayrı mutfak alanı
 Teras kullanımı
 2 banyo + alaturka WC / çamaşır alanı
 Merkezi konum
 T1 tramvay hattına yürüme mesafesi
 Otobüs ve minibüs duraklarına yakınlık
 Okullara, marketlere ve günlük ihtiyaç noktalarına yakın konum
 Kiracılı olması sebebiyle yatırım avantajı
 Geniş aile yaşamına uygun plan yapısı
Güngören Güneştepe’de merkezi konumda, ulaşımı güçlü, geniş metrekareli ve teraslı dubleks daire arayanlar için değerlendirilebilecek bir fırsattır.
Detaylı bilgi almak ve daireyi yerinde görmek için iletişime geçebilirsiniz. Görüşmeler randevu ile yapılacaktır.', 2, false, ARRAY['https://i0.shbdn.com/photos/41/26/30/big_1324412630t0u.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_13244126304z6.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630ixw.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630vj2.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630gwp.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630811.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630b96.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630o00.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630na9.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_13244126302b6.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630i6z.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630k8f.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630ack.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630l1g.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_132441263069b.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630scf.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630p3u.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630wcj.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630otl.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630u3t.jpg']::text[],
    'sale', 3, 4, 'ready', '{}', '2026-08-01T21:35:56Z'
  ),
  (
    'Kağıthane', '2+1', 75, 134146, false,
    'https://i0.shbdn.com/photos/47/37/44/big_13194737449cm.jpg', 5040,
    'Festa''da Metrobüs5dk Asansör Otopark 2+1 75m2 Satılık SıfırDaire

KAĞITHANE TALATPAŞA MAHALLESİ
2+1 75 M2 SATILIK SIFIR DAİRE
AMERİKAN MUTFAKLI
YENİ BİNA
ARA KAT
ASANSÖR
OTOPARK 
METROBÜS 5 DK YÜRÜME MESAFESİ
TOPLU ULAŞIM 6 DK YÜRÜME MESAFESİ
DETAYLAR İÇİN ARAYINIZ.​', 1, false, ARRAY['https://i0.shbdn.com/photos/47/37/44/big_13194737449cm.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744a88.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744dcf.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_13194737445ia.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744log.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_131947374448o.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744ur8.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_131947374420i.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744vfc.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744edh.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744fla.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_13194737441rh.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744exe.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744b04.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_13194737445a3.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744ize.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744tyz.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744esm.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744ria.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_13194737448xn.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744bnj.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_13194737443kf.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744cvu.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744861.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744tk0.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744dcg.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744ne5.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744lbc.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744pe6.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744ajc.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744fty.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744f41.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744llf.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744lld.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744z5u.jpg']::text[],
    'sale', 1, 3, 'under-construction', ARRAY['parking', 'elevator', 'security']::text[], '2026-08-01T21:35:30Z'
  ),
  (
    'Sancaktepe', '4+2', 170, 182927, false,
    'https://i0.shbdn.com/photos/87/71/96/big_1331877196whw.jpg', 5050,
    'Büyük Fırsat Alt Katı 2+1 Üst Katı 2+1 Tek Tapu İki Ayrı Daire

''''DRN Gayrimenkul''den''''​

         Minibüs Yolun Dibinde 200 m² 4+2 Çatı Dubleks Daire

        YÖNETMELİĞİNE UYGUN İNŞA EDİLMİŞ İSKANI ALINMIŞ KAT MÜLKİYETLİ
'''' ALT KAT: SALON, MUTFAK, YATAK ODASI, BANYO, ÇOCUK ODASI, KORİDOR VE BALKON''''
'''' ÜST KAT: SALON, MUTFAK, YATAK ODASI, BANYO, ALATURKA TUVALET, ÇOCUK ODASI VE KORİDOR ''''
İKİ AİLEYE UYGUN ABONELİKLERİ AYRILMIŞ İKİ ADET AYRI AYRI 2+1 DAİRE
'''' YÜKSEK KREDİYE UYGUN ''''
'''' KATILIM EVİM FİNANSMANLARININ HEPSİNE UYGUN ''''﻿​
﻿KONUM BİLGİSİ
- TOPLU TAŞIMA ARAÇLARI YANI BAŞINDA
- SAMANDIRA GİŞELER DİBİNDE VE E-5 KARAYOLUNA ÇOK YAKIN
- KÜÇÜKYALI YENİ BAĞLANTI YOLUNA ÇOK YAKIN
- AYDOS ORMAN''LARI  VE AYDOS GÖL''ÜNE YÜRÜME MESAFESİNDE
- SABİHA GÖKÇEN HAVALİMANINA ÇOK YAKIN
- VİAPORT PİAZZA İSTMARİNA RİNGS ATLASPARKAVM 15 DAKİKA MESAFEDE
- MARMARAY VE İDO ULAŞIMLARINA 20 DAKİKA MESAFEDE
- KARTAL LÜTFÜ KIRDAR EĞİTİM ARAŞTIRMA HASTANESİ''NE 10 DAKİKA MESAFEDE
- ANADOLU ADLİYESİNE 10 DAKİKA MESAFEDE

DAİRE ÖZELLİK
- 60.000 TL KİRA GETİRİSİ GARANTİLİ
- İKİ BANYOLU
- ALATURKA TUVALETLİ
- SIĞINAK DEPOLU

 

- Gayrimenkul Danışmanlarının sözleşme kullanmaları T.S.11816 standartlarının 1.1.1 maddesi gereği zorunlu kılınmıştır.
   Bu nedenle gayrimenkul sunumları "Yer Gösterme Formu" imzalatılarak yapılmaktadır. Anlayışınız için teşekkür ederiz.
   MESLEKİ YETERLİLİK BELGE NO : YB0117/17UY0333-5/00/2441

EN UYGUN oranlar ile anlaşmalı bankalardan konut kredisi imkanı. 
Tüm KREDİ ve TAPU işlemlerinizi biz yapalım size kalan, EVİNİZİN KEYFİNİ SÜRMEK olsun. 
 Misafirimiz olarak sizi ofisimize bekliyoruz.
DİĞER SATILIK DAİRELERİMİZ İÇİN TELEFON İLE İLETİŞİME GEÇEBİLİRSİNİZ.﻿', 2, false, ARRAY['https://i0.shbdn.com/photos/87/71/96/big_1331877196whw.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771964th.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196hop.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771964l6.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771964ol.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771963jg.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196v5n.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196nox.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196f81.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771962lk.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196e8k.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771964m4.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196lz0.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196mtp.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196b9w.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196h06.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196ygp.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196uh9.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196svr.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196spi.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196jiw.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196rmp.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_133187719633t.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196i76.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196eve.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771961zm.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196ct3.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196ftk.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771962yr.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196jny.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196jdv.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771966am.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196hf4.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196z7g.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196g6u.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771963rh.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196d4k.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196dul.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771963bx.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196det.jpg']::text[],
    'sale', 4, 4, 'ready', ARRAY['parking', 'elevator']::text[], '2026-08-01T21:33:42Z'
  ),
  (
    'Şişli', '3+1', 80, 109756, false,
    'https://i0.shbdn.com/photos/95/23/27/big_1325952327gp6.jpg', 5060,
    'PARADAN ACİL EMİNEVM UYGUN SATILIK YÜKSEK GİRİŞ FERAH 3+1 DAİRE

PARANIN MERKEZİ GAYRİMENKUL''DEN
MERKEZİ KONUMDA
METRO METROBÜSE ​12 DK YÜRÜME MESAFESİNDE
EŞYA HEDİYELİ
İSTER OTURUMLUK 
İSTER YATIRIMLIK
KREDİYE UYGUN 3+1 DAİRE
DAHA FAZLA BİLGİ İÇİN: 
 0542 385 54 10

​', 1, true, ARRAY['https://i0.shbdn.com/photos/95/23/27/big_1325952327gp6.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_13259523270dc.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327w4u.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327dcc.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_13259523278zk.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327xai.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327p39.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327nx5.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_13259523273ja.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327be3.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327glo.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327u6a.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327a8c.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327aur.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327uc8.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327myy.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_13259523274yc.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_132595232792w.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_13259523271lj.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327n6p.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327yrd.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327jgm.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327w92.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327l6s.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_13259523275k6.jpg']::text[],
    'sale', NULL, 5, 'ready', ARRAY['furnished']::text[], '2026-08-01T21:33:23Z'
  ),
  (
    'Esenyurt', '2+1', 80, 115854, false,
    'https://i0.shbdn.com/photos/87/23/61/big_1331872361aj3.jpg', 5070,
    'SATILIK | 2+1 | NET 85 m² | ÖNÜ AÇIK | GÜVENLİKLİ SİTE

Mehmet Akif Ersoy Mahallesi, Bağdat Caddesi üzerinde, D-100 cepheli, önü kapanmayacak konumda bulunan, yüksek kat avantajına sahip, ferah ve değer kazanan lokasyondaki dairemiz satıştadır.Daire Özellikleri ● 2+1 ● Net 85 m² ● Kapalı mutfak ● Mutfak ve salona açılan geniş balkon ● Ferah, önü açık D-100 cepheli ● İskânlı ● Kat mülkiyet tapulu ● Krediye uygun ● Kiracılı (yatırımcılar için düzenli kira getirisi)Site Özellikleri ● 7/24 özel güvenlik ● Danışma (resepsiyon) hizmeti ● Kapalı devre kamera sistemi ● Kapalı ve açık otopark ● 3 adet asansör (1 adet yük asansörü) ● Fitness salonu ● Sauna ● Osmanlı hamamı ● Teknik servis hizmeti ● Bakımlı ve düzenli site yaşamıKonum Avantajları ● Bağdat Caddesi üzerinde ● Şehitler ve Gaziler Parkı’nın hemen yanında ● Metrobüse yürüme mesafesinde ● Okul, hastane, market, eczane ve toplu ulaşıma birkaç dakika uzaklıkta ● D-100 Karayolu bağlantısına kolay ulaşımMerkezi konumu, sosyal donatıları, güvenli site yaşamı ve yatırım potansiyeliyle hem oturum hem de yatırım amacıyla değerlendirebileceğiniz kaçırılmayacak bir fırsattır.Detaylı bilgi almak ve daireyi yerinde görmek için iletişime geçebilirsiniz.', 1, false, ARRAY['https://i0.shbdn.com/photos/87/23/61/big_1331872361aj3.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361lbh.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_13318723610a9.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361mhx.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361ead.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361s3c.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361jic.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361fjo.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361hob.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361iog.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361eog.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361hgc.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361zjd.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_13318723615bn.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361g6u.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361pxg.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361hf5.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361y19.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_13318723616m2.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361fmr.jpg']::text[],
    'sale', 7, 18, 'ready', ARRAY['parking', 'security']::text[], '2026-08-01T21:33:09Z'
  ),
  (
    'Çekmeköy', '2+1', 90, 163415, false,
    'https://i0.shbdn.com/photos/69/08/99/big_1258690899u6h.jpg', 5080,
    'ÇEKMEKÖYDE SATILIK 2+1 DAİRE

ÇEKMEKÖY KİRAZLIDERE MAH.
CADDE ÜZERİNDE
AÇIK OTOPARKLI
KREDİYE UYGUN
OTOBÜS GÜZERGAHINDA
İSKANLI KAT MÜLKİYETLİ
ASANSÖRLÜ SIĞINAKLI
ETRAFI AÇIK FERAH
MARKETLER VE ULAŞIM YANI BAŞINDA
FERAH VE GENİŞ MUTFAKLI
DAİREMİZ YENİ SAHİPLERİNİ BEKLİYOR..', 1, false, ARRAY['https://i0.shbdn.com/photos/69/08/99/big_1258690899u6h.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899ag2.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899zpv.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899d52.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899ihn.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_125869089943w.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908991mn.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899ie5.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908999nv.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899nue.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899zks.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_125869089984s.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899iv8.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899g3t.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899msf.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899ycy.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899udh.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899euj.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899pdu.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899l0g.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899h6y.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908990v6.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899jvy.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899hd3.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908993uk.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899shg.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908993j0.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908993kt.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908993f3.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899k7h.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899wjj.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899dkr.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908995e0.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908998n2.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899tc4.jpg']::text[],
    'sale', 2, 6, 'ready', ARRAY['parking', 'elevator']::text[], '2026-08-01T21:32:11Z'
  ),
  (
    'Avcılar', '2+1', 60, 106585, false,
    'https://i0.shbdn.com/photos/75/33/45/big_130775334581o.jpg', 5090,
    '2+1 Açık Mutfaklı Otoparklı Yüksek Giriş Oturuma Hazır

E-5''e 10dk yürüme mesafesindede﻿ 60m² net / 75m² brüt﻿ kullanım alanına sahip 2+1 Sıfır Daire.

 Binamızda Kapalı Otopark Mevcuttur

 
 

  Ferah cepheli, geniş mutfak ve konforlu yaşam alanına sahip; Yüksek Giriş Katı seçeneği ile.

 Kaçırılmayacak Bir Fırsattır, sosyal alanlara ve sahile yürüme mesafesinde; toplu taşımaya çok yakındır.
 
 
 Hem yatırım hem oturum için ideal fırsattır.
 Dairemize Yaklaşık olarak 2.000.000₺ Konut Kredisi Kullanabilirsiniz.
 
 
 Konum bilgisi TemsilidirLütfen Randevu Talep EdinizYER GÖSTERME HİZMET SÖZLEŞMESİ
 OLMADANHİZMET  VERİLMEMEKTEDİR!!!!!
 
 
 
 NOT: Emin Evim, Sinpaş, Fuzul Evim ve diğer finansman şirketlerinden alım yapacak müşteriler için uygundur. ‘İlk Evim’ kampanyası kapsamında %80 – %90 oranında, yani tamamına yakın kredi kullanma imkânı bulunmaktadır.

 ''''20 yıllık tecrübemizle sürecin her aşamasında güvenle yanınızdayız.”
 «مشاوره تخصصی به زبان فارسی در تمام مراحل خرید، فروش و اجاره ارائه می‌شود.»"يتم تقديم نصائح الخبراء باللغات الفارسية والإنجليزية والعربية في جميع مراحل البيع والشراء والإيجار."
 
 "Expert advice is provided in Persian, English and Arabic
 

 at all stages of buying, selling and renting."

 

---- !!! BU FIRSATI KAÇIRMAYIN !!! ----

 
 KARACA YAPI OLARAK, MÜŞTERİLERİMİZİN GÖNÜL RAHATLIĞIYLA EV SAHİBİ OLABİLMESİ İÇİN KOLAY VE GÜVENİLİR HİZMETLERİ SUNUYORUZ. 
 
 
 
 ✅SATIN ALMAK İSTEDİĞİNİZ DAİRENİN GERÇEK DEĞERİNİ, ŞEFFAF BİR ŞEKİLDE SİZLERLE PAYLAŞIYOR SİZLERİ GEREKSİZ RİSKLERDEN KORUYUP, SÜRECİ HIZLI VE GÜVENLİ ŞEKİLDE TAMAMLAMANIZI SAĞLIYORUZ. 
 
 
 
 ✅MİSYONUMUZ ; AİLELERİN HUZURLA YAŞAYACAĞI SICAK YUVALARINA GÜVEN İÇİNDE KAVUŞMASIDIR. 
 
 
 
 ✅KARACA YAPI OLARAK SİZ DEĞERLİ MÜŞTERİLERİMİZİ OFİSİMİZDE MİSAFİR ETMEKTEN MUTLULUK DUYARIZ. 
 
 
 
 ✅GELİN, BİR KAHVEMİZİ İÇİN EV SAHİBİ OLMANIN KOLAY YOLLARINI BİRLİKTE KONUŞALIM.☕ 
 
 
 KARACA YAPI KENTSEL DÖNÜŞÜM LTD ŞTİ 
 
 ☎️0542 340 61 78 
 
 
 
 
 
 
 ✅KONUM : AVCILAR CİHANGİR MAH. BURNAZ CAD. NO 30/1 (İGS METROPOL B > GİRİŞİ)', 1, false, ARRAY['https://i0.shbdn.com/photos/75/33/45/big_130775334581o.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_1307753345ior.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_1307753345si9.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_13077533453ly.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_1307753345j88.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_13077533455lv.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_1307753345dtk.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_130775334539a.jpg']::text[],
    'sale', NULL, 4, 'ready', ARRAY['parking', 'elevator', 'security']::text[], '2026-08-01T21:31:48Z'
  ),
  (
    'Arnavutköy', '4+2', 185, 109756, false,
    'https://i0.shbdn.com/photos/66/58/75/big_1295665875303.jpg', 5100,
    'ÖZGÜR İNŞAAT''TAN HASTANE MAH SIFIR 4+2 195M2 SIFIR DUBLEX DAİRE

***ÖZGÜR GAYRİMENKUL***

SİZİ EV SAHİBİ YAPAR...

!!!!KİRA ÖDER GİBİ DAİRE SAHİBİ OLUN!!!!!

EN UYGUN FAİZ ORANIYLA KREDİNİZİ BİZ 

ÇIKARTIYORUZ

4+2 195M2

DUBLEX DAİRE

 ULAŞIM 

KREDİYE UYGUN

 %100 KREDİ İMKANI

 SEMT PAZARI, TRAMVAY, OKUL, HASTANE, MARKET YÜRÜME MESAFESİ   

 OFİSİMİZ HAFTANIN 7 GÜNÜ SİZ DEĞERLİ MÜŞTERİLERİMİZE HİZMET VERMEKTEDİR.

KREDİNİZİ BİZ ÇIKARTIYORUZ FİRMAMIZ TARAFINDAN TAKİP EDİLİP EN HIZLI BİR ŞEKİLDE SONUÇLANDIRILIR.

 TAPU VE KREDİ İŞLEMLERİNİZ İÇİN BİZE SADECE BİR GÜNÜNÜZÜ AYIRMANIZ YETERLİDİR.  

Sizleri satış ofisimize BEKLİYORUZ

İRTİBAT TELEFONLARIMIZ

 
 
 
 Merkez Ofis:0212 619 34 66
 
 YUSUF ÖZGÜR: 0536 795 80 98
 
 SALİH ÖZGÜR: 0545 619 34 66
 
 İSMETPAŞA MAH ORDU CAD NO:270-272A 
 
 SULTANGAZİ/İST', 1, false, ARRAY['https://i0.shbdn.com/photos/66/58/75/big_1295665875303.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875jna.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875cxt.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875c4f.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875tvn.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875mj4.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875tle.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_12956658752sm.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875178.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_129566587505r.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875o30.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875os8.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875wcc.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_129566587587d.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875wkj.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875x4h.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875n08.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875ykb.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_12956658759n0.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_129566587555w.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875n34.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875rzy.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875a6t.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_129566587572h.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875onx.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_129566587532f.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875fb3.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875h5a.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_12956658750dn.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875aus.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875so2.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875ca7.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875vej.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875omj.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_12956658757p7.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875slj.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_12956658753au.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875iwj.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875s8o.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875bj3.jpg']::text[],
    'sale', 4, 5, 'ready', ARRAY['elevator']::text[], '2026-08-01T21:31:46Z'
  ),
  (
    'Pendik', '2+1', 85, 68268, false,
    'https://i0.shbdn.com/photos/96/20/05/big_13259620051a5.jpg', 5110,
    'ESENYALI ANA CADEYE ÇOK YAKIN ARSA PAYI GÜÇLÜYATIRIMLIK DAİRE

DAİREMİZ ESENYALI 4  YOLA ÇOK YAKINDIR2+1 OLAN DAİREMİZ ARSA PAYI 30 M2DAİREMİZ DE KİRACİ VARDIRKENTSEL DÖNÜŞÜM  ÇOK GÜZEL BİR YATIRIM OLACAKTIR.HER TÜRLÜ TEKLİF VE TAKAS TEKLİFLERİ DEGERLENDİRİLİR.', 1, false, ARRAY['https://i0.shbdn.com/photos/96/20/05/big_13259620051a5.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005e3x.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005fu4.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005kt3.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005bt8.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005r1z.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_13259620059bu.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_132596200507t.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005pnl.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_13259620057at.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005cr5.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005twz.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005r4u.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005bdh.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005k6s.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005gfa.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005nzs.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005a5x.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005igl.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005af1.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005y9l.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_13259620058zm.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005ylm.jpg']::text[],
    'sale', 4, 4, 'ready', '{}', '2026-08-01T21:31:08Z'
  ),
  (
    'Bağcılar', '2+1', 115, 78049, false,
    'https://i0.shbdn.com/photos/06/64/52/big_13000664527vi.jpg', 5120,
    'FIRSAT!..SATILIK METROYA YAKIN 2+1 BOŞ. DAİRE 22mt HİSSELİ

Bağcılar İnönü Mahallesi''nde, metroya yürüme mesafesinde, doğalgaz kombili satılık 2+1 daire!

Dairemiz, konum olarak Bağcılar İnönü Mahallesi''nde, Molla Gürani Metro durağının hemen üst kısmında yer almaktadır. Bu merkezi konum, ulaşımı son derece kolaylaştırmaktadır. Molla Gürani Metro durağına sadece 5 dakika yürüme mesafesinde (Google Maps verisi) olması, şehrin her noktasına hızlı ve pratik bir ulaşım imkanı sunar.

Daire, 2+1 oda düzenine sahip olup, 115 m² net kullanım alanına sahiptir. Bu genişlik, ferah ve konforlu bir yaşam sürmeniz için idealdir. Brüt alanı ise 125 m²''dir.

Komple sıfırdan yenilenmiş olan dairemizde hiçbir masraf bulunmamaktadır. Yeni sahipleri hemen taşınmanın keyfini çıkarabilir. İç ve dış özellikleriyle dikkat çeken bu daire, konforlu bir yaşam alanı sunmaktadır.

Daire Özellikleri

 Net Kullanım Alanı: 115 m²
 Brüt Kullanım Alanı: 125 m²
 Oda Sayısı: 2+1
 Banyo Sayısı: 1
 Mutfak Tipi: Kapalı
 Isıtma Sistemi: Doğalgaz Kombi
 Balkon: Mevcut
 Bina Yaşı: 31 ve üzeri
 Bulunduğu Kat: 1. Kat
 Kat Sayısı: 4
 Kullanım Durumu: Boş
 Eşyalı: Hayır

Konum ve Ulaşım

 Konum: Bağcılar, İnönü Mahallesi
 Metro Durağına Yakınlık: Molla Gürani Metro durağına 5 dakika yürüme mesafesi
 Ulaşım Kolaylığı: Şehrin ana ulaşım ağlarına yakın
 Çevre: Market, okul, hastane gibi temel ihtiyaç noktalarına kolay erişim
 Manzara: Açık ve ferah bir manzaraya sahip
 Engelli ve Yaşlı Dostu: Engelli ve yaşlı bireyler için uygun erişim imkanları
 Çift balkonludur 

⚖️ Tapu ve Yatırım Bilgileri

 Tapu Durumu: Arsa Tapulu
 Arsa Hissesi: 22 m²
 Krediye Uygunluk: Krediye uygun değildir.
 Emlak Ofisinden Satılıktır.

Detaylı bilgi ve daireyi görmek için lütfen bizimle iletişime geçin. Fırsatı kaçırmayın!', 1, false, ARRAY['https://i0.shbdn.com/photos/06/64/52/big_13000664527vi.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452g6y.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452sw9.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_13000664521db.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452as7.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452kd7.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452yi1.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452n0d.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452ofa.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452ti9.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452dvs.jpg']::text[],
    'sale', 1, 4, 'ready', '{}', '2026-08-01T21:30:51Z'
  ),
  (
    'Gaziosmanpaşa', '2+1', 70, 173171, false,
    'https://i0.shbdn.com/photos/02/84/01/big_1323028401gj6.jpg', 5130,
    '*MAS GAYRİMENKUL*DEN TOKİ 12C PROJESİNDE SATILIK 2+1 DAİRE️

MAS GAYRİMENKUL''den, TOKİ 12C Projesi''nde, Sarıgöl Mahallesi''nin kalbinde satılık 2+1 fırsatı!
Gazi Osman Paşa''da merkezi bir konumda yer alan TOKİ 12C Projesi''nde, MAS GAYRİMENKUL güvencesiyle sizleri bekleyen bu özel 2+1 daire, konforlu ve modern bir yaşam sunuyor. Gayrimenkul alımlarında 100.000 km altı araçlar takas olarak kabul edilmekte olup, hızlı ve güvenilir değerleme hizmetimizle yanınızdayız.
Daire Özellikleri

 Kullanım Alanı: Brüt 80 m² / Net 70 m² ferah yaşam alanı
 Oda Düzeni: 2 Oda 1 Salon, ferah ve kullanışlı
 Mutfak: Modern Açık Mutfak (Amerikan Mutfak)
 Banyo: Hilton Banyo ve Duşakabin
 Ek Alanlar: Balkon, Antre
 Kat Bilgisi: 11 katlı binanın 1. katı (Ara Kat)
 Zemin: Parke Zemin
 Pencereler: Isıcam ile donatılmış, ses ve ısı yalıtımı
 Aydınlatma: Spot Aydınlatma ile modern ve şık görünüm
 Kapılar: Amerikan Kapılar
 İç Durum: Boyalı, temiz ve bakımlı
 Kullanım Durumu: Boş, hemen taşınmaya uygun

Konum ve Çevre Avantajları
Gazi Osman Paşa Sarıgöl Mahallesi''nde merkezi bir konumda bulunan dairemiz, şehrin tüm olanaklarına yürüme mesafesindedir:

 Sağlık Kurumları: Avrasya Hastanesi ve Başarı Hastanesi''ne yakınlık.
 Ulaşım Ağları: Metro durağı, otobüs durakları ve minibüs hatlarına kolay erişim.
 Sosyal Yaşam: Semt pazarı, çeşitli marketler ve AVM''ler (Vialand AVM alt giriş kapısına yürüme mesafesi).
 Spor ve Rekreasyon: Basketbol sahası, çocuk oyun alanları ve spor alanları ile aktif bir yaşam.
 Temel İhtiyaçlar: Cami, eczane ve polis merkezi gibi önemli noktalara yakınlık.

Ulaşım Kolaylığı
Şehrin ana ulaşım akslarına yakınlığı sayesinde zamandan tasarruf edin:

 Metro Hatları: Mahmutbey – Mecidiyeköy Metro Hattı ve Alibeyköy Cep Otogarı – Eminönü Tramvay Hattı''na kolay ulaşım.
 Ana Arterler: TEM ve E5 otoyollarına yakınlık, şehir içi ve şehirlerarası seyahatlerde büyük kolaylık sağlar.
 Ticari Merkezler: Vialand AVM''ye yürüme mesafesinde olması, hem yaşam hem de ticari açıdan avantajlıdır.

✨ Site ve Bina Özellikleri
TOKİ 12C Projesi, modern yaşam standartlarınıza uygun birçok özellikle donatılmıştır:

 Güvenlik: 24 Saat Güvenlik, Kamera Sistemi, Hırsız Alarmı ile tam koruma.
 Yangın Güvenliği: Yangın Merdiveni ve Jeneratör ile her duruma hazırlıklı.
 Ulaşım: Kapalı ve Açık Otopark Alanları, Çift Asansör ve Engelliye Uygun Asansör.
 Teknolojik Altyapı: Fiber İnternet, Merkezi Uydu Sistemi, Kablo TV ve Görüntülü Diyafon.
 Konfor: Çelik Kapı, Merkezi Isıtma Sistemi (Pay Ölçer ile bireysel kullanım), Isı ve Ses Yalıtımı.
 Ek Hizmetler: Apartman Görevlisi ve Jeneratör.

Yatırım ve Yaşam Potansiyeli
MAS GAYRİMENKUL olarak, TOKİ 12C Projesi''ndeki bu özel daire ile hem oturum hem de yatırım amaçlı değerli bir fırsat sunuyoruz. Proje içerisinde yer alan 863 daire, 28 dükkan, ilkokul, ortaokul ve KYK yurdu gibi sosyal donatılar, yaşam kalitesini artırmaktadır. Merkezi konumu, ulaşım kolaylığı ve site olanakları ile bu daire, geleceğe yönelik sağlam bir yatırım vaat ediyor.
Detaylı bilgi ve randevu için bizimle iletişime geçin.

 SAMET BAŞCIL​Profesyonel Gayrimenkul Danışmanı

  0531 976 96 17

Kiralık ve satılık tüm gayrimenkulleriniz için ücretsiz danışmanlık hizmetimizden yararlanabilirsiniz. Haftanın 7 günü hizmetinizdeyiz.', 1, false, ARRAY['https://i0.shbdn.com/photos/02/84/01/big_1323028401gj6.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401n48.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401sir.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401onk.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401nkj.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284019wk.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401efm.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284016h5.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401cri.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284013x4.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401wk5.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401bgo.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401y3o.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401wy9.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401sf1.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401gjc.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401743.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401d5t.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401wrz.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284012m6.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401jkp.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401y8h.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401ip2.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401y2n.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401pgr.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284019y2.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284013l1.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401mz6.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401r2v.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401l7g.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401iee.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284013t7.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401erz.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401igs.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284019xk.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401stf.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401nmk.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284017m9.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401zhs.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401n8k.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284012aj.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401h0n.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401mln.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401xo6.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284016r4.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401h1f.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401pv4.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401xp2.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401g47.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401ove.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401zg6.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284017xp.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401zwv.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284010pg.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401fpa.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401gbv.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_132302840147y.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401may.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284016ms.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401w06.jpg']::text[],
    'sale', 1, 11, 'ready', ARRAY['parking', 'elevator', 'security']::text[], '2026-08-01T21:30:48Z'
  ),
  (
    'Esenyurt', '2+1', 85, 65829, false,
    'https://i0.shbdn.com/photos/59/26/27/big_1317592627o3w.jpg', 5140,
    'KELEPİR 2+1 ARAKAT DAİRE CADDENİN 2.PARSELİ

ROZA EMLAK İNŞAAT''TAN

Isı Ve Ses Yalıtımı ile Yaz Kış Ferah ve Sessiz

 Led Spot ve Dekoratif Işıklandırma ile Şık ve Kullanış﻿lı﻿

 Sevdiklerinizle Mutlu Zamanlar Geçirebileceğiniz Sosyal Alanlara Yakın

 Avrupa Yakasının Yatırım ve Yaşam Alanı Olarak En Çok Tercih Edilen Bölgesinde

 Hem Doğru Bir Yatırım Yapmak Hem de Satın Alırken Kazanmak İster misiniz?﻿

 Birinci Kalite Malzemelerin Kullanıldığı
 Tamamı Krediye Uygun﻿
 ﻿Kaliteli ve Kazançlı Daireler

Kredi işlemlerinizi Uzman Kadromuz ve Firmamıza Özel Kredi oranları ile Hızlı Bir Şekilde Sonuçlandıralım
ROZA EMLAK Güvencesiyle

HAYALİNİZDEKİ EVİN ANAHTARI BİZDE

Profesyonel ve Güleryüzlü Ekibimizle Haftanın Yedi Günü Hizmetinizdeyiz.

İLETİŞİM
0530 341 6456 
0537 964 1245
0542 342 5768', 2, false, ARRAY['https://i0.shbdn.com/photos/59/26/27/big_1317592627o3w.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627jn7.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627y32.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627shp.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627yvl.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_13175926279ri.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627xo1.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627g85.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627g0z.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_13175926274fy.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627a4e.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627bh8.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627n59.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627nld.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627zmn.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627gy5.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627l0t.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627nb0.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627v4e.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627654.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627i92.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627bzi.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627px4.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627epf.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627rby.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627lgs.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_13175926276mj.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627nao.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_13175926275bu.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627w6u.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627ylg.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627jlg.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627oka.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627acp.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_13175926270sm.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627pme.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627x4j.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627yv3.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_13175926272xj.jpg']::text[],
    'sale', 1, 6, 'ready', ARRAY['parking']::text[], '2026-08-01T21:30:48Z'
  ),
  (
    'Üsküdar', '2+1', 100, 207317, false,
    'https://i0.shbdn.com/photos/01/32/19/big_1329013219b7i.jpg', 5150,
    'EMAAR AVM YAKINI GENÇ BİNADA SATILIK 100m² 2+1 DAİRE

Emaar AVM''ye komşu, E-5 ve TEM bağlantı yollarına yakın, genç ve modern binada satılık geniş 2+1 daire!İstanbul''un hızla gelişen lokasyonlarından birinde, ulaşım ağlarının merkezinde yer alan bu daire, hem şehir içi ulaşım hem de iş ve sosyal hayatınız için ideal bir konum sunuyor. Emaar AVM''ye yürüme mesafesinde olması, günlük ihtiyaçlarınızı kolayca karşılamanızı sağlarken, TEM ve köprü bağlantı yollarına yakınlığı sayesinde şehrin her noktasına hızlıca ulaşabilirsiniz.Toplu taşıma araçlarına olan yakınlığı da dikkat çekici. Metro ve metrobüs duraklarına kolay erişiminiz sayesinde trafik derdi olmadan dilediğiniz yere ulaşım sağlayabilirsiniz. Ayrıca, Medeniyet Üniversitesi''ne yürüme mesafesinde olması, öğrenciler ve üniversite çalışanları için de büyük bir avantajdır.Dairemiz 2+1 olmasına rağmen, 100m² net kullanım alanına sahip olmasıyla oldukça ferah ve kullanışlıdır. Geniş odaları ve ferah yapısıyla rahat bir yaşam alanı sunmaktadır. Ayrıca, ayrı ve büyük mutfağında ocak, fırın ve davlumbazdan oluşan ankastre seti mevcuttur. Bu modern mutfak, yemek hazırlama deneyiminizi keyifli hale getirecektir.Binamız Asansörlüdür.Hemen arkamızda yer alan Grafik Sanatlar Müzesi, kültürel aktivite imkanları sunarken, çevresinde okullar, alışveriş merkezleri, hastaneler, eczaneler ve sağlık ocakları gibi pek çok önemli noktaya yakınlık bulunmaktadır. Spor salonu, eğlence merkezleri ve parklar da yaşamınıza değer katacak sosyal olanaklar arasındadır. Gün boyu doğal ışık almaktadır.Bu daire, hem merkezi konumu hem de sunduğu geniş yaşam alanı ile dikkat çekmektedir. Detaylı bilgi ve daireyi yerinde görmek için lütfen bizimle iletişime geçin.COLDWELL BANKER ZONE - ŞERİFE GÜL - 0542 272 10 64', 1, false, ARRAY['https://i0.shbdn.com/photos/01/32/19/big_1329013219b7i.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219l3t.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219vis.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219j9a.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219ny3.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_13290132190ne.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_13290132195s6.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219avf.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219jfz.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_13290132192sx.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219mo2.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219l2t.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_13290132193sp.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219krg.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_13290132199sw.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_13290132194g7.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_13290132191b1.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219wje.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219xw8.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219jnc.jpg']::text[],
    'sale', 2, 3, 'ready', ARRAY['elevator']::text[], '2026-08-01T21:30:47Z'
  ),
  (
    'Büyükçekmece', '10 Üzeri', 450, 1707317, true,
    'https://i0.shbdn.com/photos/43/73/80/big_1319437380yby.jpg', 5160,
    'BÜYÜKÇEKMECE KAMİLOBADA ACİL SATILIK TRİBLEKS SIFIR VİLLA

İSTANBUL BÜYÜKÇEKMECE KAMİLOBA''DA 700 METRE ARSA İÇERİSİNDE İSKANLI FULL YENİ YAPI 160 METRE ARTEZYENİ HER TÜRLÜ MEYVE AĞAÇLARI ETRAFI KOMPLE PERDE BETON VE TEL ÇİTLE ÇEVRİLİ 11 BAĞIMSIZ BÖLÜM 11 ODALI 4 BANYO TUVALET LÜKS TÜRK HAMAMI FULL DENİZ MANZARALI ACİL SATILIK TRİBLEKS VİLLA', 5, false, ARRAY['https://i0.shbdn.com/photos/43/73/80/big_1319437380yby.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373800rj.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373803ao.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373801n1.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373802ot.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380ubd.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373807yi.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380ofg.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380ihp.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380r39.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380jpp.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380k2d.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380gpw.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380jpk.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380z09.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373807x8.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380tkl.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380d04.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380dhz.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373809dh.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373805fj.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373804n0.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_131943738032e.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380dbe.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380xef.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_131943738077e.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373802jt.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373809zg.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380hph.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373805gd.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380k38.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380uih.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380r4l.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380nu6.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380zi3.jpg']::text[],
    'sale', NULL, 3, 'ready', ARRAY['parking', 'security']::text[], '2026-08-01T21:30:43Z'
  ),
  (
    'Pendik', '3+1', 108, 146341, false,
    'https://i0.shbdn.com/photos/86/30/86/big_1331863086ged.jpg', 5170,
    'sahibinden satılık geniş ferah 3+1 daire

odaları büyük kullanışlı ferah yalıtımlı kışları sıcak yazları ferah 1. sınıf malzemeyle mutfağı yenilendi 2 balkonlu balkonun biri kapalı yoğuşmalı sıfır ECA kombi takıldı krediye uygun çavuşoğlu yemenler inşaattan alındı ilk sahibiyiz bodrumda her dairenin ayrı ayrı fazla eşyaları koyabilecekleri bölgeleri mevcut belediye otobüs durağına ,minibüs durağına ve camiye yürüme mesafesinde alıcısına hayırlı uğurlu olsun', 1, false, ARRAY['https://i0.shbdn.com/photos/86/30/86/big_1331863086ged.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086y05.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630863mt.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086o69.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086417.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630869uo.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086t4e.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630867oy.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630862xo.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086z2h.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086vpn.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086uwb.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086ciz.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086ryp.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630863jk.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086d0t.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630862az.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086ump.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630862g9.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086eh2.jpg']::text[],
    'sale', 3, 6, 'ready', ARRAY['elevator']::text[], '2026-08-01T21:29:51Z'
  ),
  (
    'Eyüpsultan', '2+1', 70, 109756, false,
    'https://i0.shbdn.com/photos/07/66/18/big_1326076618djc.jpg', 5180,
    'ALİBEYKÖY''DE METROYA YAKIN FIRSAT 2+1 DAİRE

ALİBEYKÖY''DE MERKEZİ KONUMDA
HALİÇ VE BİLGİ ÜNİVERSİTESİNE YAKIN, 
MAHMUTBEY - YILDIZ METROSUNA  RAHAT ULAŞIM, 
ALİBEYKÖY CEP OTAGARI - EMİNÖNÜ TRAMVAY HATTINA 100 METRE YÜRÜME MESAFESİNDE, 
ALİBEYKÖY CEP OTAGARINA YÜRÜME MESAFESİNDE, 

 KOT FARKINDAN DOLAYI 1. KAT YÜKSEKLİĞİNDEDİR. 

 KİRACI TAŞINMA SÜRECİNDE OLUP EN KISA SÜREDE TAHLİYE EDECEKTİR. 
 

 OTURUM VE YATIRIM İÇİN ÇOK UYGUN FIRSAT DAİRE!!!!!! 
 

 DAHA DETAYLI BİLGİ İÇİN LÜTFEN İLETİŞİME GEÇİNİZ
 TURYAP ACIBADEM BANU DUYGU', 1, false, ARRAY['https://i0.shbdn.com/photos/07/66/18/big_1326076618djc.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618tsi.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618tdg.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618jhr.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_132607661892x.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766181dd.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618gt4.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766181k0.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766180dm.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766189au.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766185h4.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766184bv.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766181ug.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618772.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618sf1.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618apa.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618i40.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618mx8.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766181eu.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618xge.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618m4u.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618u0r.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766188zk.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618l8s.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618tyg.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618yjd.jpg']::text[],
    'sale', NULL, 7, 'ready', ARRAY['parking', 'elevator', 'security']::text[], '2026-08-01T21:29:44Z'
  ),
  (
    'Maltepe', '2+1', 60, 173171, false,
    'https://i0.shbdn.com/photos/76/01/69/big_1297760169o90.jpg', 5190,
    'MALTEPE CEVİZLİ MAH MİNÜBÜS YOLU ÜZERİNDE SATILIK 2+1 DAİRE

''''TEK YETKİLİ'''' 

 CR AYAZ GAYRİMENKUL GÜVENCESİYLE 

 TİCARİ YETKİ BELGESİ NO : 3411048 

 EMLAK ODASI KAYIT NO : 26677601 

 MALTEPE BAĞDAT CADDESİ ÜZERİ 

 2+1 LÜX 5 YAŞINDA DAİRE 

 1.SINIF İŞÇİLİK VE MALZEME KALİTESİ 

 ASANSÖR 

 GÜVENLİK KAMERALARI İLE DONATILMIŞ 

 • BALKONLU 

 • 

 • AÇIK MUTFAK 

 • 

 • 2 KATLI KAPALI OTOPARK BULUNMAKTADIR 

 • 

 • SU DEPOSU MEVCUT 

 • 

 • ASANSÖR MEVCUT VE OTOPARK KATLARINA KADAR İNMEKTEDİR 

 • 

 • İSTEDİĞİNİZ ZAMAN DİLİMİNDE DAİREYİ GÖREBİLİRSİNİZ !! 

 • LOKASYON OLARAK;   MARMARAY İSTASYONUNA 200 M UZAKLIKTA 

 • BAĞDAT CADDESİ ÜZERİNDE 

 • 

 • MİNÜBÜS YOLUNUN HEMEN YANINDA 

 • 

 • AVM  

 •  ALIŞVERİŞ MERKEZLERİ 

 • E-5 e 2 DK UZAKLIKTA 

 • KARTAL ADALET SARAYINA 2 DAKKA UZAKLIKTA 

 • KARTAL EĞİTİM VE ARAŞTIRMA HASTANESİNE 

 • SAHİLE 4 DK UZAKLIKTA 

 • UĞUR KOLEJİ YANI BAŞINDA 

 • MUHTEŞEM LOKASYONDA 

 • DETAYLAR İÇİN BİZİ ARAYINIZ.. 

 • • AYAZ GAYRIMENKUL- • ALIM SATIM VE KIRALAMA GAYRiMENKUL DANISMANLIGI • 0542 357 6893 0216 383 69 69 • Bağlarbaşı Mh. • Sakiza¢aci Sk. • Erdem Erdem is Han • No: 23/4 • Maltepe/isT. • Rahmi AYAZ', 1, false, ARRAY['https://i0.shbdn.com/photos/76/01/69/big_1297760169o90.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169dlj.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169ibo.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_12977601694an.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169euj.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_12977601693vr.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169gjg.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169u6h.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_12977601692jo.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169kg1.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169j8g.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_12977601697r3.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169znl.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169gwx.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169n5r.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169lzv.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_12977601691rh.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169a12.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169ebp.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169mhd.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_12977601699li.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_129776016930c.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169cei.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_12977601693w8.jpg']::text[],
    'sale', 2, 4, 'ready', ARRAY['parking', 'elevator']::text[], '2026-08-01T21:29:31Z'
  );
