import type { LanguageCode } from "@/lib/globalDiscovery";

/**
 * Pro dil kartları: 4 ifade kategorisi × 3 kart (+ dinamik "📍 Adres" kartları FinalGuideStep'te).
 * Her ifade [yerel yazılış, Türkçe okunuş (telaffuz)]; isteğe bağlı 3. eleman anlam varyantıdır
 * (örn. metrosu olmayan ülkede "busStop" → `ph.nearestMetro.busStop` "En yakın otobüs durağı nerede?").
 * Sekme adları (`pc.*`) ve anlamlar (`ph.*`) arayüz dilinde i18n sözlüğünden gelir; yerel yazılış hedef dilde kalır.
 */
export type PhraseCategory = "address" | "transit" | "restaurant" | "shopping" | "emergency";

export const PHRASE_CATEGORIES: { id: PhraseCategory; emoji: string }[] = [
  { id: "address", emoji: "📍" },
  { id: "transit", emoji: "🚇" },
  { id: "restaurant", emoji: "🍜" },
  { id: "shopping", emoji: "🛍️" },
  { id: "emergency", emoji: "🚨" },
];

export type PhraseKey =
  | "trainTo"
  | "dropMe"
  | "nearestMetro"
  | "popularDish"
  | "noPorkAlcohol"
  | "bill"
  | "taxFree"
  | "discount"
  | "card"
  | "english"
  | "lost"
  | "pharmacy";

/** Sıra = kart sırası; ücretsiz modda ilk 2 kart (transit) açık */
export const PHRASE_KEYS: { key: PhraseKey; category: Exclude<PhraseCategory, "address"> }[] = [
  { key: "trainTo", category: "transit" },
  { key: "dropMe", category: "transit" },
  { key: "nearestMetro", category: "transit" },
  { key: "popularDish", category: "restaurant" },
  { key: "noPorkAlcohol", category: "restaurant" },
  { key: "bill", category: "restaurant" },
  { key: "taxFree", category: "shopping" },
  { key: "discount", category: "shopping" },
  { key: "card", category: "shopping" },
  { key: "english", category: "emergency" },
  { key: "lost", category: "emergency" },
  { key: "pharmacy", category: "emergency" },
];

/** Metrosu olmayan ülkelerde anlamı değişen kartlar (`ph.<key>.<variant>`) */
export type PhraseVariant = "bus" | "busTram" | "vehicle" | "stop" | "here" | "busStop" | "slower";

type Entry = [local: string, pron: string, variant?: PhraseVariant];

export interface PhraseBook {
  /** "Lütfen beni bu adrese götürün" okunuşu (yazılış `LANGUAGES[code].takeMe`) */
  takeMePron: string;
  /** Web Speech API sesli okuma dili */
  speechLang: string;
  phrases: Record<PhraseKey, Entry>;
}

