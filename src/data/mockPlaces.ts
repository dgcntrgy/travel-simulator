import type { FeaturedCode } from "@/data/airports";
import type { Place, PlaceCategory } from "@/types/trip";

/** Unsplash CDN görseli (API anahtarı gerektirmez) */
const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=75`;

export const CATEGORY_META: Record<PlaceCategory, { label: string; short: string; color: string }> = {
  sight: { label: "Gezilecek Yerler", short: "Gezi", color: "#38bdf8" },
  food: { label: "Ne Yenir? (Lezzet Durakları)", short: "Lezzet", color: "#fb923c" },
  culture: { label: "Kültür & Deneyim", short: "Kültür", color: "#c084fc" },
};

/** Bir günde rahatça gezilebilecek ortalama süre (saat) */
export const HOURS_PER_DAY = 7;

/** Seçilen mekanların toplam süresine göre tahmini gezi günü (en az 1) */
export function estimateTripDays(places: Pick<Place, "recommendedDuration">[]): number {
  if (places.length === 0) return 0;
  const hours = places.reduce((sum, p) => sum + p.recommendedDuration, 0);
  return Math.max(1, Math.ceil(hours / HOURS_PER_DAY));
}

/**
 * Her hedef için mekanlar ülkenin 2 farklı şehrine dağıtılmıştır;
 * Adım 3'teki "X gün şu şehirde, Y gün bu şehirde" kümelemesi bu ayrıma dayanır.
 */
export const PLACES_BY_DESTINATION: Record<FeaturedCode, Place[]> = {
  // ---------------- Japonya: Tokyo + Kyoto ----------------
  HND: [
    {
      id: "jp-sensoji",
      name: "Sensō-ji Tapınağı",
      wikiTitle: "Sensō-ji",
      cityRegion: "Tokyo",
      category: "sight",
      coordinates: [139.7967, 35.7148],
      story:
        "Efsaneye göre 628 yılında iki balıkçı kardeş Sumida Nehri'nden altın bir Kannon heykeli çıkardı ve bu tapınak onun için kuruldu. Tokyo'nun en eski tapınağı, devasa kırmızı Kaminarimon fenerinin altından geçerek Asakusa'nın Edo dönemi ruhuna açılır.",
      mustDo:
        "Turist kalabalığından önce, sabah 08:00'den önce gidin. Nakamise caddesinde sıcak ningyō-yaki (kırmızı fasulyeli kek) deneyin; 100 yenlik omikuji kehanet kağıdınız kötü çıkarsa tapınak bahçesindeki tellere bağlayın.",
      estimatedCost: 0,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1545569341-9eb8b30979d9"),
    },
    {
      id: "jp-shibuya",
      name: "Shibuya Kavşağı",
      wikiTitle: "Shibuya_Crossing",
      cityRegion: "Tokyo",
      category: "sight",
      coordinates: [139.7005, 35.6595],
      story:
        "Yeşil ışık yandığında her yönden aynı anda 2.500'e kadar insanın karşıya geçtiği dünyanın en yoğun yaya kavşağı. Neon ekranlar, sadık köpek Hachikō'nun heykeli ve sonsuz insan akışı Tokyo'nun modern nabzını tek karede özetler.",
      mustDo:
        "Kavşağı en iyi Shibuya Sky (ücretli) ya da ücretsiz Magnet by Shibuya109 terasından izleyin. Akşam 19:00 civarı neonlar en parlak hâlindeyken kavşaktan siz de bir tur geçin.",
      estimatedCost: 15,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1542051841857-5f90071e7989"),
    },
    {
      id: "jp-meiji",
      name: "Meiji Tapınağı",
      wikiTitle: "Meiji_Shrine",
      cityRegion: "Tokyo",
      category: "culture",
      coordinates: [139.6993, 35.6764],
      story:
        "Japonya'yı modernleştiren İmparator Meiji ve eşine adanan bu Şinto tapınağı, ülkenin dört bir yanından bağışlanan 100.000 ağaçla dikilmiş yapay bir ormanın içinde saklıdır. Harajuku'nun hemen yanında, şehrin gürültüsünün aniden kesildiği bir sükunet adası.",
      mustDo:
        "Girişteki dev torii kapısında hafifçe eğilin, temizlenme çeşmesinde önce sol sonra sağ elinizi yıkayın. Hafta sonu sabahları geleneksel Şinto düğün alaylarına denk gelebilirsiniz.",
      estimatedCost: 0,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1583416750470-965b2707b355"),
    },
    {
      id: "jp-tsukiji",
      name: "Tsukiji Dış Pazarı",
      wikiTitle: "Tsukiji_fish_market",
      cityRegion: "Tokyo",
      category: "food",
      coordinates: [139.7707, 35.6655],
      story:
        "Toptan balık mezatı Toyosu'ya taşınsa da dış pazar, 80 yılı aşkın geleneğiyle yaşamaya devam ediyor. Dar sokaklardaki 400'den fazla dükkan; taze suşi, tamagoyaki ve ızgara deniz ürünleriyle Tokyo'nun mutfağı gibi çalışır.",
      mustDo:
        "Sabah 07:00–10:00 arası gidin, öğleden sonra çoğu tezgah kapanır. Taze uni (deniz kestanesi) ve 'tamagoyaki' çubuğu deneyin; yürürken yemek ayıp sayılır, tezgâhın önünde bitirin.",
      estimatedCost: 30,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1579871494447-9811cf80d66c"),
    },
    {
      id: "jp-goldengai",
      name: "Shinjuku Golden Gai",
      wikiTitle: "Golden_Gai",
      cityRegion: "Tokyo",
      category: "food",
      coordinates: [139.7046, 35.6938],
      story:
        "Altı dar sokağa sıkışmış 200'den fazla minicik bar; çoğu yalnızca 5–8 kişi alır. Savaş sonrası karaborsa döneminden kalan bu labirent, bir zamanlar yazarların ve film yönetmenlerinin gizli buluşma yeriydi.",
      mustDo:
        "Önce yakındaki Omoide Yokochō'da yakitori ve ramen ile karnınızı doyurun. Bazı barlar ¥500–1000 'masa ücreti' alır; kapıdaki 'Welcome' tabelasına bakın ve yanınızda nakit bulundurun.",
      estimatedCost: 25,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1554797589-7241bb691973"),
    },
    {
      id: "jp-fushimi",
      name: "Fushimi Inari Taisha",
      wikiTitle: "Fushimi_Inari-taisha",
      cityRegion: "Kyoto",
      category: "sight",
      coordinates: [135.7727, 34.9671],
      story:
        "Pirinç ve bereket tanrısı Inari'ye adanan tapınakta, işletmelerin bağışladığı 10.000'i aşkın turuncu torii kapısı İnari Dağı'na doğru kilometrelerce tünel oluşturur. Her kapının arkasında bağışçının adı ve tarihi yazılıdır.",
      mustDo:
        "Sabah 08:00'den önce gidin ya da gün batımında yürüyün; ilk 15 dakikadan sonra kalabalık dramatik şekilde azalır. Yokkatsuji kavşağındaki Kyoto manzarası tırmanışın tam karşılığıdır. 7/24 açık ve ücretsizdir.",
      estimatedCost: 0,
      recommendedDuration: 3,
      fallbackImage: unsplash("photo-1478436127897-769e1b3f0f36"),
    },
    {
      id: "jp-arashiyama",
      name: "Arashiyama Bambu Ormanı",
      wikiTitle: "Arashiyama",
      cityRegion: "Kyoto",
      category: "sight",
      coordinates: [135.6727, 35.017],
      story:
        "Heian dönemi aristokratlarının yazlık kaçış yeri olan Arashiyama'da, gökyüzüne uzanan bambu sapları rüzgârda hışırdayarak Japonya hükümetinin 'korunması gereken 100 ses' listesine girmiştir. Hemen yanındaki Tenryū-ji bahçesi UNESCO mirasıdır.",
      mustDo:
        "Sabah 07:30'dan önce gidin; 09:00'dan sonra yol fotoğraf çekilemeyecek kadar dolar. Ardından Togetsukyō Köprüsü'ne yürüyün ve nehir kenarında yudofu (haşlanmış tofu) öğle yemeği yiyin.",
      estimatedCost: 5,
      recommendedDuration: 3,
      fallbackImage: unsplash("photo-1528360983277-13d401cdc186"),
    },
    {
      id: "jp-nishiki",
      name: "Nishiki Pazarı",
      wikiTitle: "Nishiki_Market",
      cityRegion: "Kyoto",
      category: "food",
      coordinates: [135.7649, 35.005],
      story:
        "400 yılı aşkın geçmişiyle 'Kyoto'nun Mutfağı' denen bu dar çarşı, beş blok boyunca 100'den fazla dükkânı barındırır. İmparatorluk sarayına balık tedarik eden tezgâhlarla başlayan gelenek bugün de sürüyor.",
      mustDo:
        "Şişte tako-tamago (içine bıldırcın yumurtası doldurulmuş bebek ahtapot), taze mochi ve matcha dondurma deneyin. Pazar 10:00–17:00 arası açık; yürürken yemek yasak, dükkânın önünde durup yiyin.",
      estimatedCost: 20,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1569718212165-3a8278d5f624"),
    },
    {
      id: "jp-gion",
      name: "Gion & Çay Seremonisi",
      wikiTitle: "Gion",
      cityRegion: "Kyoto",
      category: "culture",
      coordinates: [135.7756, 35.0037],
      story:
        "Ahşap machiya evleri ve taş döşeli Hanamikoji sokağıyla Gion, Japonya'nın en ünlü geyşa bölgesidir. Akşam karanlığında fenerler yandığında, bir maiko'nun ahşap getaları ile sessizce geçtiğini görebilirsiniz.",
      mustDo:
        "Bir machiya evinde geleneksel çay seremonisine katılın (yaklaşık 1 saat). Geyşaları asla durdurmayın veya izinsiz fotoğraflamayın; bazı özel sokaklarda fotoğraf çekmenin cezası ¥10.000'dir.",
      estimatedCost: 35,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1493976040374-85c8e12f0c0e"),
    },
  ],

  // ---------------- İtalya: Roma + Floransa ----------------
  FCO: [
    {
      id: "it-colosseum",
      name: "Kolezyum",
      wikiTitle: "Colosseum",
      cityRegion: "Roma",
      category: "sight",
      coordinates: [12.4922, 41.8902],
      story:
        "MS 80'de açıldığında 50.000 seyirci alan bu amfitiyatroda gladyatör dövüşleri, vahşi hayvan avları ve hatta deniz savaşı canlandırmaları yapıldı. Yaklaşık 2.000 yıl sonra bile Roma İmparatorluğu'nun gücünün en çarpıcı simgesi.",
      mustDo:
        "Biletleri resmi siteden en az bir hafta önce, Roma Forumu ve Palatino ile birlikte kombine alın. Yeraltı (hypogeum) turu gladyatörlerin arenaya çıktığı tünelleri gösterir — kesinlikle değer.",
      estimatedCost: 24,
      recommendedDuration: 3,
      fallbackImage: unsplash("photo-1552832230-c0197dd311b5"),
    },
    {
      id: "it-trevi",
      name: "Trevi Çeşmesi",
      wikiTitle: "Trevi_Fountain",
      cityRegion: "Roma",
      category: "sight",
      coordinates: [12.4833, 41.9009],
      story:
        "Antik Aqua Virgo su kemerinin bitiş noktasına 1762'de inşa edilen bu Barok başyapıt, deniz tanrısı Okeanos'u at arabasında tasvir eder. Her gün çeşmeye atılan yaklaşık 3.000 Euro, Roma'daki yoksullara bağışlanır.",
      mustDo:
        "Sırtınızı çeşmeye dönüp sağ elinizle sol omzunuzun üzerinden bir bozuk para atın — efsaneye göre Roma'ya geri dönersiniz. Sabah 07:00'de neredeyse boş olur; gece ışıklandırması ise ayrı bir büyü.",
      estimatedCost: 0,
      recommendedDuration: 0.5,
      fallbackImage: unsplash("photo-1525874684015-58379d421a52"),
    },
    {
      id: "it-vatican",
      name: "Vatikan Müzeleri & Sistina Şapeli",
      wikiTitle: "Vatican_Museums",
      cityRegion: "Roma",
      category: "culture",
      coordinates: [12.4545, 41.9065],
      story:
        "Papaların beş yüz yıl boyunca biriktirdiği 70.000 eserlik koleksiyon, 7 kilometrelik galerilerden geçerek Michelangelo'nun Sistina Şapeli tavanında doruğa ulaşır. Michelangelo bu freski dört yıl boyunca iskelede ayakta çalışarak tamamladı.",
      mustDo:
        "Sistina Şapeli'nde fotoğraf çekmek ve konuşmak yasaktır. Ayın son Pazar günü giriş ücretsizdir ama kuyruk çok uzundur; bunun yerine Cuma akşamı açılışlarını tercih edin. Omuz ve dizleriniz kapalı olsun.",
      estimatedCost: 22,
      recommendedDuration: 4,
      fallbackImage: unsplash("photo-1531572753322-ad063cecc140"),
    },
    {
      id: "it-pantheon",
      name: "Pantheon",
      wikiTitle: "Pantheon,_Rome",
      cityRegion: "Roma",
      category: "sight",
      coordinates: [12.4769, 41.8986],
      story:
        "İmparator Hadrianus döneminde inşa edilen Pantheon'un kubbesi, yaklaşık 1.900 yıl sonra hâlâ dünyanın en büyük donatısız beton kubbesidir. Tepedeki 9 metrelik 'oculus' açıklığından içeri giren güneş ışını, gün boyunca iç mekânda bir saat gibi dolaşır.",
      mustDo:
        "Yağmurlu bir günde gidip oculus'tan içeri düşen yağmuru izleyin. Çıkışta yandaki Tazza d'Oro'da 'granita di caffè' (kremalı buzlu kahve) için durun.",
      estimatedCost: 6,
      recommendedDuration: 1,
      fallbackImage: unsplash("photo-1529260830199-42c24126f198"),
    },
    {
      id: "it-trastevere",
      name: "Trastevere Trattoria Turu",
      wikiTitle: "Trastevere",
      cityRegion: "Roma",
      category: "food",
      coordinates: [12.47, 41.8894],
      story:
        "Tiber Nehri'nin 'öte yakası' anlamına gelen Trastevere, sarmaşıklı arnavut kaldırımlı sokakları ve aile işletmesi trattoria'larıyla Roma'nın en otantik mahallesidir. Burada yemek, sabaha kadar süren bir sosyal ritüeldir.",
      mustDo:
        "Romalıların dört klasik makarnasını deneyin: cacio e pepe, carbonara, amatriciana ve gricia. Akşam yemeği için Romalılar 20:30'dan önce oturmaz; menüsü fotoğraflı ve kapıda garson çağıran yerlerden uzak durun.",
      estimatedCost: 35,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1621996346565-e3dbc646d9a9"),
    },
    {
      id: "it-duomo",
      name: "Floransa Katedrali (Duomo)",
      wikiTitle: "Florence_Cathedral",
      cityRegion: "Floransa",
      category: "sight",
      coordinates: [11.256, 43.7731],
      story:
        "Brunelleschi, iskelesiz inşa edilen bu dev kırmızı kubbeyi 1436'da tamamladığında mühendislik dünyasını hayrete düşürdü. 4 milyon tuğladan oluşan kubbe, Rönesans'ın doğuşunun sembolü olarak kabul edilir.",
      mustDo:
        "463 basamaklı kubbe tırmanışı için önceden saatli rezervasyon yapın. Hemen karşısındaki Giotto'nun Çan Kulesi daha az kalabalıktır ve fotoğraflarınızda kubbenin kendisini görmenizi sağlar.",
      estimatedCost: 30,
      recommendedDuration: 2.5,
      fallbackImage: unsplash("photo-1476362174823-3a23f4aa6d76"),
    },
    {
      id: "it-uffizi",
      name: "Uffizi Galerisi",
      wikiTitle: "Uffizi",
      cityRegion: "Floransa",
      category: "culture",
      coordinates: [11.2553, 43.7678],
      story:
        "Medici ailesinin ofisleri olarak 1560'ta inşa edilen Uffizi, bugün Botticelli'nin 'Venüs'ün Doğuşu' ve Leonardo da Vinci'nin erken dönem eserleri dahil Rönesans sanatının en zengin koleksiyonunu barındırır.",
      mustDo:
        "Biletinizi online alıp sabah ilk seansa gidin. Galerinin sonundaki terasta kahve molası verin; Palazzo Vecchio ve Duomo manzarası müzenin en gizli hazinesidir.",
      estimatedCost: 28,
      recommendedDuration: 3,
      fallbackImage: unsplash("photo-1541370976299-4d24ebbc9077"),
    },
    {
      id: "it-mercato",
      name: "Mercato Centrale",
      wikiTitle: "Mercato_Centrale_(Florence)",
      cityRegion: "Floransa",
      category: "food",
      coordinates: [11.2534, 43.7764],
      story:
        "1874'te demir ve camdan inşa edilen bu tarihi pazar binası, zemin katta kasap ve peynircileri, üst katta ise Toskana mutfağının ustalarını buluşturan bir yemek salonunu barındırır.",
      mustDo:
        "Floransa'nın efsanevi sokak yemeği 'lampredotto' (işkembe sandviçi, yeşil sosla) deneyin ya da cesaretiniz yoksa trüf yağlı panino alın. Zemin kattaki Nerbone tezgâhı 1872'den beri açık.",
      estimatedCost: 18,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1534308983496-4fabb1a015ee"),
    },
  ],

  // ---------------- Fransa: Paris + Nice ----------------
  CDG: [
    {
      id: "fr-eiffel",
      name: "Eyfel Kulesi",
      wikiTitle: "Eiffel_Tower",
      cityRegion: "Paris",
      category: "sight",
      coordinates: [2.2945, 48.8584],
      story:
        "1889 Dünya Fuarı için 'geçici' olarak inşa edildi ve dönemin sanatçıları tarafından 'çirkin bir demir iskelet' diye protesto edildi. Telsiz anteni olarak işe yaradığı için yıkılmaktan kurtuldu ve bugün yılda 7 milyon ziyaretçiyle Paris'in kalbi.",
      mustDo:
        "Asansör yerine 2. kata kadar merdivenle çıkın — daha ucuz ve kuyruk kısa. Gece her saat başında 5 dakikalık ışık gösterisini Trocadéro'dan izleyin; en iyi fotoğraf açısı oradadır.",
      estimatedCost: 30,
      recommendedDuration: 2.5,
      fallbackImage: unsplash("photo-1502602898657-3e91760cbb34"),
    },
    {
      id: "fr-louvre",
      name: "Louvre Müzesi",
      wikiTitle: "Louvre",
      cityRegion: "Paris",
      category: "culture",
      coordinates: [2.3376, 48.8606],
      story:
        "12. yüzyılda bir kale olarak başlayan, sonra Fransız krallarının sarayı olan Louvre, bugün dünyanın en çok ziyaret edilen müzesi. 35.000 eserin her birine 30 saniye baksanız, hepsini görmek 100 gün sürer.",
      mustDo:
        "Piramit yerine Carrousel du Louvre girişini kullanın, kuyruk çok daha kısa. Mona Lisa'dan önce Winged Victory (Semadirek Nike'si) ve Venüs de Milo'yu görün. Cuma akşamları 21:45'e kadar açık.",
      estimatedCost: 24,
      recommendedDuration: 4,
      fallbackImage: unsplash("photo-1499856871958-5b9627545d1a"),
    },
    {
      id: "fr-notredame",
      name: "Notre-Dame Katedrali",
      wikiTitle: "Notre-Dame_de_Paris",
      cityRegion: "Paris",
      category: "sight",
      coordinates: [2.3499, 48.853],
      story:
        "850 yıllık Gotik başyapıt, 2019'daki yıkıcı yangının ardından yeniden ayağa kaldırıldı ve Aralık 2024'te kapılarını yeniden açtı. Victor Hugo'nun 'Notre-Dame'ın Kamburu' romanı, 19. yüzyılda katedralin kurtarılmasına ilham vermişti.",
      mustDo:
        "Giriş ücretsizdir ama online saat rezervasyonu kuyruğu kısaltır. Ardından Seine'nin karşı kıyısındaki efsanevi kitapçı Shakespeare and Company'ye uğrayın.",
      estimatedCost: 0,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1478391679764-b2d8b3cd1e94"),
    },
    {
      id: "fr-montmartre",
      name: "Montmartre & Sacré-Cœur",
      wikiTitle: "Sacré-Cœur,_Paris",
      cityRegion: "Paris",
      category: "culture",
      coordinates: [2.3431, 48.8867],
      story:
        "Picasso, Van Gogh ve Toulouse-Lautrec'in yoksul ama üretken yıllarını geçirdiği tepe, beyaz kubbeli Sacré-Cœur Bazilikası ile taçlanır. Bazilikanın taşları yağmurla temas ettikçe kendini temizleyerek bembeyaz kalır.",
      mustDo:
        "Place du Tertre'deki ressamlardan bir portre yaptırın (pazarlık yapın, ~€30). Merdivenlerdeki 'bileklik' satıcılarına kolunuzu uzatmayın. Gün batımında basamaklara oturup Paris manzarasını izleyin.",
      estimatedCost: 0,
      recommendedDuration: 2.5,
      fallbackImage: unsplash("photo-1550340499-a6c60fc8287c"),
    },
    {
      id: "fr-marais",
      name: "Le Marais Lezzet Turu",
      wikiTitle: "Le_Marais",
      cityRegion: "Paris",
      category: "food",
      coordinates: [2.3622, 48.859],
      story:
        "Haussmann'ın büyük bulvarlarından kurtulan nadir mahallelerden biri olan Le Marais'nin ortaçağ sokakları, aristokrat konakları, butik dükkanları ve Paris'in en iyi sokak lezzetlerini barındırır.",
      mustDo:
        "Rue des Rosiers'de L'As du Fallafel'den falafel alın, ardından Paris'in en eski kapalı pazarı Marché des Enfants Rouges'da öğle yemeği yiyin. Tatlı için bir boulangerie'den sıcak pain au chocolat şart.",
      estimatedCost: 25,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1509440159596-0249088772ff"),
    },
    {
      id: "fr-promenade",
      name: "Promenade des Anglais",
      wikiTitle: "Promenade_des_Anglais",
      cityRegion: "Nice",
      category: "sight",
      coordinates: [7.262, 43.695],
      story:
        "1820'lerde kışı Nice'te geçiren İngiliz aristokratların finanse ettiği 7 km'lik sahil yolu, Fransız Rivierası'nın masmavi Baie des Anges koyunu kucaklar. Mavi sandalyeleri şehrin simgesi hâline gelmiştir.",
      mustDo:
        "Bir Vélo Bleu bisikleti kiralayıp sahil boyunca pedal çevirin. Gün batımında Castle Hill'e (Colline du Château) çıkın ve ücretsiz şelaleden körfezin panoramik manzarasını izleyin.",
      estimatedCost: 0,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1491166617655-0723a0999cfc"),
    },
    {
      id: "fr-saleya",
      name: "Cours Saleya Pazarı",
      wikiTitle: "Socca",
      cityRegion: "Nice",
      category: "food",
      coordinates: [7.2757, 43.6955],
      story:
        "Eski Nice'in kalbindeki bu renkli meydan, sabahları çiçek ve Provence ürünleri pazarına, akşamları ise açık hava restoranlarına dönüşür. Henri Matisse, 17 yıl boyunca meydana bakan sarı binada yaşadı.",
      mustDo:
        "Nice'e özgü 'socca' (nohut unundan ince krep) için Chez Thérésa tezgâhına gidin, sıcakken ve bol karabiberle yenir. Pazartesi günleri pazar antikacılara dönüşür.",
      estimatedCost: 15,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1488459716781-31db52582fe9"),
    },
    {
      id: "fr-eze",
      name: "Èze Kartal Yuvası Köyü",
      wikiTitle: "Èze",
      cityRegion: "Nice",
      category: "culture",
      coordinates: [7.3615, 43.728],
      story:
        "Deniz seviyesinden 427 metre yüksekte bir kayanın tepesine kurulmuş bu ortaçağ köyü, korsanlardan korunmak için inşa edildi. Filozof Nietzsche, 'Böyle Buyurdu Zerdüşt'ün bir bölümünü buradan sahile inen patikada tasarladı.",
      mustDo:
        "Nice'ten 82 numaralı otobüsle (€2) gidin. Tepedeki egzotik bahçeden Akdeniz manzarasını izleyin, dönüşte Nietzsche Patikası'ndan sahile yürüyerek inin (~1 saat). Fragonard parfüm atölyesi ücretsiz tur verir.",
      estimatedCost: 8,
      recommendedDuration: 3,
      fallbackImage: unsplash("photo-1533104816931-20fa691ff6ca"),
    },
  ],

  // ---------------- ABD: New York + Washington D.C. ----------------
  JFK: [
    {
      id: "us-liberty",
      name: "Özgürlük Heykeli",
      wikiTitle: "Statue_of_Liberty",
      cityRegion: "New York",
      category: "sight",
      coordinates: [-74.0445, 40.6892],
      story:
        "Fransa'nın 1886'da ABD'ye hediye ettiği heykelin iç iskeletini Gustave Eiffel tasarladı. Ellis Adası'ndan geçen 12 milyon göçmen için Amerika'nın ilk görüntüsü oldu; bakır yüzeyi zamanla oksitlenerek bugünkü yeşil rengini aldı.",
      mustDo:
        "Taç kısmına çıkış biletleri aylar önce tükenir, erken ayırın. Bütçe dostu alternatif: ücretsiz Staten Island Feribotu ile heykelin önünden geçin ve harika fotoğraflar çekin.",
      estimatedCost: 25,
      recommendedDuration: 4,
      fallbackImage: unsplash("photo-1485738422979-f5c462d49f74"),
    },
    {
      id: "us-centralpark",
      name: "Central Park",
      wikiTitle: "Central_Park",
      cityRegion: "New York",
      category: "sight",
      coordinates: [-73.9654, 40.7829],
      story:
        "Manhattan'ın ortasındaki 341 hektarlık bu park tamamen insan yapımıdır; 1850'lerde bataklık ve kayalık arazi, 10 milyon araba yükü toprak taşınarak şekillendirildi. Yılda 42 milyon ziyaretçiyle dünyanın en çok film çekilen parkı.",
      mustDo:
        "Bethesda Terrace ve Bow Bridge'i görün, sonra Strawberry Fields'daki John Lennon anıtına uğrayın. Bisiklet kiralayıp 10 km'lik ana döngüyü 1 saatte turlayın.",
      estimatedCost: 0,
      recommendedDuration: 2.5,
      fallbackImage: unsplash("photo-1534270804882-6b5048b1c1fc"),
    },
    {
      id: "us-met",
      name: "Metropolitan Sanat Müzesi",
      wikiTitle: "Metropolitan_Museum_of_Art",
      cityRegion: "New York",
      category: "culture",
      coordinates: [-73.9632, 40.7794],
      story:
        "Batı yarımkürenin en büyük sanat müzesi, 5.000 yıllık insanlık tarihini kapsayan 2 milyon eseri barındırır. İçindeki tam boyutlu Mısır Dendur Tapınağı, Asvan Barajı'nın suları altında kalmaktan kurtarılıp taş taş buraya taşındı.",
      mustDo:
        "Cuma ve Cumartesi 21:00'e kadar açık. Mayıs–Ekim arası çatı bahçesinde Central Park manzarasıyla bir içecek alın. Bilet 3 gün geçerli, tek seferde bitirmeye çalışmayın.",
      estimatedCost: 30,
      recommendedDuration: 3.5,
      fallbackImage: unsplash("photo-1575223970966-76ae61ee7838"),
    },
    {
      id: "us-brooklyn",
      name: "Brooklyn Köprüsü",
      wikiTitle: "Brooklyn_Bridge",
      cityRegion: "New York",
      category: "sight",
      coordinates: [-73.9969, 40.7061],
      story:
        "1883'te açıldığında dünyanın en uzun asma köprüsüydü. Mühendis John Roebling inşaatın başında öldü, oğlu Washington felç olunca köprüyü eşi Emily Roebling 11 yıl boyunca fiilen yönetti.",
      mustDo:
        "Brooklyn tarafından Manhattan'a doğru yürüyün; silüet hep karşınızda olur. Önce DUMBO'da Washington Street'teki ikonik Manhattan Köprüsü fotoğrafını çekin, gündoğumunda neredeyse boştur.",
      estimatedCost: 0,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1496442226666-8d4d0e62e6e9"),
    },
    {
      id: "us-katz",
      name: "Katz's Delicatessen",
      wikiTitle: "Katz's_Delicatessen",
      cityRegion: "New York",
      category: "food",
      coordinates: [-73.9874, 40.7223],
      story:
        "1888'den beri Lower East Side'da hizmet veren efsanevi Yahudi şarküteri; 'Harry ile Sally Tanışınca' filmindeki ünlü sahnenin çekildiği masa hâlâ tabelayla işaretli. Pastırma (pastrami) burada 30 gün boyunca kürlenir.",
      mustDo:
        "Girişte verilen kağıt bileti kaybetmeyin — çıkışta ödeme için şart, kaybederseniz ceza ödersiniz. Tezgâhtan sipariş verin ve kesiciye bahşiş bırakın; size bir tadım dilimi uzatacaktır. Pastrami on rye istemeniz yeter.",
      estimatedCost: 32,
      recommendedDuration: 1,
      fallbackImage: unsplash("photo-1553909489-cd47e0907980"),
    },
    {
      id: "us-lincoln",
      name: "Lincoln Anıtı & National Mall",
      wikiTitle: "Lincoln_Memorial",
      cityRegion: "Washington D.C.",
      category: "sight",
      coordinates: [-77.0502, 38.8893],
      story:
        "Antik Yunan tapınağı biçimindeki anıtın 36 sütunu, Lincoln öldüğünde Birlik'teki 36 eyaleti temsil eder. Martin Luther King Jr., 1963'te 'Bir Hayalim Var' konuşmasını bu basamaklardan yaptı; tam durduğu yer işaretlidir.",
      mustDo:
        "Gece ziyaret edin: ışıklandırılmış anıt ve Reflecting Pool'dan Washington Anıtı manzarası büyüleyicidir. 24 saat açık ve ücretsiz. Mall'u yürümek yerine Capital Bikeshare bisikleti kiralayın.",
      estimatedCost: 0,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1501466044931-62695aada8e9"),
    },
    {
      id: "us-airspace",
      name: "Smithsonian Hava ve Uzay Müzesi",
      wikiTitle: "National_Air_and_Space_Museum",
      cityRegion: "Washington D.C.",
      category: "culture",
      coordinates: [-77.0199, 38.8882],
      story:
        "Wright Kardeşler'in 1903 uçağından Apollo 11 komuta modülü Columbia'ya kadar insanlığın uçuş tarihini barındırır. Ziyaretçilerin dokunabildiği nadir Ay taşlarından biri burada sergilenir.",
      mustDo:
        "Giriş ücretsizdir ancak online saatli bilet gerekir. Tüm Smithsonian müzeleri ücretsizdir; zamanınız varsa Virginia'daki Udvar-Hazy şubesinde Discovery uzay mekiğini görün.",
      estimatedCost: 0,
      recommendedDuration: 3,
      fallbackImage: unsplash("photo-1517976487492-5750f3195933"),
    },
    {
      id: "us-benschili",
      name: "Ben's Chili Bowl",
      wikiTitle: "Ben's_Chili_Bowl",
      cityRegion: "Washington D.C.",
      category: "food",
      coordinates: [-77.0289, 38.917],
      story:
        "1958'de U Street'te açılan bu restoran, 1968 ayaklanmalarında açık kalmasına izin verilen nadir yerlerdendi ve sivil haklar hareketinin buluşma noktası oldu. Barack Obama göreve başlamadan önce burada yemek yedi.",
      mustDo:
        "Efsanevi 'Half-Smoke' sosisini acı biber sosu (chili), hardal ve soğanla sipariş edin. Duvardaki 'Bedava yiyenler' listesine bakın: Bill Cosby'nin adı silindi, Obama ailesi hâlâ orada.",
      estimatedCost: 15,
      recommendedDuration: 1,
      fallbackImage: unsplash("photo-1561758033-d89a9ad46330"),
    },
  ],

  // ---------------- Güney Kore: Seul + Busan ----------------
  ICN: [
    {
      id: "kr-gyeongbok",
      name: "Gyeongbokgung Sarayı",
      wikiTitle: "Gyeongbokgung",
      cityRegion: "Seul",
      category: "culture",
      coordinates: [126.977, 37.5796],
      story:
        "1395'te Joseon Hanedanı'nın ana sarayı olarak inşa edildi, Japon işgali döneminde büyük bölümü yıkıldı ve onlarca yıllık restorasyonla yeniden ayağa kaldırıldı. Kuzeyinde Bugaksan Dağı, güneyinde modern Seul — geçmiş ile bugün yan yana.",
      mustDo:
        "Yakındaki dükkânlardan hanbok (geleneksel kıyafet) kiralayın: hanbok giyenlere giriş ücretsizdir! Saat 10:00 ve 14:00'teki muhafız değişimi törenini kaçırmayın. Salı günleri kapalı.",
      estimatedCost: 3,
      recommendedDuration: 2.5,
      fallbackImage: unsplash("photo-1538669715315-155098f0fb1d"),
    },
    {
      id: "kr-bukchon",
      name: "Bukchon Hanok Köyü",
      wikiTitle: "Bukchon_Hanok_Village",
      cityRegion: "Seul",
      category: "sight",
      coordinates: [126.985, 37.5826],
      story:
        "İki saray arasına sıkışmış bu tepe mahallesi, 600 yıllık geçmişe sahip yüzlerce geleneksel hanok evini barındırır. Kiremit çatılar ve dar sokaklar, gökdelenlerin arasında zamanın donduğu bir an gibidir.",
      mustDo:
        "Burada gerçek insanlar yaşıyor: sessiz olun. 2024'ten beri ziyaret saatleri 10:00–17:00 ile sınırlı, bu saatler dışında giriş cezaya tabi. Bukchon 3-gil sokağı en ikonik fotoğraf noktasıdır.",
      estimatedCost: 0,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1517154421773-0529f29ea451"),
    },
    {
      id: "kr-gwangjang",
      name: "Gwangjang Pazarı",
      wikiTitle: "Gwangjang_Market",
      cityRegion: "Seul",
      category: "food",
      coordinates: [126.9996, 37.57],
      story:
        "1905'te açılan Kore'nin ilk kalıcı pazarı, bugün 'Netflix Street Food' belgeselinde ünlenen yemek tezgâhlarıyla bilinir. Pazar teyzelerinin (ajumma) önünde oturup yemek, Seul'un en otantik deneyimidir.",
      mustDo:
        "Bindaetteok (çekilmiş maş fasulyesinden çıtır krep), mayak gimbap ('bağımlılık yapan' mini suşi rulo) ve yukhoe (çiğ dana tartar) deneyin. Tezgâhlar nakit tercih eder; yanınızda won bulundurun.",
      estimatedCost: 15,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1590301157890-4810ed352733"),
    },
    {
      id: "kr-namsan",
      name: "N Seul Kulesi",
      wikiTitle: "N_Seoul_Tower",
      cityRegion: "Seul",
      category: "sight",
      coordinates: [126.9882, 37.5512],
      story:
        "Namsan Dağı'nın tepesindeki kule, 1969'da yayın kulesi olarak inşa edildi ve 1980'de halka açıldı. Çiftlerin ebedi aşklarını simgelemek için taktıkları on binlerce 'aşk kilidi' terasları süsler.",
      mustDo:
        "Teleferik yerine Namsan yürüyüş parkurundan çıkın (30 dk, ücretsiz). Gece Seul'un ışıklı manzarası muhteşemdir; kilit asmak isterseniz kilidi aşağıdan getirin, tepede daha pahalı.",
      estimatedCost: 20,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1546874177-9e664107314e"),
    },
    {
      id: "kr-myeongdong",
      name: "Myeongdong Sokak Lezzetleri",
      wikiTitle: "Myeong-dong",
      cityRegion: "Seul",
      category: "food",
      coordinates: [126.985, 37.5636],
      story:
        "Gündüzleri K-beauty mağazalarının başkenti olan Myeongdong, akşam 17:00'den itibaren yüzlerce sokak yemeği tezgâhıyla dev bir açık hava yemek festivaline dönüşür.",
      mustDo:
        "Tteokbokki (acı pirinç keki), hotteok (tarçınlı-şekerli krep), ızgara peynirli ıstakoz ve 'tornado patates' deneyin. Kozmetik mağazaları kapıda bedava numune dağıtır; pasaportunuzu yanınızda taşıyın, vergi iadesi alın.",
      estimatedCost: 18,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1580651315530-69c8e0026377"),
    },
    {
      id: "kr-gamcheon",
      name: "Gamcheon Kültür Köyü",
      wikiTitle: "Gamcheon_Culture_Village",
      cityRegion: "Busan",
      category: "culture",
      coordinates: [129.0106, 35.0975],
      story:
        "Kore Savaşı mültecilerinin dağ yamacına kurduğu bu yoksul mahalle, 2009'da bir sanat projesiyle pastel renklere boyanarak 'Kore'nin Machu Picchu'su' hâline geldi. Sokaklar sanat enstalasyonları ve sürprizlerle doludur.",
      mustDo:
        "Bilgi merkezinden ₩2.000'lik damga haritası alın ve köydeki damgaları toplayın. Köyün sembolü 'Küçük Prens ve Tilki' heykeliyle fotoğraf için sabah erken gelin, öğlen kuyruk oluşur.",
      estimatedCost: 2,
      recommendedDuration: 2,
      fallbackImage: unsplash("photo-1538485399081-7191377e8241"),
    },
    {
      id: "kr-haeundae",
      name: "Haeundae Plajı",
      wikiTitle: "Haeundae_Beach",
      cityRegion: "Busan",
      category: "sight",
      coordinates: [129.1604, 35.1587],
      story:
        "Kore'nin en ünlü plajı, 1,5 km'lik ince altın kumu ve arkasındaki gökdelenleriyle 'Asya'nın Miami'si' olarak anılır. Yazın günde yarım milyondan fazla kişinin şemsiyelerini açtığı plaj, Guinness rekorları kırmıştır.",
      mustDo:
        "Plajın doğusundaki Haeundae Blueline Park'ta sahil boyunca giden renkli Sky Capsule'e binin. Ekim ayında düzenlenen Busan Uluslararası Film Festivali sırasında burada açık hava gösterimleri yapılır.",
      estimatedCost: 10,
      recommendedDuration: 2.5,
      fallbackImage: unsplash("photo-1578037571214-25e07ed4a487"),
    },
    {
      id: "kr-jagalchi",
      name: "Jagalchi Balık Pazarı",
      wikiTitle: "Jagalchi_Market",
      cityRegion: "Busan",
      category: "food",
      coordinates: [129.0306, 35.0966],
      story:
        "Kore'nin en büyük balık pazarı, savaş sonrası dönemde balıkçıların eşlerinin (Jagalchi ajummaları) kurduğu tezgâhlarla başladı. Bugün hâlâ pazarın ruhunu bu güçlü kadınlar taşıyor.",
      mustDo:
        "Zemin katta canlı balığınızı ya da ahtapotunuzu seçin, üst kattaki restoranlar küçük bir ücretle sizin için pişirsin. Cesursanız 'sannakji' (hâlâ kıpırdayan çiğ ahtapot) deneyin — iyice çiğneyin!",
      estimatedCost: 30,
      recommendedDuration: 1.5,
      fallbackImage: unsplash("photo-1534766555764-ce878a5e3a2b"),
    },
  ],
};

export function getPlacesForDestination(code: string): Place[] {
  return PLACES_BY_DESTINATION[code as FeaturedCode] ?? [];
}

/** Hedefteki şehir/bölgeler, ilk görülme sırasıyla (örn: ["Tokyo", "Kyoto"]) */
export function getRegions(places: Place[]): string[] {
  return [...new Set(places.map((p) => p.cityRegion))];
}
