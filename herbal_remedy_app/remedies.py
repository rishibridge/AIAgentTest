"""
Herbal Remedy Knowledge Base
Comprehensive database of ayurvedic, herbal, and supplement remedies
mapped to common symptoms. All items are non-prescription, over-the-counter.
"""

SYMPTOM_CATEGORIES = {
    "digestive": ["bloating", "gas", "indigestion", "nausea", "constipation", "diarrhea",
                   "acid reflux", "heartburn", "stomach pain", "stomach cramps", "appetite loss",
                   "ibs", "irritable bowel"],
    "sleep_stress": ["insomnia", "anxiety", "stress", "nervousness", "restlessness",
                     "sleep problems", "trouble sleeping", "poor sleep", "racing thoughts",
                     "tension", "panic", "worry", "overwhelm", "burnout"],
    "immunity": ["frequent colds", "weak immunity", "flu", "cold", "sore throat",
                 "congestion", "runny nose", "sneezing", "fever", "infections",
                 "low immunity", "getting sick often"],
    "pain_inflammation": ["headache", "migraine", "back pain", "joint pain", "muscle pain",
                          "inflammation", "swelling", "arthritis", "chronic pain", "body aches",
                          "neck pain", "shoulder pain", "knee pain", "stiffness"],
    "respiratory": ["cough", "shortness of breath", "wheezing", "bronchitis",
                    "chest congestion", "sinus pressure", "sinusitis", "allergies",
                    "hay fever", "nasal congestion", "post nasal drip", "asthma symptoms"],
    "energy_focus": ["fatigue", "low energy", "brain fog", "poor concentration",
                     "lack of motivation", "mental fatigue", "drowsiness", "lethargy",
                     "exhaustion", "poor focus", "memory problems", "tiredness"],
    "skin": ["acne", "eczema", "dry skin", "rash", "itching", "psoriasis",
             "skin irritation", "oily skin", "dark spots", "aging skin", "wrinkles",
             "skin inflammation", "hives", "redness"],
    "joint_muscle": ["joint stiffness", "muscle cramps", "muscle soreness", "tendinitis",
                     "carpal tunnel", "fibromyalgia", "sciatica", "bursitis",
                     "muscle weakness", "muscle tension", "sprain", "strain"],
    "hair": ["hair loss", "thinning hair", "dandruff", "dry hair", "brittle hair",
             "premature graying", "slow hair growth", "scalp issues"],
    "mood": ["depression", "mood swings", "irritability", "sadness", "low mood",
             "seasonal affective", "emotional imbalance", "apathy"],
    "weight": ["weight gain", "slow metabolism", "water retention", "belly fat",
               "appetite control", "cravings", "overeating", "binge eating"],
    "heart": ["high blood pressure", "high cholesterol", "poor circulation",
              "palpitations", "varicose veins", "cold hands", "cold feet"],
}

# All symptoms flat list for autocomplete
ALL_SYMPTOMS = sorted(set(
    symptom for symptoms in SYMPTOM_CATEGORIES.values() for symptom in symptoms
))

FOLLOW_UP_QUESTIONS = [
    {
        "id": "severity",
        "question": "How severe are your symptoms?",
        "options": ["Mild — Noticeable but not disruptive",
                    "Moderate — Affects daily activities",
                    "Severe — Significantly impacts quality of life"]
    },
    {
        "id": "duration",
        "question": "How long have you been experiencing these symptoms?",
        "options": ["Less than a week",
                    "1–4 weeks",
                    "1–3 months",
                    "More than 3 months"]
    },
    {
        "id": "preference",
        "question": "Do you have a preference for remedy type?",
        "options": ["Ayurvedic (traditional Indian medicine)",
                    "Herbal (plant-based remedies)",
                    "Supplements (vitamins, minerals, extracts)",
                    "No preference — show me everything"]
    },
    {
        "id": "allergies",
        "question": "Do you have any known allergies or sensitivities?",
        "options": ["None that I know of",
                    "Ragweed / daisy family plants",
                    "Shellfish (affects glucosamine)",
                    "Nightshade family (tomatoes, peppers)"]
    },
    {
        "id": "medications",
        "question": "Are you currently taking any medications?",
        "options": ["No medications",
                    "Blood thinners",
                    "Blood pressure medication",
                    "Antidepressants / anti-anxiety",
                    "Other prescription medication"]
    }
]