export const PHRASE_BOOKS: Record<LanguageCode, PhraseBook> = {
  ja: {
    takeMePron: "Kono cuuşo made onegay şimas",
    speechLang: "ja-JP",
    phrases: {
      trainTo: ["この電車はここに行きますか？", "Kono dennşa va koko ni ikimas ka?"],
      dropMe: ["この駅で降ろしてください。", "Kono eki de oroşite kudasay."],
      nearestMetro: ["一番近い地下鉄の駅はどこですか？", "İçiban çikay çikatetsu no eki va doko des ka?"],
      popularDish: ["一番人気の地元料理は何ですか？", "İçiban ninki no cimoto ryoori va nan des ka?"],
      noPorkAlcohol: ["豚肉やアルコールは入っていますか？", "Butaniku ya arukooru va haitte imas ka?"],
      bill: ["お会計をお願いします。", "O-kaykey o onegay şimas."],
      taxFree: ["免税できますか？", "Menzey dekimas ka?"],
      discount: ["もう少し安くなりますか？", "Moo sukoşi yasuku narimas ka?"],
      card: ["クレジットカードは使えますか？", "Kurecitto kaado va tsukaemas ka?"],
      english: ["英語を話せる人はいますか？", "Eygo o hanaseru hito va imas ka?"],
      lost: ["パスポート／携帯電話をなくしました。", "Pasupooto / keytay denva o nakuşimaşita."],
      pharmacy: ["一番近い薬局／病院はどこですか？", "İçiban çikay yakkyoku / byooin va doko des ka?"],
    },
  },
  ko: {
    takeMePron: "İ cusoro ka cuseyo",
    speechLang: "ko-KR",
    phrases: {
      trainTo: ["이 열차가 여기에 가나요?", "İ yolça-ga yogi-e ganayo?"],
      dropMe: ["이 역에서 내려 주세요.", "İ yog-eso neryo cuseyo."],
      nearestMetro: ["가장 가까운 지하철역이 어디예요?", "Kacang kakkaun cihaçol-yogi odiyeyo?"],
      popularDish: ["가장 인기 있는 현지 음식이 뭐예요?", "Kacang inki innın hyonci ımşigi mvoyeyo?"],
      noPorkAlcohol: ["돼지고기나 술이 들어가요?", "Tveciqogina suri dıroqayo?"],
      bill: ["계산서 주세요.", "Kyesanso cuseyo."],
      taxFree: ["택스 리펀드 되나요?", "Teksı ripondı dvenayo?"],
      discount: ["좀 깎아 주실 수 있어요?", "Com kakka cuşil su issoyo?"],
      card: ["신용카드 되나요?", "Şinyong kadı dvenayo?"],
      english: ["영어 하시는 분 있어요?", "Yongo haşinın bun issoyo?"],
      lost: ["여권／휴대폰을 잃어버렸어요.", "Yogvon / hyudeponıl iroboryossoyo."],
      pharmacy: ["가장 가까운 약국／병원이 어디예요?", "Kacang kakkaun yakkuk / byongvoni odiyeyo?"],
    },
  },
  zh: {
    takeMePron: "Çing day vo çü cıgı dici",
    speechLang: "zh-CN",
    phrases: {
      trainTo: ["这趟车去这里吗？", "Cı tang çı çü cıli ma?"],
      dropMe: ["请在这个站让我下车。", "Çing zay cıgı can rang vo şia çı."],
      nearestMetro: ["最近的地铁站在哪里？", "Zuycin dı ditye can zay nali?"],
      popularDish: ["你们最受欢迎的本地菜是什么？", "Nimın zuy şou huanying dı bındi tsay şı şınmı?"],
      noPorkAlcohol: ["这里面有猪肉或酒精吗？", "Cı limiın you cuju huo ciuciing ma?"],
      bill: ["买单，谢谢。", "May dan, şieşie."],
      taxFree: ["可以退税吗？", "Kıyi tuyşuy ma?"],
      discount: ["可以便宜一点吗？", "Kıyi pyenyi yidyen ma?"],
      card: ["可以刷信用卡吗？", "Kıyi şua şinyongka ma?"],
      english: ["有人会说英语吗？", "You rın huey şuo yingyü ma?"],
      lost: ["我的护照／手机丢了。", "Vo dı huçao / şouci diu lı."],
      pharmacy: ["最近的药店／医院在哪里？", "Zuycin dı yaodyen / yiyüen zay nali?"],
    },
  },
  ar: {
    takeMePron: "Min fadlak huznî ilâ hâza'l-unvân",
    speechLang: "ar-SA",
    phrases: {
      trainTo: ["هل يذهب هذا القطار إلى هنا؟", "Hal yezhebu hâza'l-kıtâr ilâ hunâ?"],
      dropMe: ["من فضلك أنزلني في هذه المحطة.", "Min fadlak enzilnî fî hâzihi'l-mahatta."],
      nearestMetro: ["أين أقرب محطة مترو؟", "Eyne akrabu mahattat metro?"],
      popularDish: ["ما هو أشهر طبق محلي لديكم؟", "Mâ huve eşheru tabakın mahalliyyin ledeykum?"],
      noPorkAlcohol: ["هل يحتوي على لحم خنزير أو كحول؟", "Hal yahtevî alâ lahmi hınzîr ev kuhûl?"],
      bill: ["الحساب من فضلك.", "El-hisâb min fadlak."],
      taxFree: ["هل يوجد استرداد ضريبي؟", "Hal yûcedu istirdâd darîbî?"],
      discount: ["هل يمكن أن تعطيني سعرا أفضل؟", "Hal yumkin en tu'tıynî si'ran efdal?"],
      card: ["هل تقبلون بطاقة الائتمان؟", "Hal takbelûne bitâkat el-i'timân?"],
      english: ["هل يوجد أحد يتكلم الإنجليزية؟", "Hal yûcedu ehadun yetekellemu'l-incilîziyye?"],
      lost: ["لقد فقدت جواز سفري / هاتفي.", "Lekad fekadtu cevâze seferî / hâtifî."],
      pharmacy: ["أين أقرب صيدلية / مستشفى؟", "Eyne akrabu saydaliyye / musteşfâ?"],
    },
  },
  en: {
    takeMePron: "Pliiz teyk mi tu dis ıdres",
    speechLang: "en-US",
    phrases: {
      trainTo: ["Does this train go here?", "Daz dis treyn go hiır?"],
      dropMe: ["Please let me off at this station.", "Pliiz let mi of et dis steyşın."],
      nearestMetro: ["Where is the nearest subway station?", "Veır iz dı niırest sabvey steyşın?"],
      popularDish: ["What is your most popular local dish?", "Vat iz yor most popyulır lokıl diş?"],
      noPorkAlcohol: ["Does this contain pork or alcohol?", "Daz dis kınteyn pork or elkıhol?"],
      bill: ["Could we have the bill, please?", "Kud vi hev dı bil, pliiz?"],
      taxFree: ["Is tax-free shopping available?", "İz teks-frii şoping ıveylıbıl?"],
      discount: ["Can you give me a better price?", "Ken yu giv mi ı betır prays?"],
      card: ["Do you accept credit cards?", "Du yu ıksept kredit kards?"],
      english: ["Could you speak more slowly, please?", "Kud yu spiik mor sloli, pliiz?", "slower"],
      lost: ["I lost my passport / phone.", "Ay lost may pesport / fon."],
      pharmacy: ["Where is the nearest pharmacy / hospital?", "Veır iz dı niırest farmısi / hospitıl?"],
    },
  },
  it: {
    takeMePron: "Mi porti a kuesto indiritso, per favore",
    speechLang: "it-IT",
    phrases: {
      trainTo: ["Questo treno va qui?", "Kuesto treno va kui?"],
      dropMe: ["Mi faccia scendere a questa fermata, per favore.", "Mi façça şendere a kuesta fermata, per favore."],
      nearestMetro: ["Dov'è la stazione della metro più vicina?", "Dove la stasyone della metro piu viçina?"],
      popularDish: ["Qual è il vostro piatto tipico più famoso?", "Kuale il vostro pyatto tipiko piu famozo?"],
      noPorkAlcohol: ["Contiene carne di maiale o alcol?", "Kontyene karne di mayale o alkol?"],
      bill: ["Il conto, per favore.", "İl konto, per favore."],
      taxFree: ["È possibile il rimborso Tax Free?", "E possibile il rimborso teks frii?"],
      discount: ["Può farmi un prezzo migliore?", "Puo farmi un pretso milyore?"],
      card: ["Accettate la carta di credito?", "Açettate la karta di kredito?"],
      english: ["C'è qualcuno che parla inglese?", "Çe kualkuno ke parla inglese?"],
      lost: ["Ho perso il passaporto / il telefono.", "O perso il passaporto / il telefono."],
      pharmacy: ["Dov'è la farmacia / l'ospedale più vicino?", "Dove la farmaçia / lospedale piu viçino?"],
    },
  },
  fr: {
    takeMePron: "Amöne mua a set adres, sil vu ple",
    speechLang: "fr-FR",
    phrases: {
      trainTo: ["Est-ce que ce train va ici ?", "Es kö sö tren va isi?"],
      dropMe: ["Déposez-moi à cette station, s'il vous plaît.", "Depoze mua a set stasyon, sil vu ple."],
      nearestMetro: ["Où est la station de métro la plus proche ?", "U e la stasyon dö metro la plü proş?"],
      popularDish: ["Quel est votre plat local le plus populaire ?", "Kel e votr pla lokal lö plü popüler?"],
      noPorkAlcohol: ["Est-ce qu'il y a du porc ou de l'alcool dedans ?", "Es kil ya dü por u dö lalkol dödan?"],
      bill: ["L'addition, s'il vous plaît.", "Ladisyon, sil vu ple."],
      taxFree: ["Est-ce que la détaxe est possible ?", "Es kö la deteks e posibl?"],
      discount: ["Vous pouvez me faire un meilleur prix ?", "Vu puve mö fer ön meyör pri?"],
      card: ["Vous acceptez la carte bancaire ?", "Vuz aksepte la kart banker?"],
      english: ["Quelqu'un parle anglais ?", "Kelkön parl angle?"],
      lost: ["J'ai perdu mon passeport / mon téléphone.", "Je perdü mon paspor / mon telefon."],
      pharmacy: ["Où est la pharmacie / l'hôpital le plus proche ?", "U e la farmasi / lopital lö plü proş?"],
    },
  },
  es: {
    takeMePron: "Yeveme a esta direksyon, por favor",
    speechLang: "es-ES",
    phrases: {
      trainTo: ["¿Este tren va aquí?", "Este tren va aki?"],
      dropMe: ["Déjeme en esta estación, por favor.", "Deheme en esta estasyon, por favor."],
      nearestMetro: ["¿Dónde está la estación de metro más cercana?", "Donde esta la estasyon de metro mas serkana?"],
      popularDish: ["¿Cuál es su plato típico más popular?", "Kual es su plato tipiko mas popular?"],
      noPorkAlcohol: ["¿Lleva cerdo o alcohol?", "Yeva serdo o alkol?"],
      bill: ["La cuenta, por favor.", "La kuenta, por favor."],
      taxFree: ["¿Tienen devolución de impuestos (Tax Free)?", "Tyenen devolusyon de impuestos?"],
      discount: ["¿Me puede hacer un mejor precio?", "Me puede aser un mehor presyo?"],
      card: ["¿Aceptan tarjeta de crédito?", "Aseptan tarheta de kredito?"],
      english: ["¿Alguien habla inglés?", "Algyen abla ingles?"],
      lost: ["He perdido mi pasaporte / mi teléfono.", "E perdido mi pasaporte / mi telefono."],
      pharmacy: ["¿Dónde está la farmacia / el hospital más cercano?", "Donde esta la farmasya / el ospital mas serkano?"],
    },
  },
  de: {
    takeMePron: "Bitte bringen zi miş tsu diızer adresse",
    speechLang: "de-DE",
    phrases: {
      trainTo: ["Fährt dieser Zug hierhin?", "Fert diızer tsuk hiırhin?"],
      dropMe: ["Bitte lassen Sie mich an dieser Haltestelle aussteigen.", "Bitte lassen zi miş an diızer haltıştele ausştaygen."],
      nearestMetro: ["Wo ist die nächste U-Bahn-Station?", "Vo ist di nekste u-ban ştatsyon?"],
      popularDish: ["Was ist Ihr beliebtestes regionales Gericht?", "Vas ist iır beliiptestes regyonales gerişt?"],
      noPorkAlcohol: ["Enthält das Schweinefleisch oder Alkohol?", "Enthelt das şvaynıflayş oder alkohol?"],
      bill: ["Die Rechnung, bitte.", "Di reşnung, bitte."],
      taxFree: ["Ist Tax-Free-Einkauf möglich?", "İst teks-frii aynkauf möglih?"],
      discount: ["Geht es etwas günstiger?", "Geyt es etvas günstiger?"],
      card: ["Kann ich mit Kreditkarte zahlen?", "Kan iş mit kreditkarte tsaalen?"],
      english: ["Spricht hier jemand Englisch?", "Şprişt hiır yemand engliş?"],
      lost: ["Ich habe meinen Pass / mein Handy verloren.", "İş habe maynen pas / mayn hendi ferloren."],
      pharmacy: ["Wo ist die nächste Apotheke / das nächste Krankenhaus?", "Vo ist di nekste apoteke / das nekste krankenhaus?"],
    },
  },
  nl: {
    takeMePron: "Breng mı alstüblift naar dit adres",
    speechLang: "nl-NL",
    phrases: {
      trainTo: ["Gaat deze trein hierheen?", "Haat deze trayn hiırheen?"],
      dropMe: ["Kunt u me bij deze halte laten uitstappen?", "Kunt ü mı bay deze halte laten öytstappen?"],
      nearestMetro: ["Waar is het dichtstbijzijnde metrostation?", "Vaar is het dihtstbayzaynde metrostaşon?"],
      popularDish: ["Wat is uw populairste lokale gerecht?", "Vat is üv populerste lokale herecht?"],
      noPorkAlcohol: ["Zit hier varkensvlees of alcohol in?", "Zit hiır varkensflees of alkohol in?"],
      bill: ["De rekening, alstublieft.", "De rekening, alstüblift."],
      taxFree: ["Kan ik tax-free winkelen?", "Kan ik teks-frii vinkelen?"],
      discount: ["Kan het wat goedkoper?", "Kan het vat hutkoper?"],
      card: ["Kan ik met een creditcard betalen?", "Kan ik met ın kreditkard betaalen?"],
      english: ["Spreekt hier iemand Engels?", "Spreekt hiır iimand engels?"],
      lost: ["Ik ben mijn paspoort / telefoon kwijt.", "İk ben mayn paspoort / telefoon kvayt."],
      pharmacy: ["Waar is de dichtstbijzijnde apotheek / het ziekenhuis?", "Vaar is de dihtstbayzaynde apoteek / het ziikenhöys?"],
    },
  },
  pt: {
    takeMePron: "Por favor, leve-mi a este enderesu",
    speechLang: "pt-BR",
    phrases: {
      trainTo: ["Este trem (comboio) vai até aqui?", "Esçi treyn (komboyo) vay ate aki?"],
      dropMe: ["Pode me deixar nesta estação, por favor?", "Pode mi deyşar nesta estasaun, por favor?"],
      nearestMetro: ["Onde fica a estação de metrô mais próxima?", "Onde fika a estasaun de metro mays prosima?"],
      popularDish: ["Qual é o prato típico mais popular?", "Kual e o prato tipiko mays popular?"],
      noPorkAlcohol: ["Isto tem carne de porco ou álcool?", "İsto teyn karne de porko o alkol?"],
      bill: ["A conta, por favor.", "A konta, por favor."],
      taxFree: ["Tem reembolso de impostos (Tax Free)?", "Teyn reembolso de impostos?"],
      discount: ["Pode fazer um preço melhor?", "Pode fazer um preso milyor?"],
      card: ["Aceitam cartão de crédito?", "Aseytaun kartaun de kredito?"],
      english: ["Alguém fala inglês?", "Algeyn fala ingles?"],
      lost: ["Perdi o meu passaporte / celular.", "Perdi o meu passaporçi / selular."],
      pharmacy: ["Onde fica a farmácia / o hospital mais próximo?", "Onde fika a farmasya / o ospital mays prosimo?"],
    },
  },
  th: {
    takeMePron: "Çuay pay song tii yuu nii noy krap/ka",
    speechLang: "th-TH",
    phrases: {
      trainTo: ["รถไฟขบวนนี้ไปที่นี่ไหม", "Rot fay kabuan nii pay tii nii may?"],
      dropMe: ["ช่วยจอดที่สถานีนี้ครับ/ค่ะ", "Çuay cot tii satanii nii krap/ka."],
      nearestMetro: ["สถานีรถไฟฟ้าที่ใกล้ที่สุดอยู่ที่ไหน", "Satanii rot fay faa tii klay tii sut yuu tii nay?"],
      popularDish: ["อาหารท้องถิ่นที่ขึ้นชื่อที่สุดคืออะไร", "Ahaan tong tin tii kın çıı tii sut kıı aray?"],
      noPorkAlcohol: ["มีหมูหรือแอลกอฮอล์ไหม", "Mii muu rıı elkohoo may?"],
      bill: ["เช็คบิลด้วยครับ/ค่ะ", "Çek bin duay krap/ka."],
      taxFree: ["ขอคืนภาษี (Tax Free) ได้ไหม", "Koo kıın paasii day may?"],
      discount: ["ลดราคาได้ไหม", "Lot raakaa day may?"],
      card: ["รับบัตรเครดิตไหม", "Rap bat kredit may?"],
      english: ["มีใครพูดภาษาอังกฤษได้ไหม", "Mii kray puut paasaa angkrit day may?"],
      lost: ["ฉันทำพาสปอร์ต/โทรศัพท์หาย", "Çan tam passpoot / torasap haay."],
      pharmacy: ["ร้านขายยา/โรงพยาบาลที่ใกล้ที่สุดอยู่ที่ไหน", "Raan kaay yaa / rong payaabaan tii klay tii sut yuu tii nay?"],
    },
  },
  el: {
    takeMePron: "Piyenete me se afti ti dieftinsi, parakalo",
    speechLang: "el-GR",
    phrases: {
      trainTo: ["Πηγαίνει αυτό το τρένο εδώ;", "Piyeni afto to treno edo?"],
      dropMe: ["Αφήστε με σε αυτή τη στάση, παρακαλώ.", "Afiste me se afti ti stasi, parakalo."],
      nearestMetro: ["Πού είναι ο πλησιέστερος σταθμός μετρό;", "Pu ine o plisiesteros stathmos metro?"],
      popularDish: ["Ποιο είναι το πιο δημοφιλές τοπικό πιάτο σας;", "Pyo ine to pyo dimofiles topiko pyato sas?"],
      noPorkAlcohol: ["Έχει χοιρινό ή αλκοόλ;", "Ehi hirino i alkool?"],
      bill: ["Τον λογαριασμό, παρακαλώ.", "Ton loğariazmo, parakalo."],
      taxFree: ["Γίνεται επιστροφή φόρου (Tax Free);", "Yinete epistrofi foru?"],
      discount: ["Μπορείτε να μου κάνετε καλύτερη τιμή;", "Borite na mu kanete kaliteri timi?"],
      card: ["Δέχεστε πιστωτική κάρτα;", "Deheste pistotiki karta?"],
      english: ["Μιλάει κανείς αγγλικά;", "Milai kanis anglika?"],
      lost: ["Έχασα το διαβατήριο / το τηλέφωνό μου.", "Ehasa to diavatirio / to tilefono mu."],
      pharmacy: ["Πού είναι το πλησιέστερο φαρμακείο / νοσοκομείο;", "Pu ine to plisiestero farmakio / nosokomio?"],
    },
  },
  cs: {
    takeMePron: "Zavezte mnye prosim na tuto adresu",
    speechLang: "cs-CZ",
    phrases: {
      trainTo: ["Jede tento vlak sem?", "Yede tento vlak sem?"],
      dropMe: ["Vysaďte mě prosím na této zastávce.", "Visadyte mnye prosim na teto zastavtse."],
      nearestMetro: ["Kde je nejbližší stanice metra?", "Gde ye neyblijşi stanitse metra?"],
      popularDish: ["Jaké je vaše nejoblíbenější místní jídlo?", "Yake ye vaşe neyoblibenyeyşi mistni yidlo?"],
      noPorkAlcohol: ["Obsahuje to vepřové maso nebo alkohol?", "Opsahuye to vepırjove maso nebo alkohol?"],
      bill: ["Zaplatím, prosím.", "Zaplatim, prosim."],
      taxFree: ["Je možné vrácení DPH (Tax Free)?", "Ye mojne vratseni de-pe-ha?"],
      discount: ["Můžete mi dát lepší cenu?", "Mujete mi dat lepşi tsenu?"],
      card: ["Berete platební karty?", "Berete platebni karti?"],
      english: ["Mluví tu někdo anglicky?", "Mluvi tu nyegdo anglitski?"],
      lost: ["Ztratil jsem pas / telefon.", "Stratyil sem pas / telefon."],
      pharmacy: ["Kde je nejbližší lékárna / nemocnice?", "Gde ye neyblijşi lekarna / nemotsnitse?"],
    },
  },
  hu: {
    takeMePron: "Kerem, vicen el erre o tsiimre",
    speechLang: "hu-HU",
    phrases: {
      trainTo: ["Ez a vonat ide megy?", "Ez o vonot ide mec?"],
      dropMe: ["Kérem, tegyen le ennél a megállónál.", "Kerem, tecen le ennel o megaallonaal."],
      nearestMetro: ["Hol van a legközelebbi metróállomás?", "Hol von o legközelebbi metroaallomaaş?"],
      popularDish: ["Mi a legnépszerűbb helyi ételük?", "Mi o legneepserüüb heyi eeteelük?"],
      noPorkAlcohol: ["Van benne sertéshús vagy alkohol?", "Von benne şerteeşhuuş vac alkohol?"],
      bill: ["A számlát, legyen szíves.", "O saamlaat, lecen siiveş."],
      taxFree: ["Van lehetőség áfa-visszatérítésre (Tax Free)?", "Von lehetöşeeg aafo-vissoteeriiteeşre?"],
      discount: ["Tudna jobb árat adni?", "Tudno yobb aarot odni?"],
      card: ["Elfogadnak bankkártyát?", "Elfogodnok bonkkaartyaat?"],
      english: ["Beszél itt valaki angolul?", "Beseel itt voloki ongolul?"],
      lost: ["Elvesztettem az útlevelemet / a telefonomat.", "Elvestettem oz uutlevelemet / o telefonomot."],
      pharmacy: ["Hol van a legközelebbi gyógyszertár / kórház?", "Hol von o legközelebbi cöcsertaar / koorhaaz?"],
    },
  },
  hr: {
    takeMePron: "Molim vas, odvezite me na ovu adresu",
    speechLang: "hr-HR",
    phrases: {
      trainTo: ["Ide li ovaj autobus / tramvaj ovamo?", "İde li ovay avtobus / tramvay ovamo?", "busTram"],
      dropMe: ["Molim vas, ostavite me na ovoj stanici.", "Molim vas, ostavite me na ovoy stanitsi.", "stop"],
      nearestMetro: ["Gdje je najbliža autobusna stanica?", "Gdye ye nayblija avtobusna stanitsa?", "busStop"],
      popularDish: ["Koje je vaše najpopularnije domaće jelo?", "Koye ye vaşe naypopularniye domaçe yelo?"],
      noPorkAlcohol: ["Ima li ovo svinjetinu ili alkohol?", "İma li ovo svinyetinu ili alkohol?"],
      bill: ["Račun, molim.", "Raçun, molim."],
      taxFree: ["Mogu li dobiti povrat PDV-a (Tax Free)?", "Mogu li dobiti povrat pe-de-ve-a?"],
      discount: ["Možete li mi dati bolju cijenu?", "Mojete li mi dati bolyu tsiyenu?"],
      card: ["Primate li kreditne kartice?", "Primate li kreditne kartitse?"],
      english: ["Govori li netko engleski?", "Govori li netko engleski?"],
      lost: ["Izgubio sam putovnicu / mobitel.", "İzgubio sam putovnitsu / mobitel."],
      pharmacy: ["Gdje je najbliža ljekarna / bolnica?", "Gdye ye nayblija lyekarna / bolnitsa?"],
    },
  },
  id: {
    takeMePron: "Tolong antar saya ke alamat ini",
    speechLang: "id-ID",
    phrases: {
      trainTo: ["Apakah bus ini ke sini?", "Apakah bus ini ke sini?", "bus"],
      dropMe: ["Tolong turunkan saya di sini.", "Tolong turunkan saya di sini.", "here"],
      nearestMetro: ["Di mana halte terdekat?", "Di mana halte terdekat?", "stop"],
      popularDish: ["Apa makanan lokal yang paling populer di sini?", "Apa makanan lokal yang paling populer di sini?"],
      noPorkAlcohol: ["Apakah ini mengandung babi atau alkohol?", "Apakah ini mengandung babi atau alkohol?"],
      bill: ["Minta bon, ya.", "Minta bon, ya."],
      taxFree: ["Apakah ada pengembalian pajak (Tax Free)?", "Apakah ada pengembaliyan pacak?"],
      discount: ["Bisa kurang harganya?", "Bisa kurang harganya?"],
      card: ["Bisa bayar pakai kartu kredit?", "Bisa bayar pakay kartu kredit?"],
      english: ["Ada yang bisa bahasa Inggris?", "Ada yang bisa bahasa İngris?"],
      lost: ["Saya kehilangan paspor / ponsel saya.", "Saya kehilangan paspor / ponsel saya."],
      pharmacy: ["Di mana apotek / rumah sakit terdekat?", "Di mana apotek / rumah sakit terdekat?"],
    },
  },
  vi: {
    takeMePron: "Lam ơn dua toy den dia çi nay",
    speechLang: "vi-VN",
    phrases: {
      trainTo: ["Xe này có đi đến đây không?", "Se nay ko di den day khong?", "vehicle"],
      dropMe: ["Cho tôi xuống ở trạm này.", "Ço toy suong ơ çam nay.", "stop"],
      nearestMetro: ["Ga tàu điện gần nhất ở đâu?", "Ga tau dien gan nhat ơ dau?"],
      popularDish: ["Món ăn địa phương nổi tiếng nhất là gì?", "Mon an dia fuong noy tieng nhat la zi?"],
      noPorkAlcohol: ["Món này có thịt heo hay rượu không?", "Mon nay ko tit heo hay ziou khong?"],
      bill: ["Tính tiền giúp tôi.", "Tin tien zup toy."],
      taxFree: ["Có hoàn thuế (Tax Free) không?", "Ko hoan tue khong?"],
      discount: ["Bớt giá được không?", "Bot za duok khong?"],
      card: ["Có nhận thẻ tín dụng không?", "Ko nyan te tin zung khong?"],
      english: ["Có ai nói tiếng Anh không?", "Ko ay noy tieng an khong?"],
      lost: ["Tôi bị mất hộ chiếu / điện thoại.", "Toy bi mat ho çieu / dien toay."],
      pharmacy: ["Nhà thuốc / bệnh viện gần nhất ở đâu?", "Nya tuok / ben vien gan nhat ơ dau?"],
    },
  },
  hi: {
    takeMePron: "Kripya mucı is pate par le çaliye",
    speechLang: "hi-IN",
    phrases: {
      trainTo: ["क्या यह ट्रेन यहाँ जाती है?", "Kya yeh tren yahaan caati hey?"],
      dropMe: ["कृपया मुझे इस स्टेशन पर उतार दीजिए।", "Kripya mucı is steşın par utaar diciye."],
      nearestMetro: ["सबसे नज़दीकी मेट्रो स्टेशन कहाँ है?", "Sabse nazdiiki metro steşın kahaan hey?"],
      popularDish: ["यहाँ का सबसे मशहूर स्थानीय व्यंजन कौन सा है?", "Yahaan ka sabse maşhuur sthaaniiy vyancan kaun sa hey?"],
      noPorkAlcohol: ["क्या इसमें सूअर का मांस या शराब है?", "Kya isme suur ka maans ya şaraab hey?"],
      bill: ["बिल दीजिए।", "Bil diciye."],
      taxFree: ["क्या टैक्स रिफंड (Tax Free) मिलता है?", "Kya teks rifand milta hey?"],
      discount: ["क्या थोड़ा कम हो सकता है?", "Kya thoda kam ho sakta hey?"],
      card: ["क्या आप क्रेडिट कार्ड लेते हैं?", "Kya aap kredit kaard lete heyn?"],
      english: ["क्या कोई अंग्रेज़ी बोलता है?", "Kya koi angrezi bolta hey?"],
      lost: ["मेरा पासपोर्ट / फ़ोन खो गया है।", "Mera paasport / fon kho gaya hey."],
      pharmacy: ["सबसे नज़दीकी दवाखाना / अस्पताल कहाँ है?", "Sabse nazdiiki davaakhaana / aspataal kahaan hey?"],
    },
  },
  sw: {
    takeMePron: "Tafazali nipeleke kvenye anvani hii",
    speechLang: "sw-KE",
    phrases: {
      trainTo: ["Je, basi hili linaenda hapa?", "Ce, basi hili linaenda hapa?", "bus"],
      dropMe: ["Tafadhali nishushe kituo hiki.", "Tafazali nişuşe kituo hiki.", "stop"],
      nearestMetro: ["Kituo cha basi kilicho karibu kiko wapi?", "Kituo ça basi kiliço karibu kiko vapi?", "busStop"],
      popularDish: ["Chakula gani cha kienyeji kinachopendwa zaidi?", "Çakula gani ça kienyeci kinaçopendva zaidi?"],
      noPorkAlcohol: ["Je, kina nyama ya nguruwe au pombe?", "Ce, kina nyama ya nguruve au pombe?"],
      bill: ["Naomba bili.", "Naomba bili."],
      taxFree: ["Kuna marejesho ya kodi (Tax Free)?", "Kuna marecesho ya kodi?"],
      discount: ["Unaweza kupunguza bei?", "Unaveza kupunguza bey?"],
      card: ["Mnapokea kadi ya benki?", "Mnapokea kadi ya benki?"],
      english: ["Kuna mtu anayezungumza Kiingereza?", "Kuna mtu anayezungumza Kiingereza?"],
      lost: ["Nimepoteza pasipoti / simu yangu.", "Nimepoteza pasipoti / simu yangu."],
      pharmacy: ["Duka la dawa / hospitali iliyo karibu iko wapi?", "Duka la dava / hospitali iliyo karibu iko vapi?"],
    },
  },
  ka: {
    takeMePron: "Gtkhovt, tsamiqvanet am misamartze",
    speechLang: "ka-GE",
    phrases: {
      trainTo: ["ეს მატარებელი აქ მიდის?", "Es matarebeli ak midis?"],
      dropMe: ["გთხოვთ, ამ სადგურზე ჩამომსვით.", "Gtkhovt, am sadgurze çamomsvit."],
      nearestMetro: ["სად არის უახლოესი მეტროს სადგური?", "Sad aris uakhloesi metros sadguri?"],
      popularDish: ["რომელია თქვენი ყველაზე პოპულარული ადგილობრივი კერძი?", "Romelia tkveni kvelaze popularuli adgilobrivi kerdzi?"],
      noPorkAlcohol: ["შეიცავს ღორის ხორცს ან ალკოჰოლს?", "Şeitsavs ğoris khortss an alkohols?"],
      bill: ["ანგარიში, გთხოვთ.", "Angarişi, gtkhovt."],
      taxFree: ["შესაძლებელია გადასახადის დაბრუნება (Tax Free)?", "Şesadzlebelia gadasakhadis dabruneba?"],
      discount: ["შეიძლება უფრო იაფად?", "Şeidzleba upro iapad?"],
      card: ["საკრედიტო ბარათს იღებთ?", "Sakredito barats iğebt?"],
      english: ["ვინმე ლაპარაკობს ინგლისურად?", "Vinme laparakobs inglisurad?"],
      lost: ["დავკარგე პასპორტი / ტელეფონი.", "Davkarge pasporti / telefoni."],
      pharmacy: ["სად არის უახლოესი აფთიაქი / საავადმყოფო?", "Sad aris uakhloesi aptiaki / saavadmqopo?"],
    },
  },
};
