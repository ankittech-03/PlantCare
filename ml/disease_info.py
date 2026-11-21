"""
Structured plant disease knowledge base for Tomato, Potato, and Pepper classes.
Supports English ('en') and Hindi ('hi') outputs and clearly separates general
management recommendations from professional agronomic diagnosis.
"""

from typing import Dict, List, Tuple

GUIDANCE_DISCLAIMER = {
    "en": (
        "Note: General management guidance is for educational and preliminary crop monitoring "
        "purposes only. Consult a local agricultural extension specialist before applying "
        "chemical treatments."
    ),
    "hi": (
        "नोट: यह सामान्य फसल प्रबंधन सलाह केवल प्रारंभिक निगरानी और शैक्षिक जानकारी के लिए है। "
        "किसी भी रासायनिक उपचार से पहले स्थानीय कृषि विशेषज्ञ या कृषि विज्ञान केंद्र से परामर्श लें।"
    ),
}

DISEASE_DATABASE: Dict[str, Dict[str, Dict[str, object]]] = {
    "Pepper,_bell___Bacterial_spot": {
        "en": {
            "plant": "Bell Pepper",
            "disease": "Bacterial Spot",
            "description": (
                "A bacterial infection caused by Xanthomonas species that affects leaves, stems, "
                "and fruit under warm, humid conditions."
            ),
            "symptoms": [
                "Small water-soaked circular leaf lesions turning dark brown or black",
                "Yellow halos surrounding necrotic spots on older foliage",
                "Premature leaf yellowing and defoliation",
            ],
            "recommendations": [
                "Remove and destroy heavily spotted leaves away from the field",
                "Avoid overhead watering to reduce bacterial splash dispersal",
                "Use disease-free seed and practice a 2 to 3 year crop rotation",
            ],
        },
        "hi": {
            "plant": "शिमला मिर्च",
            "disease": "जीवाणु धब्बा रोग (Bacterial Spot)",
            "description": (
                "ज़ैंथोमोनास (Xanthomonas) जीवाणु से होने वाला संक्रमण जो गर्म और नमी वाले मौसम में "
                "पत्तियों, तने और फल को प्रभावित करता है।"
            ),
            "symptoms": [
                "पत्तियों पर पानी से भीगे छोटे गोल धब्बे जो बाद में गहरे भूरे या काले हो जाते हैं",
                "सूखे धब्बों के चारों ओर पीला घेरा दिखाई देना",
                "पत्तियों का समय से पहले पीला पड़कर झड़ना",
            ],
            "recommendations": [
                "अत्यधिक संक्रमित पत्तियों को तोड़कर खेत से दूर नष्ट करें",
                "ऊपर से फव्वारा सिंचाई से बचें ताकि जीवाणु न फैलें",
                "रोग-मुक्त बीज का उपयोग करें और 2 से 3 वर्ष का फसल चक्र अपनाएं",
            ],
        },
    },
    "Pepper,_bell___healthy": {
        "en": {
            "plant": "Bell Pepper",
            "disease": "Healthy",
            "description": "The bell pepper foliage appears vibrant and free from visible disease lesions or pest damage.",
            "symptoms": [
                "Uniform dark green leaf coloration with firm texture",
                "No necrotic spots, curling, or fungal coating observed",
            ],
            "recommendations": [
                "Maintain consistent soil moisture without waterlogging",
                "Continue weekly field scouting for early signs of stress",
            ],
        },
        "hi": {
            "plant": "शिमला मिर्च",
            "disease": "स्वस्थ (Healthy)",
            "description": "शिमला मिर्च की पत्ती स्वस्थ है और इस पर किसी रोग या कीट के लक्षण दिखाई नहीं दे रहे हैं।",
            "symptoms": [
                "पत्ती का समान गहरा हरा रंग और मजबूत बनावट",
                "किसी प्रकार के धब्बे, मुड़ाव या फफूंदी की परत नहीं",
            ],
            "recommendations": [
                "खेत में जलभराव के बिना नियमित और संतुलित नमी बनाए रखें",
                "प्रारंभिक तनाव या कीट जांच के लिए साप्ताहिक निरीक्षण जारी रखें",
            ],
        },
    },
    "Potato___Early_blight": {
        "en": {
            "plant": "Potato",
            "disease": "Early Blight",
            "description": (
                "A common fungal disease caused by Alternaria solani that produces characteristic "
                "concentric rings primarily on older potato foliage."
            ),
            "symptoms": [
                "Dark brown lesions with target-like concentric rings",
                "Chlorotic yellow tissue surrounding spots",
                "Progressive drying starting from lower older leaves",
            ],
            "recommendations": [
                "Prune lower infected foliage and clear crop debris after harvest",
                "Maintain balanced nitrogen and potassium fertilization",
                "Irrigate at soil level during morning hours so foliage dries quickly",
            ],
        },
        "hi": {
            "plant": "आलू",
            "disease": "अगेती झुलसा (Early Blight)",
            "description": (
                "अल्टरनेरिया सोलानी (Alternaria solani) फफूंदी से होने वाला रोग, जो मुख्य रूप से "
                "पुरानी पत्तियों पर छल्लेदार भूरे धब्बे बनाता है।"
            ),
            "symptoms": [
                "पत्तियों पर लक्ष्य के समान गोल छल्लेदार गहरे भूरे धब्बे",
                "धब्बों के आसपास पत्ती के ऊतक का पीला पड़ना",
                "नीचे की पुरानी पत्तियों से सूखने की शुरुआत होना",
            ],
            "recommendations": [
                "निचली संक्रमित पत्तियों को हटाएं और कटाई के बाद फसल अवशेष साफ करें",
                "नाइट्रोजन और पोटाश का संतुलित उर्वरक प्रबंधन रखें",
                "सुबह के समय जड़ के पास सिंचाई करें ताकि पत्तियां जल्दी सूख जाएं",
            ],
        },
    },
    "Potato___Late_blight": {
        "en": {
            "plant": "Potato",
            "disease": "Late Blight",
            "description": (
                "A fast-spreading oomycete disease caused by Phytophthora infestans favored by "
                "cool, wet weather that can rapidly destroy potato foliage."
            ),
            "symptoms": [
                "Irregular water-soaked pale green to dark brown blotches",
                "Whitish downy mold growth on leaf undersides during humid mornings",
                "Rapid tissue collapse and dark stem lesions",
            ],
            "recommendations": [
                "Immediately isolate and remove heavily infected plants to curb spore spread",
                "Avoid irrigation during cool, overcast, or humid evenings",
                "Consult a local agronomist promptly for registered protective management",
            ],
        },
        "hi": {
            "plant": "आलू",
            "disease": "पछेती झुलसा (Late Blight)",
            "description": (
                "फाइटोफ्थोरा इन्फेस्टन्स (Phytophthora infestans) से होने वाला तेजी से फैलने वाला रोग, "
                "जो ठंडे और नम मौसम में आलू की पत्तियों को बहुत जल्दी नुकसान पहुंचाता है।"
            ),
            "symptoms": [
                "पानी से भीगे अनियमित हल्के हरे से गहरे भूरे बड़े धब्बे",
                "नमी वाली सुबह में पत्ती की निचली सतह पर सफेद रुई जैसी परत",
                "पत्तियों और तने का तेजी से सड़कर काला पड़ना",
            ],
            "recommendations": [
                "बीजाणुओं के फैलाव को रोकने के लिए गंभीर रूप से संक्रमित पौधों को तुरंत अलग करें",
                "ठंडे या अत्यधिक नमी वाले शाम के समय सिंचाई से बचें",
                "अनुमोदित सुरक्षात्मक उपचार के लिए तुरंत स्थानीय कृषि विशेषज्ञ से संपर्क करें",
            ],
        },
    },
    "Potato___healthy": {
        "en": {
            "plant": "Potato",
            "disease": "Healthy",
            "description": "The potato leaf shows uniform chlorophyll coloration with no visible blight or viral symptoms.",
            "symptoms": [
                "Clean green leaflets without necrotic blotches",
                "Normal leaf expansion and turgid structure",
            ],
            "recommendations": [
                "Monitor crop canopy closely during cool, rainy weather",
                "Keep ridges weed-free and maintain good soil drainage",
            ],
        },
        "hi": {
            "plant": "आलू",
            "disease": "स्वस्थ (Healthy)",
            "description": "आलू की पत्ती में समान हरा रंग है और झुलसा या वायरस के कोई लक्षण नहीं दिख रहे हैं।",
            "symptoms": [
                "बिना किसी दाग या धब्बे के साफ हरी पत्तियां",
                "पत्ती का सामान्य आकार और स्वस्थ बनावट",
            ],
            "recommendations": [
                "ठंडे और बरसाती मौसम में फसल की नियमित निगरानी रखें",
                "खेत को खरपतवार-मुक्त रखें और उचित जल निकासी बनाए रखें",
            ],
        },
    },
    "Tomato___Bacterial_spot": {
        "en": {
            "plant": "Tomato",
            "disease": "Bacterial Spot",
            "description": (
                "Bacterial leaf spot caused by Xanthomonas pathogens, leading to dark greasy lesions "
                "and defoliation in warm rainy conditions."
            ),
            "symptoms": [
                "Small dark brown to black water-soaked spots on leaves",
                "Lesions coalescing into larger blighted areas",
                "Yellowing and drop of lower leaves",
            ],
            "recommendations": [
                "Remove severely affected leaves and sanitize pruning tools",
                "Use drip irrigation instead of overhead sprinklers",
                "Rotate tomatoes out of solanaceous crops for at least 2 years",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "जीवाणु धब्बा रोग (Bacterial Spot)",
            "description": (
                "ज़ैंथोमोनास जीवाणु से होने वाला रोग जो गर्म और बरसाती मौसम में टमाटर की पत्तियों पर "
                "गहरे धब्बे और पत्ती झड़ने की समस्या पैदा करता है।"
            ),
            "symptoms": [
                "पत्तियों पर छोटे गहरे भूरे या काले पानी से भीगे धब्बे",
                "धब्बों का आपस में मिलकर बड़े सूखे हिस्से बनाना",
                "निचली पत्तियों का पीला पड़कर गिरना",
            ],
            "recommendations": [
                "अधिक प्रभावित पत्तियों को हटाएं और छंटाई के औजार साफ रखें",
                "ऊपर से सिंचाई के बजाय ड्रिप सिंचाई का उपयोग करें",
                "कम से कम 2 वर्षों तक टमाटर परिवार की फसलों का फसल चक्र बदलें",
            ],
        },
    },
    "Tomato___Early_blight": {
        "en": {
            "plant": "Tomato",
            "disease": "Early Blight",
            "description": (
                "Fungal disease caused by Alternaria solani characterized by concentric bullseye rings "
                "and progressive yellowing of lower tomato leaves."
            ),
            "symptoms": [
                "Circular brown spots with concentric target rings",
                "Yellow halo around older lesions",
                "Lower foliage wilting and premature leaf drop",
            ],
            "recommendations": [
                "Remove lower infected leaves and apply clean organic mulch to block soil splash",
                "Stake plants to improve airflow through the canopy",
                "Water at the base of plants early in the day",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "अगेती झुलसा (Early Blight)",
            "description": (
                "अल्टरनेरिया सोलानी फफूंदी से होने वाला रोग, जिसमें टमाटर की निचली पत्तियों पर "
                "गोल छल्लेदार धब्बे और पीलापन दिखाई देता है।"
            ),
            "symptoms": [
                "छल्लेदार गोल भूरे धब्बे जो निशाने जैसे दिखते हैं",
                "पुराने धब्बों के चारों ओर पीलापन",
                "नीचे की पत्तियों का मुरझाकर समय से पहले झड़ना",
            ],
            "recommendations": [
                "संक्रमित निचली पत्तियों को हटाएं और मिट्टी की छींटों से बचाव के लिए मल्चिंग करें",
                "हवा के प्रवाह के लिए पौधों को सहारा (स्टेकिंग) दें",
                "सुबह के समय पौधे की जड़ के पास पानी दें",
            ],
        },
    },
    "Tomato___Late_blight": {
        "en": {
            "plant": "Tomato",
            "disease": "Late Blight",
            "description": (
                "Aggressive water-mold infection caused by Phytophthora infestans capable of "
                "causing widespread leaf blight and stem rot in cool moist environments."
            ),
            "symptoms": [
                "Large irregular greenish-black water-soaked patches",
                "White fuzzy sporulation under leaves in high humidity",
                "Rapid browning and collapse of foliage",
            ],
            "recommendations": [
                "Remove infected foliage immediately and do not compost diseased plant material",
                "Increase spacing and pruning for faster leaf drying",
                "Seek local agricultural specialist advice for timely crop protection",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "पछेती झुलसा (Late Blight)",
            "description": (
                "फाइटोफ्थोरा इन्फेस्टन्स से होने वाला गंभीर संक्रमण जो ठंडे और नमी वाले वातावरण में "
                "टमाटर की पत्तियों और तने को तेजी से नष्ट कर सकता है।"
            ),
            "symptoms": [
                "पत्तियों पर बड़े अनियमित हरे-काले पानी से भीगे धब्बे",
                "अधिक नमी में पत्ती के नीचे सफेद फफूंदी जैसी वृद्धि",
                "पत्तियों का तेजी से भूरा होकर मुरझाना",
            ],
            "recommendations": [
                "संक्रमित पत्तियों को तुरंत हटाएं और खाद के गड्ढे में न डालें",
                "पौधों के बीच हवा के संचार के लिए उचित दूरी और छंटाई रखें",
                "समय पर फसल सुरक्षा के लिए स्थानीय कृषि विशेषज्ञ की सलाह लें",
            ],
        },
    },
    "Tomato___Leaf_Mold": {
        "en": {
            "plant": "Tomato",
            "disease": "Leaf Mold",
            "description": (
                "Fungal infection caused by Passalora fulva that thrives in high humidity, "
                "especially in greenhouses or dense canopies."
            ),
            "symptoms": [
                "Pale greenish-yellow spots on upper leaf surfaces",
                "Olive-green to velvety purple-brown mold on leaf undersides",
                "Curling and drying of heavily affected leaves",
            ],
            "recommendations": [
                "Improve greenhouse or canopy ventilation to lower relative humidity below 85%",
                "Prune dense foliage and remove affected leaves carefully",
                "Water at soil level in the morning rather than late afternoon",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "पत्ती का फफूंद रोग (Leaf Mold)",
            "description": (
                "पैसालोरा फुलवा (Passalora fulva) फफूंदी से होने वाला रोग जो अधिक नमी वाले "
                "पॉलीहाउस या घनी फसल में पनपता है।"
            ),
            "symptoms": [
                "पत्ती की ऊपरी सतह पर हल्के हरे-पीले धब्बे",
                "पत्ती के नीचे जैतूनी-हरे से भूरे मखमली फफूंद की परत",
                "अधिक प्रभावित पत्तियों का मुड़कर सूख जाना",
            ],
            "recommendations": [
                "हवा का वेंटिलेशन बढ़ाकर फसल की नमी कम करें",
                "घनी पत्तियों की छंटाई करें और प्रभावित पत्तियां सावधानी से हटाएं",
                "शाम के बजाय सुबह जमीन की सतह पर सिंचाई करें",
            ],
        },
    },
    "Tomato___Septoria_leaf_spot": {
        "en": {
            "plant": "Tomato",
            "disease": "Septoria Leaf Spot",
            "description": (
                "A fungal leaf disease caused by Septoria lycopersici producing numerous small "
                "circular spots with gray centers on lower leaves after fruit set."
            ),
            "symptoms": [
                "Numerous small circular spots with dark margins and tan-gray centers",
                "Tiny dark fungal fruiting specks visible in spot centers",
                "Progressive yellowing and defoliation from the base upward",
            ],
            "recommendations": [
                "Remove infected lower leaves early and mulch soil around stems",
                "Avoid working among wet plants to prevent mechanical spread",
                "Clean up plant residue at season end and rotate crops",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "सेप्टोरिया पत्ती धब्बा (Septoria Leaf Spot)",
            "description": (
                "सेप्टोरिया लाइकोपर्सिसी फफूंदी से होने वाला रोग जो निचली पत्तियों पर बीच से भूरे-सफेद "
                "कई छोटे गोल धब्बे बनाता है।"
            ),
            "symptoms": [
                "गहरे किनारों और हल्के स्लेटी केंद्र वाले कई छोटे गोल धब्बे",
                "धब्बों के बीच में छोटे काले बिंदु दिखाई देना",
                "नीचे से ऊपर की ओर पत्तियों का पीला पड़कर झड़ना",
            ],
            "recommendations": [
                "शुरुआत में ही निचली संक्रमित पत्तियां हटाएं और पौधे के चारों ओर मल्चिंग करें",
                "भीगी फसल के बीच काम करने से बचें ताकि संक्रमण न फैले",
                "फसल के बाद अवशेष साफ करें और फसल चक्र अपनाएं",
            ],
        },
    },
    "Tomato___Spider_mites Two-spotted_spider_mite": {
        "en": {
            "plant": "Tomato",
            "disease": "Two-Spotted Spider Mite",
            "description": (
                "Foliar feeding injury caused by Tetranychus urticae mites, commonly appearing "
                "during hot, dry weather."
            ),
            "symptoms": [
                "Fine yellow or white stippling across upper leaf surfaces",
                "Bronzing or dry brittle leaf appearance in severe infestations",
                "Delicate silk webbing on leaf undersides",
            ],
            "recommendations": [
                "Inspect leaf undersides with a magnifier and remove heavily infested leaves",
                "Reduce dust and water stress around plants",
                "Encourage natural predators or consult an extension specialist for mite-safe options",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "दो-धब्बा मकड़ी माइट (Spider Mites)",
            "description": (
                "टेट्रानाइकस आर्टिकी (Tetranychus urticae) माइट के रस चूसने से होने वाला नुकसान, "
                "जो मुख्य रूप से गर्म और सूखे मौसम में बढ़ता है।"
            ),
            "symptoms": [
                "पत्ती की ऊपरी सतह पर बारीक पीले या सफेद बिंदुओं का बिखराव",
                "अधिक प्रकोप में पत्तियों का तांबे जैसा भूरा और सूखा दिखना",
                "पत्ती की निचली सतह पर बारीक जाले दिखाई देना",
            ],
            "recommendations": [
                "पत्ती के नीचे की सतह की जांच करें और अधिक प्रभावित पत्तियां हटाएं",
                "पौधों के पास धूल और पानी की कमी न होने दें",
                "मित्र कीटों को बढ़ावा दें या कृषि विशेषज्ञ से सुरक्षित नियंत्रण की सलाह लें",
            ],
        },
    },
    "Tomato___Target_Spot": {
        "en": {
            "plant": "Tomato",
            "disease": "Target Spot",
            "description": (
                "Fungal condition caused by Corynespora cassiicola forming zoned necrotic spots "
                "that expand under warm, humid canopies."
            ),
            "symptoms": [
                "Small pinpoint dark spots expanding into brown ringed lesions",
                "Light yellow border around target-shaped spots",
                "Leaf yellowing and premature senescence",
            ],
            "recommendations": [
                "Remove old lower leaves to promote air circulation",
                "Avoid prolonged leaf wetness from late-day watering",
                "Maintain balanced plant nutrition and sanitation",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "टारगेट स्पॉट (Target Spot)",
            "description": (
                "कोरीनेस्पोरा कैसीकोला फफूंदी से होने वाला रोग जो गर्म और नमी वाले वातावरण में "
                "पत्तियों पर गहरे छल्लेदार धब्बे बनाता है।"
            ),
            "symptoms": [
                "छोटे गहरे बिंदु जो बढ़कर भूरे छल्लेदार धब्बों में बदलते हैं",
                "धब्बों के किनारे हल्का पीलापन",
                "पत्तियों का पीला होकर समय से पहले सूखना",
            ],
            "recommendations": [
                "हवा के बेहतर प्रवाह के लिए नीचे की पुरानी पत्तियां हटाएं",
                "देर शाम पानी देने से बचें ताकि पत्तियां लंबे समय तक गीली न रहें",
                "संतुलित पोषण और खेत की स्वच्छता बनाए रखें",
            ],
        },
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        "en": {
            "plant": "Tomato",
            "disease": "Tomato Yellow Leaf Curl Virus",
            "description": (
                "A viral disease transmitted primarily by silverleaf whiteflies (Bemisia tabaci), "
                "causing severe leaf curling and stunted plant growth."
            ),
            "symptoms": [
                "Upward cupping and curling of young leaf margins",
                "Pronounced yellowing between leaf veins and along edges",
                "Stunted shoots and reduced blossom or fruit set",
            ],
            "recommendations": [
                "Manage whitefly vectors using yellow sticky traps and insect-proof netting",
                "Rogue out severely stunted symptomatic plants early to protect healthy crops",
                "Select virus-tolerant tomato varieties for future plantings",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "पीला पत्ती मरोड़ वायरस (Yellow Leaf Curl Virus)",
            "description": (
                "सफेद मक्खी (Whitefly) द्वारा फैलने वाला विषाणु जनित रोग, जिससे पत्तियां ऊपर की ओर "
                "मुड़ जाती हैं और पौधे की बढ़वार रुक जाती है।"
            ),
            "symptoms": [
                "नई पत्तियों के किनारों का ऊपर की ओर मुड़ना (कप जैसा आकार)",
                "पत्ती की नसों के बीच और किनारों पर गहरा पीलापन",
                "पौधे का बौना रह जाना और फूल-फल कम लगना",
            ],
            "recommendations": [
                "सफेद मक्खी की रोकथाम के लिए पीले चिपचिपे ट्रैप और कीट-रोधी जाली लगाएं",
                "स्वस्थ पौधों को बचाने के लिए गंभीर रूप से संक्रमित पौधों को खेत से निकाल दें",
                "आगामी बुवाई के लिए वायरस-सहनेशील टमाटर किस्मों का चयन करें",
            ],
        },
    },
    "Tomato___Tomato_mosaic_virus": {
        "en": {
            "plant": "Tomato",
            "disease": "Tomato Mosaic Virus",
            "description": (
                "A contagious tobamovirus spread easily by hands, tools, and infected plant debris, "
                "causing mottled light and dark green patterns."
            ),
            "symptoms": [
                "Light and dark green mosaic mottling on leaves",
                "Narrow, distorted, or fern-like leaflet growth",
                "Reduced plant vigor and uneven leaf texture",
            ],
            "recommendations": [
                "Wash hands and disinfect tools thoroughly after handling plants",
                "Remove symptomatic plants and avoid tobacco handling before touching crops",
                "Use certified virus-free seeds and resistant cultivars",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "टमाटर मोज़ेक वायरस (Tomato Mosaic Virus)",
            "description": (
                "एक संक्रामक वायरस जो हाथों, औजारों और संक्रमित पौधों के अवशेषों से फैलता है तथा "
                "पत्तियों पर हल्के और गहरे हरे चकत्ते बनाता है।"
            ),
            "symptoms": [
                "पत्तियों पर हल्के और गहरे हरे रंग के मोज़ेक चकत्ते",
                "पत्तियों का संकरा, टेढ़ा-मेढ़ा या विकृत आकार",
                "पौधे की कमज़ोर बढ़वार और खुरदरी पत्ती सतह",
            ],
            "recommendations": [
                "पौधों को छूने के बाद हाथ धोएं और औजारों को अच्छी तरह कीटाणुरहित करें",
                "लक्षण वाले पौधों को हटाएं और तंबाकू छूने के बाद फसल को हाथ न लगाएं",
                "प्रमाणित वायरस-मुक्त बीज और प्रतिरोधी किस्मों का उपयोग करें",
            ],
        },
    },
    "Tomato___healthy": {
        "en": {
            "plant": "Tomato",
            "disease": "Healthy",
            "description": "The tomato foliage looks healthy with balanced green pigmentation and no visible blight, spot, or viral symptoms.",
            "symptoms": [
                "Rich green coloration without spots or mosaic mottling",
                "Normal leaflet posture with no curling or mite webbing",
            ],
            "recommendations": [
                "Maintain regular watering at the root zone and balanced fertilization",
                "Keep supporting stakes and canopy airflow clear",
            ],
        },
        "hi": {
            "plant": "टमाटर",
            "disease": "स्वस्थ (Healthy)",
            "description": "टमाटर की पत्ती स्वस्थ है और इस पर झुलसा, धब्बा या वायरस के कोई लक्षण नहीं हैं।",
            "symptoms": [
                "बिना धब्बों या मोज़ेक चकत्तों के गहरा हरा रंग",
                "सामान्य पत्ती आकार और बिना किसी मुड़ाव के स्वस्थ बनावट",
            ],
            "recommendations": [
                "जड़ क्षेत्र में नियमित सिंचाई और संतुलित पोषण बनाए रखें",
                "पौधों को सहारा दें और हवा का संचार साफ रखें",
            ],
        },
    },
}


def parse_class_label(raw_label: str) -> Tuple[str, str]:
    """Splits a PlantVillage folder/class label into human-readable (plant, disease)."""
    if "___" in raw_label:
        plant_part, disease_part = raw_label.split("___", 1)
    else:
        plant_part, disease_part = "Unknown Plant", raw_label

    plant = plant_part.replace(",_bell", " Bell").replace("_", " ").strip()
    disease = disease_part.replace("_", " ").strip()
    if disease.lower() == "healthy":
        disease = "Healthy"
    return plant, disease


def get_disease_details(raw_label: str, lang: str = "en") -> Dict[str, object]:
    """
    Returns structured plant name, disease name, description, symptoms, and general
    management recommendations (with disclaimer) for a given class label and language.
    """
    normalized_lang = "hi" if str(lang).lower().startswith("hi") else "en"
    entry = DISEASE_DATABASE.get(raw_label)

    if entry and normalized_lang in entry:
        localized = entry[normalized_lang]
        recommendations: List[str] = list(localized["recommendations"])
        recommendations.append(GUIDANCE_DISCLAIMER[normalized_lang])
        return {
            "plant": localized["plant"],
            "disease": localized["disease"],
            "description": localized["description"],
            "symptoms": list(localized["symptoms"]),
            "recommendations": recommendations,
        }

    plant, disease = parse_class_label(raw_label)
    if normalized_lang == "hi":
        return {
            "plant": plant,
            "disease": disease,
            "description": f"{plant} में {disease} के लक्षण पहचाने गए हैं।",
            "symptoms": [f"पत्ती पर {disease} से जुड़े संभावित लक्षण देखे गए हैं।"],
            "recommendations": [
                "प्रभावित पत्तियों की निगरानी करें और खेत में स्वच्छता बनाए रखें।",
                GUIDANCE_DISCLAIMER["hi"],
            ],
        }

    return {
        "plant": plant,
        "disease": disease,
        "description": f"Condition identified as {disease} on {plant} foliage.",
        "symptoms": [f"Visual foliar patterns associated with {disease}."],
        "recommendations": [
            "Monitor affected foliage closely and isolate severely damaged leaves.",
            GUIDANCE_DISCLAIMER["en"],
        ],
    }