REMEDIES = [
    # ═══════════════════════════════════════
    # DIGESTIVE
    # ═══════════════════════════════════════
    {
        "name": "Turmeric (Curcumin)",
        "category": "ayurvedic",
        "tags": ["digestive", "pain_inflammation", "skin"],
        "symptoms": ["bloating", "indigestion", "inflammation", "joint pain", "skin inflammation", "arthritis"],
        "description": "Golden spice used for centuries in Ayurveda. Curcumin is its active compound with powerful anti-inflammatory and antioxidant properties.",
        "benefits": ["Reduces digestive inflammation", "Eases bloating and gas", "Supports joint health", "Antioxidant protection"],
        "dosage": "500–2000mg curcumin daily with black pepper (piperine) for absorption",
        "cautions": ["May interact with blood thinners", "High doses may cause stomach upset", "Avoid before surgery"],
        "amazon_query": "turmeric curcumin supplement with bioperine"
    },
    {
        "name": "Ginger Root",
        "category": "herbal",
        "tags": ["digestive", "pain_inflammation", "immunity"],
        "symptoms": ["nausea", "indigestion", "bloating", "stomach pain", "cold", "inflammation"],
        "description": "A warming root used globally for digestive relief. Contains gingerols and shogaols that soothe the GI tract.",
        "benefits": ["Relieves nausea and morning sickness", "Aids digestion", "Anti-inflammatory", "Supports immune function"],
        "dosage": "250–1000mg dried ginger or fresh ginger tea 2–3 times daily",
        "cautions": ["May interact with blood thinners", "High doses may cause heartburn"],
        "amazon_query": "organic ginger root supplement capsules"
    },
    {
        "name": "Triphala",
        "category": "ayurvedic",
        "tags": ["digestive"],
        "symptoms": ["constipation", "bloating", "indigestion", "ibs", "appetite loss"],
        "description": "Classic Ayurvedic formula combining three fruits (Amalaki, Bibhitaki, Haritaki) for complete digestive support.",
        "benefits": ["Gentle natural laxative", "Supports regularity", "Detoxification support", "Rich in antioxidants"],
        "dosage": "500–1000mg before bed or 1/2 tsp powder in warm water",
        "cautions": ["May cause loose stools initially", "Avoid during pregnancy"],
        "amazon_query": "triphala supplement organic"
    },
    {
        "name": "Peppermint",
        "category": "herbal",
        "tags": ["digestive", "respiratory"],
        "symptoms": ["bloating", "gas", "ibs", "stomach cramps", "indigestion", "nausea", "headache"],
        "description": "Cooling herb with menthol that relaxes smooth muscle in the GI tract, providing rapid relief from digestive discomfort.",
        "benefits": ["Relieves IBS symptoms", "Reduces bloating and gas", "Soothes stomach cramps", "Freshens breath"],
        "dosage": "1–2 enteric-coated capsules (0.2mL oil) or peppermint tea 2–3x daily",
        "cautions": ["May worsen acid reflux/GERD", "Enteric coating important for IBS use"],
        "amazon_query": "peppermint oil capsules enteric coated"
    },
    {
        "name": "Fennel Seed",
        "category": "ayurvedic",
        "tags": ["digestive"],
        "symptoms": ["bloating", "gas", "acid reflux", "stomach cramps", "indigestion"],
        "description": "Aromatic seed used in Ayurveda as a digestive tonic. Contains anethole which relaxes the digestive tract.",
        "benefits": ["Relieves gas and bloating", "Soothes stomach cramps", "Supports healthy digestion", "Freshens breath naturally"],
        "dosage": "1 tsp seeds chewed after meals or fennel tea 2–3x daily",
        "cautions": ["Generally very safe", "Avoid in large amounts during pregnancy"],
        "amazon_query": "organic fennel seed tea"
    },
    {
        "name": "Digestive Enzymes",
        "category": "supplement",
        "tags": ["digestive"],
        "symptoms": ["bloating", "indigestion", "gas", "stomach pain", "constipation"],
        "description": "Blend of enzymes (protease, lipase, amylase) that help break down food more efficiently for better nutrient absorption.",
        "benefits": ["Improves nutrient absorption", "Reduces post-meal bloating", "Helps with food intolerances", "Supports overall digestion"],
        "dosage": "1 capsule with each meal",
        "cautions": ["Choose broad-spectrum formula", "Start with lower dose"],
        "amazon_query": "digestive enzyme supplement broad spectrum"
    },
    # ═══════════════════════════════════════
    # SLEEP & STRESS
    # ═══════════════════════════════════════
    {
        "name": "Ashwagandha",
        "category": "ayurvedic",
        "tags": ["sleep_stress", "energy_focus", "immunity"],
        "symptoms": ["stress", "anxiety", "insomnia", "fatigue", "low energy", "burnout", "nervousness"],
        "description": "Premier Ayurvedic adaptogen (Withania somnifera) that helps the body resist physical and mental stress while promoting calm energy.",
        "benefits": ["Reduces cortisol levels", "Improves sleep quality", "Enhances mental clarity", "Boosts stamina and energy"],
        "dosage": "300–600mg KSM-66 or Sensoril extract daily",
        "cautions": ["May interact with thyroid medication", "Avoid during pregnancy", "Nightshade family plant"],
        "amazon_query": "ashwagandha KSM-66 supplement"
    },
    {
        "name": "Valerian Root",
        "category": "herbal",
        "tags": ["sleep_stress"],
        "symptoms": ["insomnia", "sleep problems", "trouble sleeping", "anxiety", "restlessness"],
        "description": "Time-tested herbal sedative used since ancient Greece. Works by increasing GABA activity in the brain for natural relaxation.",
        "benefits": ["Promotes faster sleep onset", "Improves sleep quality", "Reduces nighttime waking", "Eases anxiety naturally"],
        "dosage": "300–600mg extract 30–60 minutes before bed",
        "cautions": ["May cause morning grogginess", "Don't combine with sleep medications", "Takes 2–4 weeks for full effect"],
        "amazon_query": "valerian root sleep supplement"
    },
    {
        "name": "Chamomile",
        "category": "herbal",
        "tags": ["sleep_stress", "digestive"],
        "symptoms": ["insomnia", "anxiety", "stress", "restlessness", "stomach cramps", "indigestion"],
        "description": "Gentle calming herb with apigenin that binds to GABA receptors, promoting relaxation without sedation.",
        "benefits": ["Promotes relaxation", "Supports sleep", "Soothes digestive upset", "Mild anti-inflammatory"],
        "dosage": "1–2 cups chamomile tea before bed or 400–1600mg extract",
        "cautions": ["Ragweed allergy cross-reactivity", "May interact with blood thinners"],
        "amazon_query": "organic chamomile tea bags"
    },
    {
        "name": "Magnesium Glycinate",
        "category": "supplement",
        "tags": ["sleep_stress", "joint_muscle", "mood"],
        "symptoms": ["insomnia", "anxiety", "muscle cramps", "stress", "restlessness", "muscle tension", "irritability"],
        "description": "Highly bioavailable form of magnesium chelated with glycine. Both magnesium and glycine support calm and relaxation.",
        "benefits": ["Promotes deep, restful sleep", "Relaxes muscles", "Calms the nervous system", "Supports mood stability"],
        "dosage": "200–400mg elemental magnesium before bed",
        "cautions": ["High doses may cause loose stools", "Check with doctor if on heart/kidney meds"],
        "amazon_query": "magnesium glycinate supplement 400mg"
    },
    {
        "name": "Passionflower",
        "category": "herbal",
        "tags": ["sleep_stress"],
        "symptoms": ["anxiety", "insomnia", "nervousness", "racing thoughts", "restlessness", "tension"],
        "description": "Tropical vine flower that boosts GABA levels in the brain. Clinically shown to reduce anxiety comparable to some prescription options.",
        "benefits": ["Reduces anxiety", "Calms racing thoughts", "Improves sleep quality", "Non-habit forming"],
        "dosage": "500mg extract or tea 1 hour before bed",
        "cautions": ["May cause drowsiness", "Avoid with sedative medications"],
        "amazon_query": "passionflower extract supplement"
    },
    {
        "name": "L-Theanine",
        "category": "supplement",
        "tags": ["sleep_stress", "energy_focus"],
        "symptoms": ["anxiety", "stress", "poor concentration", "racing thoughts", "tension", "poor focus"],
        "description": "Amino acid naturally found in green tea that promotes calm alertness by boosting alpha brain waves and GABA.",
        "benefits": ["Reduces anxiety without drowsiness", "Improves focus and concentration", "Promotes relaxation", "Enhances sleep quality"],
        "dosage": "100–200mg 1–2 times daily",
        "cautions": ["Very safe profile", "May enhance effects of blood pressure medications"],
        "amazon_query": "L-theanine supplement 200mg"
    },
    {
        "name": "Brahmi (Bacopa monnieri)",
        "category": "ayurvedic",
        "tags": ["sleep_stress", "energy_focus"],
        "symptoms": ["anxiety", "brain fog", "poor concentration", "memory problems", "stress"],
        "description": "Sacred Ayurvedic herb revered for enhancing cognitive function and reducing anxiety. Used for thousands of years by scholars.",
        "benefits": ["Enhances memory", "Reduces anxiety", "Improves learning", "Neuroprotective"],
        "dosage": "300–450mg standardized extract daily",
        "cautions": ["May cause GI upset initially", "Takes 8–12 weeks for full cognitive effects"],
        "amazon_query": "bacopa monnieri brahmi supplement"
    },
    # ═══════════════════════════════════════
    # IMMUNITY
    # ═══════════════════════════════════════
    {
        "name": "Elderberry",
        "category": "herbal",
        "tags": ["immunity", "respiratory"],
        "symptoms": ["cold", "flu", "sore throat", "congestion", "weak immunity", "frequent colds"],
        "description": "Dark purple berry packed with anthocyanins and vitamin C. Research shows it can reduce cold and flu duration significantly.",
        "benefits": ["Shortens cold/flu duration", "Rich in antioxidants", "Supports immune response", "Natural anti-viral properties"],
        "dosage": "600–900mg extract daily during illness, 300mg for prevention",
        "cautions": ["Only use commercially prepared products (raw berries toxic)", "May stimulate immune system (caution with autoimmune)"],
        "amazon_query": "elderberry supplement immune support"
    },
    {
        "name": "Echinacea",
        "category": "herbal",
        "tags": ["immunity", "respiratory"],
        "symptoms": ["cold", "flu", "sore throat", "weak immunity", "infections", "congestion"],
        "description": "North American coneflower that activates immune cells. Most effective when taken at the first sign of cold symptoms.",
        "benefits": ["Boosts immune cell activity", "Reduces cold severity", "Speeds recovery", "Anti-inflammatory"],
        "dosage": "300–500mg 3x daily at onset of symptoms, for up to 10 days",
        "cautions": ["Ragweed allergy cross-reactivity", "Not for long-term continuous use", "Avoid with immunosuppressants"],
        "amazon_query": "echinacea supplement immune"
    },
    {
        "name": "Vitamin C",
        "category": "supplement",
        "tags": ["immunity", "skin"],
        "symptoms": ["cold", "flu", "weak immunity", "frequent colds", "aging skin", "slow wound healing"],
        "description": "Essential antioxidant vitamin that supports immune cell function, collagen production, and protects against oxidative stress.",
        "benefits": ["Supports immune function", "Powerful antioxidant", "Promotes collagen synthesis", "Enhances iron absorption"],
        "dosage": "500–1000mg daily, up to 2000mg during illness",
        "cautions": ["High doses may cause digestive upset", "Liposomal form better absorbed"],
        "amazon_query": "vitamin C 1000mg supplement"
    },
    {
        "name": "Zinc",
        "category": "supplement",
        "tags": ["immunity", "skin"],
        "symptoms": ["cold", "sore throat", "weak immunity", "frequent colds", "acne", "slow wound healing"],
        "description": "Essential trace mineral critical for immune cell development and function. Zinc lozenges can reduce cold duration by 33%.",
        "benefits": ["Shortens cold duration", "Supports immune cell function", "Promotes wound healing", "Supports skin health"],
        "dosage": "15–30mg daily, zinc lozenges for active colds",
        "cautions": ["Don't exceed 40mg daily long-term", "Take with food to avoid nausea", "Can reduce copper absorption"],
        "amazon_query": "zinc supplement lozenges immune"
    },
    {
        "name": "Tulsi (Holy Basil)",
        "category": "ayurvedic",
        "tags": ["immunity", "sleep_stress", "respiratory"],
        "symptoms": ["stress", "cold", "cough", "weak immunity", "anxiety", "congestion"],
        "description": "Sacred Ayurvedic herb known as 'The Queen of Herbs.' Adaptogenic properties support both immunity and stress resilience.",
        "benefits": ["Adaptogenic stress support", "Boosts immune function", "Eases respiratory issues", "Balances cortisol"],
        "dosage": "300–600mg extract or 2–3 cups tulsi tea daily",
        "cautions": ["May lower blood sugar", "Avoid before surgery", "May affect fertility at very high doses"],
        "amazon_query": "tulsi holy basil supplement organic"
    },
    {
        "name": "Vitamin D3",
        "category": "supplement",
        "tags": ["immunity", "mood", "joint_muscle"],
        "symptoms": ["weak immunity", "frequent colds", "low mood", "seasonal affective", "joint pain", "fatigue"],
        "description": "The 'sunshine vitamin' — most adults are deficient. Critical for immune regulation, mood, and bone health.",
        "benefits": ["Strengthens immune defense", "Supports mood and mental health", "Essential for bone health", "Reduces infection risk"],
        "dosage": "1000–5000 IU daily with a fatty meal",
        "cautions": ["Get levels tested ideally", "Take with vitamin K2 for best results", "Fat-soluble — don't mega-dose"],
        "amazon_query": "vitamin D3 K2 supplement 5000 IU"
    },
    # ═══════════════════════════════════════
    # PAIN & INFLAMMATION
    # ═══════════════════════════════════════
    {
        "name": "Boswellia (Indian Frankincense)",
        "category": "ayurvedic",
        "tags": ["pain_inflammation", "joint_muscle"],
        "symptoms": ["joint pain", "arthritis", "inflammation", "stiffness", "knee pain", "back pain"],
        "description": "Ayurvedic resin extract that inhibits 5-LOX enzyme, a key driver of inflammation. Clinically proven for joint pain relief.",
        "benefits": ["Reduces joint inflammation", "Improves mobility", "Supports cartilage health", "Fast-acting pain relief"],
        "dosage": "300–500mg standardized extract (AKBA) 2–3x daily",
        "cautions": ["Generally well tolerated", "May interact with anti-inflammatory drugs"],
        "amazon_query": "boswellia serrata extract supplement"
    },
    {
        "name": "Willow Bark",
        "category": "herbal",
        "tags": ["pain_inflammation"],
        "symptoms": ["headache", "back pain", "joint pain", "muscle pain", "chronic pain", "inflammation"],
        "description": "Nature's original aspirin — contains salicin which the body converts to salicylic acid for natural pain relief.",
        "benefits": ["Natural pain relief", "Reduces inflammation", "Eases headaches", "Gentler on stomach than aspirin"],
        "dosage": "240mg salicin daily in divided doses",
        "cautions": ["Same contraindications as aspirin", "Avoid with blood thinners", "Not for children", "Avoid if aspirin-allergic"],
        "amazon_query": "willow bark extract supplement"
    },
    {
        "name": "Omega-3 Fish Oil",
        "category": "supplement",
        "tags": ["pain_inflammation", "heart", "mood"],
        "symptoms": ["inflammation", "joint pain", "high cholesterol", "dry skin", "low mood", "depression"],
        "description": "Essential fatty acids (EPA/DHA) that resolve inflammation pathways and support heart, brain, and joint health.",
        "benefits": ["Powerful anti-inflammatory", "Supports heart health", "Improves mood", "Lubricates joints"],
        "dosage": "2000–3000mg combined EPA/DHA daily",
        "cautions": ["May interact with blood thinners", "Choose purified/tested-for-mercury brands", "Take with meals"],
        "amazon_query": "omega 3 fish oil EPA DHA supplement"
    },
    {
        "name": "Arnica",
        "category": "herbal",
        "tags": ["pain_inflammation", "joint_muscle"],
        "symptoms": ["muscle pain", "bruising", "swelling", "sprain", "strain", "muscle soreness"],
        "description": "Mountain daisy used topically for centuries to reduce bruising, swelling, and muscle soreness after injury or exercise.",
        "benefits": ["Reduces bruising", "Eases muscle soreness", "Decreases swelling", "Speeds recovery from injury"],
        "dosage": "Apply topical gel/cream to affected area 2–3x daily",
        "cautions": ["Topical use only — do not ingest", "Avoid on broken skin", "Daisy family allergy risk"],
        "amazon_query": "arnica gel topical pain relief"
    },
    # ═══════════════════════════════════════
    # RESPIRATORY
    # ═══════════════════════════════════════
    {
        "name": "Eucalyptus",
        "category": "herbal",
        "tags": ["respiratory"],
        "symptoms": ["congestion", "cough", "sinus pressure", "nasal congestion", "chest congestion", "sinusitis"],
        "description": "Aromatic leaf oil with eucalyptol (1,8-cineole) that opens airways, thins mucus, and has antimicrobial properties.",
        "benefits": ["Clears nasal congestion", "Thins mucus", "Opens airways", "Natural antimicrobial"],
        "dosage": "Steam inhalation with 3–5 drops oil, or chest rub, or 200mg cineole capsules",
        "cautions": ["Do not ingest essential oil directly", "Keep away from face of young children", "May trigger asthma in sensitive individuals"],
        "amazon_query": "eucalyptus essential oil organic"
    },
    {
        "name": "Licorice Root",
        "category": "herbal",
        "tags": ["respiratory", "digestive"],
        "symptoms": ["sore throat", "cough", "acid reflux", "heartburn", "chest congestion"],
        "description": "Sweet root with glycyrrhizin that soothes mucous membranes, calms coughs, and protects the stomach lining.",
        "benefits": ["Soothes sore throat", "Calms coughs", "Protects stomach lining", "Anti-viral properties"],
        "dosage": "DGL form 380–400mg before meals, or licorice tea 1–2x daily",
        "cautions": ["Avoid non-DGL form if you have high blood pressure", "Limit to 4–6 weeks of use", "Can lower potassium"],
        "amazon_query": "DGL licorice root supplement"
    },
    {
        "name": "Mullein Leaf",
        "category": "herbal",
        "tags": ["respiratory"],
        "symptoms": ["cough", "bronchitis", "chest congestion", "wheezing", "sore throat"],
        "description": "Fuzzy-leafed herb that acts as a natural expectorant, helping to loosen and expel mucus from the lungs.",
        "benefits": ["Natural expectorant", "Soothes irritated airways", "Supports lung health", "Anti-inflammatory"],
        "dosage": "1–2 cups mullein tea daily or 500mg capsules 2x daily",
        "cautions": ["Strain tea well to remove tiny hairs", "Generally very safe"],
        "amazon_query": "mullein leaf tea organic lung support"
    },
    {
        "name": "Quercetin",
        "category": "supplement",
        "tags": ["respiratory", "immunity"],
        "symptoms": ["allergies", "hay fever", "sinusitis", "nasal congestion", "sneezing", "inflammation"],
        "description": "Plant flavonoid that stabilizes mast cells, preventing histamine release. Nature's antihistamine for allergy sufferers.",
        "benefits": ["Natural antihistamine", "Reduces allergy symptoms", "Anti-inflammatory", "Antioxidant support"],
        "dosage": "500–1000mg daily, ideally with vitamin C and bromelain for absorption",
        "cautions": ["May interact with certain antibiotics", "Take on empty stomach"],
        "amazon_query": "quercetin supplement with bromelain"
    },
    # ═══════════════════════════════════════
    # ENERGY & FOCUS
    # ═══════════════════════════════════════
    {
        "name": "Rhodiola Rosea",
        "category": "herbal",
        "tags": ["energy_focus", "sleep_stress", "mood"],
        "symptoms": ["fatigue", "low energy", "brain fog", "burnout", "mental fatigue", "low mood"],
        "description": "Arctic adaptogen that enhances cellular energy production and resilience to physical and mental stress.",
        "benefits": ["Fights fatigue", "Enhances mental performance", "Improves stress resilience", "Supports mood"],
        "dosage": "200–400mg standardized extract (3% rosavins) in the morning",
        "cautions": ["Take early in day (may affect sleep)", "Start with lower dose", "May interact with SSRIs"],
        "amazon_query": "rhodiola rosea supplement 400mg"
    },
    {
        "name": "Panax Ginseng",
        "category": "herbal",
        "tags": ["energy_focus", "immunity"],
        "symptoms": ["fatigue", "low energy", "poor concentration", "weak immunity", "exhaustion", "lack of motivation"],
        "description": "Traditional Chinese/Korean adaptogen that enhances physical stamina, mental clarity, and immune function.",
        "benefits": ["Boosts physical energy", "Enhances cognitive function", "Supports immune system", "Improves stamina"],
        "dosage": "200–400mg standardized extract daily",
        "cautions": ["May raise blood pressure", "Avoid with stimulants", "Cycle 2 weeks on, 1 week off"],
        "amazon_query": "panax ginseng supplement Korean"
    },
    {
        "name": "Lion's Mane Mushroom",
        "category": "supplement",
        "tags": ["energy_focus", "mood"],
        "symptoms": ["brain fog", "poor concentration", "memory problems", "mental fatigue", "poor focus"],
        "description": "Medicinal mushroom that stimulates Nerve Growth Factor (NGF), supporting neuroplasticity and cognitive function.",
        "benefits": ["Supports nerve regeneration", "Improves memory and focus", "Neuroprotective", "Supports mood"],
        "dosage": "500–1000mg extract 2x daily",
        "cautions": ["Generally very safe", "May cause mild digestive upset initially", "Avoid if allergic to mushrooms"],
        "amazon_query": "lions mane mushroom supplement extract"
    },
    {
        "name": "Maca Root",
        "category": "herbal",
        "tags": ["energy_focus", "mood"],
        "symptoms": ["fatigue", "low energy", "lack of motivation", "mood swings", "exhaustion"],
        "description": "Peruvian root vegetable (adaptogen) that supports energy, stamina, and hormonal balance without caffeine stimulation.",
        "benefits": ["Increases energy and stamina", "Supports hormonal balance", "Enhances mood", "Improves endurance"],
        "dosage": "1500–3000mg powder or equivalent extract daily",
        "cautions": ["Start low and build up", "Avoid with hormone-sensitive conditions", "May cause jitteriness in some"],
        "amazon_query": "organic maca root powder supplement"
    },
    {
        "name": "B-Complex Vitamins",
        "category": "supplement",
        "tags": ["energy_focus", "mood"],
        "symptoms": ["fatigue", "low energy", "brain fog", "irritability", "tiredness", "low mood"],
        "description": "Essential B vitamins (B1, B2, B3, B5, B6, B7, B9, B12) that are cofactors in cellular energy production and nervous system function.",
        "benefits": ["Supports energy metabolism", "Reduces fatigue", "Supports nervous system", "Enhances mood"],
        "dosage": "1 capsule daily with food — choose methylated forms",
        "cautions": ["May cause bright yellow urine (harmless — B2)", "Choose methylated B12 and folate"],
        "amazon_query": "B complex vitamin methylated supplement"
    },
    # ═══════════════════════════════════════
    # SKIN
    # ═══════════════════════════════════════
    {
        "name": "Neem",
        "category": "ayurvedic",
        "tags": ["skin", "immunity"],
        "symptoms": ["acne", "skin irritation", "eczema", "oily skin", "infections", "rash"],
        "description": "Ayurvedic 'village pharmacy' tree with powerful antibacterial, antifungal, and blood-purifying properties for clear skin.",
        "benefits": ["Clears acne", "Antibacterial and antifungal", "Purifies blood", "Reduces skin inflammation"],
        "dosage": "Neem oil topically (diluted), or 500mg leaf capsules daily",
        "cautions": ["Very bitter taste internally", "Do not use during pregnancy", "Dilute oil before skin application"],
        "amazon_query": "neem oil organic skin care"
    },
    {
        "name": "Aloe Vera",
        "category": "herbal",
        "tags": ["skin", "digestive"],
        "symptoms": ["dry skin", "skin irritation", "rash", "acid reflux", "itching", "redness"],
        "description": "Succulent plant gel rich in polysaccharides that deeply hydrate, soothe inflammation, and accelerate skin healing.",
        "benefits": ["Deeply hydrates skin", "Soothes sunburn and irritation", "Promotes wound healing", "Supports digestive lining"],
        "dosage": "Gel applied topically as needed, or 1–2 oz juice for digestive use",
        "cautions": ["Internal use may cause cramping", "Topical generally very safe", "Patch test first"],
        "amazon_query": "organic aloe vera gel pure"
    },
    {
        "name": "Tea Tree Oil",
        "category": "herbal",
        "tags": ["skin"],
        "symptoms": ["acne", "skin infections", "itching", "rash", "oily skin"],
        "description": "Australian essential oil with potent antimicrobial terpinen-4-ol that fights acne-causing bacteria and fungal infections.",
        "benefits": ["Fights acne bacteria", "Antifungal properties", "Reduces skin inflammation", "Natural antiseptic"],
        "dosage": "5% diluted solution applied topically to affected areas",
        "cautions": ["Never ingest", "Always dilute before applying", "May irritate sensitive skin — patch test first"],
        "amazon_query": "tea tree oil organic skin care"
    },
    {
        "name": "Collagen Peptides",
        "category": "supplement",
        "tags": ["skin", "joint_muscle"],
        "symptoms": ["aging skin", "wrinkles", "dry skin", "joint stiffness", "brittle hair"],
        "description": "Hydrolyzed collagen protein that provides building blocks for skin elasticity, joint cartilage, and hair/nail strength.",
        "benefits": ["Improves skin elasticity", "Reduces wrinkles", "Supports joint health", "Strengthens hair and nails"],
        "dosage": "10–15g powder daily in water, smoothies, or coffee",
        "cautions": ["Marine collagen for pescatarians", "Results take 4–8 weeks", "Choose grass-fed/pasture-raised"],
        "amazon_query": "collagen peptides powder grass fed"
    },
    # ═══════════════════════════════════════
    # JOINT & MUSCLE
    # ═══════════════════════════════════════
    {
        "name": "Glucosamine & Chondroitin",
        "category": "supplement",
        "tags": ["joint_muscle"],
        "symptoms": ["joint pain", "arthritis", "joint stiffness", "knee pain"],
        "description": "Building blocks of cartilage that support joint structure, lubrication, and repair. Most-studied joint supplement.",
        "benefits": ["Supports cartilage repair", "Reduces joint pain", "Improves joint mobility", "Slows cartilage degradation"],
        "dosage": "1500mg glucosamine + 1200mg chondroitin daily",
        "cautions": ["Shellfish-derived (alternatives available)", "Takes 4–8 weeks for results", "May affect blood sugar"],
        "amazon_query": "glucosamine chondroitin joint supplement"
    },
    {
        "name": "MSM (Methylsulfonylmethane)",
        "category": "supplement",
        "tags": ["joint_muscle", "pain_inflammation"],
        "symptoms": ["joint pain", "muscle pain", "inflammation", "arthritis", "stiffness", "muscle soreness"],
        "description": "Organic sulfur compound that supports connective tissue formation, reduces inflammation, and speeds muscle recovery.",
        "benefits": ["Reduces joint inflammation", "Supports connective tissue", "Speeds recovery", "Reduces exercise-induced pain"],
        "dosage": "1000–3000mg daily in divided doses",
        "cautions": ["Generally very safe", "May cause mild digestive upset initially", "Start low"],
        "amazon_query": "MSM supplement joint support"
    },
    # ═══════════════════════════════════════
    # HAIR
    # ═══════════════════════════════════════
    {
        "name": "Bhringraj",
        "category": "ayurvedic",
        "tags": ["hair"],
        "symptoms": ["hair loss", "thinning hair", "premature graying", "slow hair growth"],
        "description": "Known as 'King of Hair' in Ayurveda. Promotes hair growth, prevents premature graying, and nourishes the scalp.",
        "benefits": ["Promotes hair growth", "Prevents premature graying", "Strengthens hair follicles", "Nourishes scalp"],
        "dosage": "Bhringraj oil massage 2–3x weekly, or 500mg capsules daily",
        "cautions": ["Patch test oil first", "Generally very safe", "Best with consistent use"],
        "amazon_query": "bhringraj oil hair growth ayurvedic"
    },
    {
        "name": "Biotin (Vitamin B7)",
        "category": "supplement",
        "tags": ["hair", "skin"],
        "symptoms": ["hair loss", "thinning hair", "brittle hair", "brittle nails", "slow hair growth"],
        "description": "Essential B vitamin that supports keratin production — the protein that forms the structure of hair, skin, and nails.",
        "benefits": ["Strengthens hair", "Reduces hair shedding", "Strengthens nails", "Supports skin health"],
        "dosage": "2500–5000mcg daily",
        "cautions": ["Can interfere with certain blood tests (inform your lab)", "Results take 3–6 months"],
        "amazon_query": "biotin supplement 5000mcg hair growth"
    },
    # ═══════════════════════════════════════
    # MOOD
    # ═══════════════════════════════════════
    {
        "name": "St. John's Wort",
        "category": "herbal",
        "tags": ["mood"],
        "symptoms": ["depression", "low mood", "sadness", "seasonal affective", "mood swings"],
        "description": "Well-studied herbal antidepressant containing hypericin and hyperforin. Shown effective for mild-to-moderate depression.",
        "benefits": ["Supports positive mood", "Reduces mild depression symptoms", "Eases seasonal mood changes", "Well-researched"],
        "dosage": "300mg standardized extract (0.3% hypericin) 3x daily",
        "cautions": ["MANY drug interactions — check with pharmacist", "Causes sun sensitivity", "Do NOT combine with SSRIs/MAOIs",
                     "Takes 4–6 weeks for full effect"],
        "amazon_query": "St Johns Wort supplement 300mg"
    },
    {
        "name": "Saffron Extract",
        "category": "ayurvedic",
        "tags": ["mood", "sleep_stress"],
        "symptoms": ["depression", "low mood", "anxiety", "sadness", "mood swings", "emotional imbalance"],
        "description": "Precious spice with crocin and safranal compounds shown in clinical trials to improve mood comparably to some pharmaceuticals.",
        "benefits": ["Clinically proven mood support", "Reduces anxiety", "Supports emotional balance", "Has antioxidant properties"],
        "dosage": "30mg standardized extract daily",
        "cautions": ["Expensive but effective", "Avoid in pregnancy (high doses)", "Generally well tolerated"],
        "amazon_query": "saffron extract supplement mood support"
    },
    # ═══════════════════════════════════════
    # WEIGHT MANAGEMENT
    # ═══════════════════════════════════════
    {
        "name": "Green Tea Extract (EGCG)",
        "category": "herbal",
        "tags": ["weight", "energy_focus"],
        "symptoms": ["slow metabolism", "weight gain", "fatigue", "low energy", "brain fog"],
        "description": "Concentrated catechins (especially EGCG) that boost metabolism, enhance fat oxidation, and provide clean mental energy.",
        "benefits": ["Boosts metabolism", "Enhances fat burning", "Provides calm energy", "Powerful antioxidant"],
        "dosage": "250–500mg EGCG extract or 3–4 cups green tea daily",
        "cautions": ["Contains caffeine", "Take with food to avoid nausea", "Rare liver concerns at very high doses"],
        "amazon_query": "green tea extract EGCG supplement"
    },
    {
        "name": "Garcinia Cambogia",
        "category": "herbal",
        "tags": ["weight"],
        "symptoms": ["appetite control", "cravings", "weight gain", "overeating"],
        "description": "Tropical fruit rind containing hydroxycitric acid (HCA) that may reduce appetite and inhibit fat storage enzymes.",
        "benefits": ["Reduces appetite", "May inhibit fat storage", "Supports weight management", "Curbs cravings"],
        "dosage": "500–1000mg HCA 30–60 minutes before meals",
        "cautions": ["Modest effects — works best with diet/exercise", "May cause digestive upset", "Avoid with statins"],
        "amazon_query": "garcinia cambogia supplement HCA"
    },
    # ═══════════════════════════════════════
    # HEART & CIRCULATION
    # ═══════════════════════════════════════
    {
        "name": "Hawthorn Berry",
        "category": "herbal",
        "tags": ["heart"],
        "symptoms": ["palpitations", "high blood pressure", "poor circulation"],
        "description": "Traditional heart tonic rich in oligomeric procyanidins that strengthen heart muscle and improve blood flow.",
        "benefits": ["Supports heart muscle function", "Improves circulation", "Mild blood pressure support", "Rich in antioxidants"],
        "dosage": "250–500mg standardized extract 2–3x daily",
        "cautions": ["May interact with heart medications", "Takes several weeks for effect", "Consult doctor if on cardiac drugs"],
        "amazon_query": "hawthorn berry supplement heart"
    },
    {
        "name": "CoQ10 (Ubiquinol)",
        "category": "supplement",
        "tags": ["heart", "energy_focus"],
        "symptoms": ["fatigue", "low energy", "palpitations", "high blood pressure", "muscle weakness"],
        "description": "Essential coenzyme for mitochondrial energy production. Levels decline with age and are depleted by statin medications.",
        "benefits": ["Supports heart energy", "Powerful antioxidant", "Essential if on statins", "Boosts cellular energy"],
        "dosage": "100–300mg ubiquinol form daily with fatty meal",
        "cautions": ["Ubiquinol form better absorbed than ubiquinone", "May lower blood pressure slightly", "Check with doctor if on blood thinners"],
        "amazon_query": "CoQ10 ubiquinol supplement 200mg"
    },
    {
        "name": "Guggul",
        "category": "ayurvedic",
        "tags": ["heart", "weight"],
        "symptoms": ["high cholesterol", "weight gain", "slow metabolism", "inflammation"],
        "description": "Ayurvedic resin (Commiphora mukul) traditionally used to balance lipids, support metabolism, and reduce inflammation.",
        "benefits": ["Supports healthy cholesterol levels", "Boosts metabolism", "Anti-inflammatory", "Traditional detoxifier"],
        "dosage": "500–1000mg standardized extract (guggulsterones) daily",
        "cautions": ["May interact with thyroid medication", "May affect blood clotting", "GI upset possible"],
        "amazon_query": "guggul extract supplement cholesterol"
    },
]


