-- Follow-up fix for the sahibinden import (20260802_import_sahibinden_listings.sql):
-- descriptions carried the FULL scraped text (marketing spam, phone numbers,
-- tourist-guide walls of text), and some listings kept 20-60 hotlinked photos,
-- which is what caused the oversized/unusable photo strip and the layout
-- overflow on the listing detail page. This trims each description down to a
-- short, real summary and caps photos at 8 per listing.
--
-- It also corrects price_usd: the original import used an approximate
-- 41 TRY/USD rate; this recomputes at 47.54 (the site's own live
-- FX ticker rate), and re-checks the citizenship-threshold flag against it.
--
-- Matches rows by (district, rooms, m2, price_usd) using the OLD price_usd,
-- which is still a unique combination across the 20 imported rows.

update public.listings set
  description = 'FIRSAT !!! KAĞITHANE TALATPAŞA 4+1 Geniş Daire 170 m²

KAĞITHANE Örnektepe Bölgesinde 4+1 Geniş Daire – 170 m² ✨ Çift Cepheli – Yatırıma ve Oturuma Uygun Konum: Beyoğlu Örnektepede, merkezi lokasyonda Büyüklük: 4+1, net 170 m² geniş kullanım alanı  Lokasyon Avantajları Ulaşım: Metro, metrobüs, Marmaray, tramvay ve deniz otobüsüne kolay erişim. Sağlık: Cemil Taşçıoğlu Hastanesi 5 dakika mesafede. Adalet & İş: Çağlayan Adliyesi 5 dakika uzaklıkta. Merkezler: Taksim, Eminönü, Şişli, Mecidiyeköy gibi iş ve sosyal merkezlere yakın.',
  images = ARRAY['https://i0.shbdn.com/photos/87/84/32/big_1331878432xwr.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432c6x.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432018.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432oh3.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_133187843279c.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432uyj.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432zts.jpg', 'https://i0.shbdn.com/photos/87/84/32/big_1331878432de5.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/87/84/32/big_1331878432xwr.jpg',
  price_usd = 100968,
  citizenship = false
where district = 'Kağıthane' and rooms = '4+1' and m2 = 172 and price_usd = 117073;

update public.listings set
  description = 'BAĞCILAR EXPRESS 24 REZİDANS SATILIK CADDE CEPHE 2+1 DAİRE',
  images = ARRAY['https://i0.shbdn.com/photos/12/30/98/big_1300123098vi5.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_13001230981i2.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098gmg.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098796.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098nh0.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098lps.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098vl7.jpg', 'https://i0.shbdn.com/photos/12/30/98/big_1300123098t39.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/12/30/98/big_1300123098vi5.jpg',
  price_usd = 120951,
  citizenship = false
where district = 'Bağcılar' and rooms = '2+1' and m2 = 65 and price_usd = 140244;

update public.listings set
  description = 'ÖZGÜR İNŞAAT''TAN ESENTEPE MAH''DE 2+1 105M2 MÜKEMMEL BAHÇE KATI',
  images = ARRAY['https://i0.shbdn.com/photos/68/66/18/big_1316686618cle.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618053.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_131668661846e.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618xr4.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618rlc.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618yo6.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618ucn.jpg', 'https://i0.shbdn.com/photos/68/66/18/big_1316686618np1.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/68/66/18/big_1316686618cle.jpg',
  price_usd = 77808,
  citizenship = false
where district = 'Sultangazi' and rooms = '2+1' and m2 = 95 and price_usd = 90220;

update public.listings set
  description = 'SAHİBİNDEN GÜNEŞTEPE MAH.DE 182 M² 5+1 TERASLI DUBLEKS

İstanbul’un merkezi ve ulaşım avantajı yüksek bölgelerinden Güngören Güneştepe Mahallesi’nde, Nevbahar Sokak üzerinde yer alan 5+1 dubleks dairemiz sahibinden satılıktır. 15 yıllık, toplam 4 katlı binanın son iki katında konumlanan dairemiz; 182 m² brüt, yaklaşık 145 m² net kullanım alanı, ferah oda dağılımı, iki ayrı mutfak alanı ve terasıyla geniş aileler için oldukça kullanışlı bir yaşam alanı sunmaktadır. Daire Genel Özellikleri Dairemiz 5+1 plan yapısına sahiptir.',
  images = ARRAY['https://i0.shbdn.com/photos/41/26/30/big_1324412630t0u.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_13244126304z6.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630ixw.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630vj2.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630gwp.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630811.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630b96.jpg', 'https://i0.shbdn.com/photos/41/26/30/big_1324412630o00.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/41/26/30/big_1324412630t0u.jpg',
  price_usd = 167228,
  citizenship = false
where district = 'Güngören' and rooms = '5+1' and m2 = 145 and price_usd = 193902;

update public.listings set
  description = 'Festa''da Metrobüs5dk Asansör Otopark 2+1 75m2 Satılık SıfırDaire

YENİ BİNA ARA KAT ASANSÖR OTOPARK',
  images = ARRAY['https://i0.shbdn.com/photos/47/37/44/big_13194737449cm.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744a88.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744dcf.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_13194737445ia.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744log.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_131947374448o.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_1319473744ur8.jpg', 'https://i0.shbdn.com/photos/47/37/44/big_131947374420i.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/47/37/44/big_13194737449cm.jpg',
  price_usd = 115692,
  citizenship = false
where district = 'Kağıthane' and rooms = '2+1' and m2 = 75 and price_usd = 134146;

update public.listings set
  description = 'Büyük Fırsat Alt Katı 2+1 Üst Katı 2+1 Tek Tapu İki Ayrı Daire

''''DRN Gayrimenkul''den''''​ Minibüs Yolun Dibinde 200 m² 4+2 Çatı Dubleks Daire ﻿KONUM BİLGİSİ DAİRE ÖZELLİK - İKİ BANYOLU Bu nedenle gayrimenkul sunumları "Yer Gösterme Formu" imzalatılarak yapılmaktadır. Anlayışınız için teşekkür ederiz.',
  images = ARRAY['https://i0.shbdn.com/photos/87/71/96/big_1331877196whw.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771964th.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196hop.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771964l6.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771964ol.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_13318771963jg.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196v5n.jpg', 'https://i0.shbdn.com/photos/87/71/96/big_1331877196nox.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/87/71/96/big_1331877196whw.jpg',
  price_usd = 157762,
  citizenship = false
where district = 'Sancaktepe' and rooms = '4+2' and m2 = 170 and price_usd = 182927;

update public.listings set
  description = 'PARADAN ACİL EMİNEVM UYGUN SATILIK YÜKSEK GİRİŞ FERAH 3+1 DAİRE',
  images = ARRAY['https://i0.shbdn.com/photos/95/23/27/big_1325952327gp6.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_13259523270dc.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327w4u.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327dcc.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_13259523278zk.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327xai.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327p39.jpg', 'https://i0.shbdn.com/photos/95/23/27/big_1325952327nx5.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/95/23/27/big_1325952327gp6.jpg',
  price_usd = 94657,
  citizenship = false
where district = 'Şişli' and rooms = '3+1' and m2 = 80 and price_usd = 109756;

update public.listings set
  description = 'SATILIK | 2+1 | NET 85 m² | ÖNÜ AÇIK | GÜVENLİKLİ SİTE',
  images = ARRAY['https://i0.shbdn.com/photos/87/23/61/big_1331872361aj3.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361lbh.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_13318723610a9.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361mhx.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361ead.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361s3c.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361jic.jpg', 'https://i0.shbdn.com/photos/87/23/61/big_1331872361fjo.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/87/23/61/big_1331872361aj3.jpg',
  price_usd = 99916,
  citizenship = false
where district = 'Esenyurt' and rooms = '2+1' and m2 = 80 and price_usd = 115854;

update public.listings set
  description = 'ÇEKMEKÖYDE SATILIK 2+1 DAİRE',
  images = ARRAY['https://i0.shbdn.com/photos/69/08/99/big_1258690899u6h.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899ag2.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899zpv.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899d52.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899ihn.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_125869089943w.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_12586908991mn.jpg', 'https://i0.shbdn.com/photos/69/08/99/big_1258690899ie5.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/69/08/99/big_1258690899u6h.jpg',
  price_usd = 140934,
  citizenship = false
where district = 'Çekmeköy' and rooms = '2+1' and m2 = 90 and price_usd = 163415;

update public.listings set
  description = '2+1 Açık Mutfaklı Otoparklı Yüksek Giriş Oturuma Hazır

E-5''e 10dk yürüme mesafesindede﻿ 60m² net / 75m² brüt﻿ kullanım alanına sahip 2+1 Sıfır Daire. Binamızda Kapalı Otopark Mevcuttur Ferah cepheli, geniş mutfak ve konforlu yaşam alanına sahip; Yüksek Giriş Katı seçeneği ile. Kaçırılmayacak Bir Fırsattır, sosyal alanlara ve sahile yürüme mesafesinde; toplu taşımaya çok yakındır. Hem yatırım hem oturum için ideal fırsattır.',
  images = ARRAY['https://i0.shbdn.com/photos/75/33/45/big_130775334581o.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_1307753345ior.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_1307753345si9.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_13077533453ly.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_1307753345j88.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_13077533455lv.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_1307753345dtk.jpg', 'https://i0.shbdn.com/photos/75/33/45/big_130775334539a.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/75/33/45/big_130775334581o.jpg',
  price_usd = 91923,
  citizenship = false
where district = 'Avcılar' and rooms = '2+1' and m2 = 60 and price_usd = 106585;

update public.listings set
  description = 'ÖZGÜR İNŞAAT''TAN HASTANE MAH SIFIR 4+2 195M2 SIFIR DUBLEX DAİRE

ÇIKARTIYORUZ 4+2 195M2 DUBLEX DAİRE ULAŞIM',
  images = ARRAY['https://i0.shbdn.com/photos/66/58/75/big_1295665875303.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875jna.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875cxt.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875c4f.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875tvn.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875mj4.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_1295665875tle.jpg', 'https://i0.shbdn.com/photos/66/58/75/big_12956658752sm.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/66/58/75/big_1295665875303.jpg',
  price_usd = 94657,
  citizenship = false
where district = 'Arnavutköy' and rooms = '4+2' and m2 = 185 and price_usd = 109756;

update public.listings set
  description = 'ESENYALI ANA CADEYE ÇOK YAKIN ARSA PAYI GÜÇLÜYATIRIMLIK DAİRE',
  images = ARRAY['https://i0.shbdn.com/photos/96/20/05/big_13259620051a5.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005e3x.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005fu4.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005kt3.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005bt8.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_1325962005r1z.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_13259620059bu.jpg', 'https://i0.shbdn.com/photos/96/20/05/big_132596200507t.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/96/20/05/big_13259620051a5.jpg',
  price_usd = 58877,
  citizenship = false
where district = 'Pendik' and rooms = '2+1' and m2 = 85 and price_usd = 68268;

update public.listings set
  description = 'FIRSAT!..SATILIK METROYA YAKIN 2+1 BOŞ. DAİRE 22mt HİSSELİ

Bağcılar İnönü Mahallesi''nde, metroya yürüme mesafesinde, doğalgaz kombili satılık 2+1 daire! Dairemiz, konum olarak Bağcılar İnönü Mahallesi''nde, Molla Gürani Metro durağının hemen üst kısmında yer almaktadır. Bu merkezi konum, ulaşımı son derece kolaylaştırmaktadır. Molla Gürani Metro durağına sadece 5 dakika yürüme mesafesinde (Google Maps verisi) olması, şehrin her noktasına hızlı ve pratik bir ulaşım imkanı sunar.',
  images = ARRAY['https://i0.shbdn.com/photos/06/64/52/big_13000664527vi.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452g6y.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452sw9.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_13000664521db.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452as7.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452kd7.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452yi1.jpg', 'https://i0.shbdn.com/photos/06/64/52/big_1300066452n0d.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/06/64/52/big_13000664527vi.jpg',
  price_usd = 67312,
  citizenship = false
where district = 'Bağcılar' and rooms = '2+1' and m2 = 115 and price_usd = 78049;

update public.listings set
  description = '*MAS GAYRİMENKUL*DEN TOKİ 12C PROJESİNDE SATILIK 2+1 DAİRE️

MAS GAYRİMENKUL''den, TOKİ 12C Projesi''nde, Sarıgöl Mahallesi''nin kalbinde satılık 2+1 fırsatı! Gazi Osman Paşa''da merkezi bir konumda yer alan TOKİ 12C Projesi''nde, MAS GAYRİMENKUL güvencesiyle sizleri bekleyen bu özel 2+1 daire, konforlu ve modern bir yaşam sunuyor. Gayrimenkul alımlarında 100.000 km altı araçlar takas olarak kabul edilmekte olup, hızlı ve güvenilir değerleme hizmetimizle yanınızdayız.',
  images = ARRAY['https://i0.shbdn.com/photos/02/84/01/big_1323028401gj6.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401n48.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401sir.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401onk.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401nkj.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284019wk.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_1323028401efm.jpg', 'https://i0.shbdn.com/photos/02/84/01/big_13230284016h5.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/02/84/01/big_1323028401gj6.jpg',
  price_usd = 149348,
  citizenship = false
where district = 'Gaziosmanpaşa' and rooms = '2+1' and m2 = 70 and price_usd = 173171;

update public.listings set
  description = 'KELEPİR 2+1 ARAKAT DAİRE CADDENİN 2.PARSELİ

Isı Ve Ses Yalıtımı ile Yaz Kış Ferah ve Sessiz Led Spot ve Dekoratif Işıklandırma ile Şık ve Kullanış﻿lı﻿ Sevdiklerinizle Mutlu Zamanlar Geçirebileceğiniz Sosyal Alanlara Yakın Avrupa Yakasının Yatırım ve Yaşam Alanı Olarak En Çok Tercih Edilen Bölgesinde Hem Doğru Bir Yatırım Yapmak Hem de Satın Alırken Kazanmak İster misiniz?﻿ Birinci Kalite Malzemelerin Kullanıldığı ﻿Kaliteli ve Kazançlı Daireler ROZA EMLAK Güvencesiyle Profesyonel ve Güleryüzlü Ekibimizle Haftanın Yedi G…',
  images = ARRAY['https://i0.shbdn.com/photos/59/26/27/big_1317592627o3w.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627jn7.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627y32.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627shp.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627yvl.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_13175926279ri.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627xo1.jpg', 'https://i0.shbdn.com/photos/59/26/27/big_1317592627g85.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/59/26/27/big_1317592627o3w.jpg',
  price_usd = 56773,
  citizenship = false
where district = 'Esenyurt' and rooms = '2+1' and m2 = 85 and price_usd = 65829;

update public.listings set
  description = 'EMAAR AVM YAKINI GENÇ BİNADA SATILIK 100m² 2+1 DAİRE',
  images = ARRAY['https://i0.shbdn.com/photos/01/32/19/big_1329013219b7i.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219l3t.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219vis.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219j9a.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219ny3.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_13290132190ne.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_13290132195s6.jpg', 'https://i0.shbdn.com/photos/01/32/19/big_1329013219avf.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/01/32/19/big_1329013219b7i.jpg',
  price_usd = 178797,
  citizenship = false
where district = 'Üsküdar' and rooms = '2+1' and m2 = 100 and price_usd = 207317;

update public.listings set
  description = 'BÜYÜKÇEKMECE KAMİLOBADA ACİL SATILIK TRİBLEKS SIFIR VİLLA',
  images = ARRAY['https://i0.shbdn.com/photos/43/73/80/big_1319437380yby.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373800rj.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373803ao.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373801n1.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373802ot.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380ubd.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_13194373807yi.jpg', 'https://i0.shbdn.com/photos/43/73/80/big_1319437380ofg.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/43/73/80/big_1319437380yby.jpg',
  price_usd = 1472444,
  citizenship = true
where district = 'Büyükçekmece' and rooms = '10 Üzeri' and m2 = 450 and price_usd = 1707317;

update public.listings set
  description = 'sahibinden satılık geniş ferah 3+1 daire',
  images = ARRAY['https://i0.shbdn.com/photos/86/30/86/big_1331863086ged.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086y05.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630863mt.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086o69.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086417.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630869uo.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_1331863086t4e.jpg', 'https://i0.shbdn.com/photos/86/30/86/big_13318630867oy.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/86/30/86/big_1331863086ged.jpg',
  price_usd = 126210,
  citizenship = false
where district = 'Pendik' and rooms = '3+1' and m2 = 108 and price_usd = 146341;

update public.listings set
  description = 'ALİBEYKÖY''DE METROYA YAKIN FIRSAT 2+1 DAİRE',
  images = ARRAY['https://i0.shbdn.com/photos/07/66/18/big_1326076618djc.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618tsi.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618tdg.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618jhr.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_132607661892x.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766181dd.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_1326076618gt4.jpg', 'https://i0.shbdn.com/photos/07/66/18/big_13260766181k0.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/07/66/18/big_1326076618djc.jpg',
  price_usd = 94657,
  citizenship = false
where district = 'Eyüpsultan' and rooms = '2+1' and m2 = 70 and price_usd = 109756;

update public.listings set
  description = 'MALTEPE CEVİZLİ MAH MİNÜBÜS YOLU ÜZERİNDE SATILIK 2+1 DAİRE

''''TEK YETKİLİ'''' ASANSÖR • BALKONLU • • AÇIK MUTFAK • • • • • • • AVM',
  images = ARRAY['https://i0.shbdn.com/photos/76/01/69/big_1297760169o90.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169dlj.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169ibo.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_12977601694an.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169euj.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_12977601693vr.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169gjg.jpg', 'https://i0.shbdn.com/photos/76/01/69/big_1297760169u6h.jpg']::text[],
  image = 'https://i0.shbdn.com/photos/76/01/69/big_1297760169o90.jpg',
  price_usd = 149348,
  citizenship = false
where district = 'Maltepe' and rooms = '2+1' and m2 = 60 and price_usd = 173171;