def get_matching_remedies(symptoms: list[str], answers: dict) -> list[dict]:
    """
    Match user symptoms to remedies, score them, and return sorted results.
    """
    symptom_set = set(s.lower().strip() for s in symptoms)

    # Find which categories are relevant
    active_categories = set()
    for cat, cat_symptoms in SYMPTOM_CATEGORIES.items():
        if symptom_set & set(cat_symptoms):
            active_categories.add(cat)

    # Preference filter
    preference = answers.get("preference", "No preference")
    pref_map = {
        "Ayurvedic": "ayurvedic",
        "Herbal": "herbal",
        "Supplements": "supplement",
    }
    preferred_category = None
    for key, val in pref_map.items():
        if key.lower() in preference.lower():
            preferred_category = val
            break

    # Score remedies
    scored = []
    for remedy in REMEDIES:
        score = 0

        # Direct symptom match
        remedy_symptoms = set(s.lower() for s in remedy["symptoms"])
        matches = symptom_set & remedy_symptoms
        score += len(matches) * 3

        # Category match
        remedy_tags = set(remedy.get("tags", []))
        cat_matches = active_categories & remedy_tags
        score += len(cat_matches) * 1

        if score == 0:
            continue

        # Preference boost
        if preferred_category and remedy["category"] == preferred_category:
            score += 2
        elif preferred_category and remedy["category"] != preferred_category:
            score -= 1

        # Severity adjustment
        severity = answers.get("severity", "")
        if "severe" in severity.lower():
            # Prioritize stronger/well-studied remedies
            if any(w in remedy["name"].lower() for w in ["turmeric", "boswellia", "omega", "ashwagandha", "magnesium"]):
                score += 1

        # Medication interactions — flag but don't exclude
        medications = answers.get("medications", "")
        if "blood thinner" in medications.lower():
            if any("blood thinner" in c.lower() for c in remedy.get("cautions", [])):
                remedy = {**remedy, "_interaction_warning": True}

        remedy_copy = {**remedy}
        remedy_copy["score"] = score
        remedy_copy["matched_symptoms"] = list(matches)
        remedy_copy["amazon_url"] = f"https://www.amazon.com/s?k={remedy['amazon_query'].replace(' ', '+')}"
        scored.append(remedy_copy)

    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)

    return scored[:15]  # Return top 15 matches
