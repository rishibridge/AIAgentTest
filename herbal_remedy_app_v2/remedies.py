"""
NatureCure V2 — Expanded Herbal Remedy Knowledge Base
75+ remedies across 18 categories with evidence tiers and PubMed citations.
"""

from remedy_engine import get_matching_remedies as _match

SYMPTOM_CATEGORIES = {
    "digestive": [
        "bloating",
        "gas",
        "indigestion",
        "nausea",
        "constipation",
        "diarrhea",
        "acid reflux",
        "heartburn",
        "stomach pain",
        "stomach cramps",
        "appetite loss",
        "ibs",
        "irritable bowel",
        "leaky gut",
        "food intolerance"
    ],
    "sleep_stress": [
        "insomnia",
        "anxiety",
        "stress",
        "nervousness",
        "restlessness",
        "sleep problems",
        "trouble sleeping",
        "poor sleep",
        "racing thoughts",
        "tension",
        "panic",
        "worry",
        "overwhelm",
        "burnout"
    ],
    "immunity": [
        "frequent colds",
        "weak immunity",
        "flu",
        "cold",
        "sore throat",
        "congestion",
        "runny nose",
        "sneezing",
        "fever",
        "infections",
        "low immunity",
        "getting sick often"
    ],
    "pain_inflammation": [
        "headache",
        "migraine",
        "back pain",
        "joint pain",
        "muscle pain",
        "inflammation",
        "swelling",
        "arthritis",
        "chronic pain",
        "body aches",
        "neck pain",
        "shoulder pain",
        "knee pain",
        "stiffness"
    ],
    "respiratory": [
        "cough",
        "shortness of breath",
        "wheezing",
        "bronchitis",
        "chest congestion",
        "sinus pressure",
        "sinusitis",
        "allergies",
        "hay fever",
        "nasal congestion",
        "post nasal drip",
        "asthma symptoms"
    ],
    "energy_focus": [
        "fatigue",
        "low energy",
        "brain fog",
        "poor concentration",
        "lack of motivation",
        "mental fatigue",
        "drowsiness",
        "lethargy",
        "exhaustion",
        "poor focus",
        "memory problems",
        "tiredness"
    ],
    "skin": [
        "acne",
        "eczema",
        "dry skin",
        "rash",
        "itching",
        "psoriasis",
        "skin irritation",
        "oily skin",
        "dark spots",
        "aging skin",
        "wrinkles",
        "skin inflammation",
        "hives",
        "redness"
    ],
    "joint_muscle": [
        "joint stiffness",
        "muscle cramps",
        "muscle soreness",
        "tendinitis",
        "carpal tunnel",
        "fibromyalgia",
        "sciatica",
        "bursitis",
        "muscle weakness",
        "muscle tension",
        "sprain",
        "strain"
    ],
    "hair": [
        "hair loss",
        "thinning hair",
        "dandruff",
        "dry hair",
        "brittle hair",
        "premature graying",
        "slow hair growth",
        "scalp issues"
    ],
    "mood": [
        "depression",
        "mood swings",
        "irritability",
        "sadness",
        "low mood",
        "seasonal affective",
        "emotional imbalance",
        "apathy"
    ],
    "weight": [
        "weight gain",
        "slow metabolism",
        "water retention",
        "belly fat",
        "appetite control",
        "cravings",
        "overeating",
        "binge eating"
    ],
    "heart": [
        "high blood pressure",
        "high cholesterol",
        "poor circulation",
        "palpitations",
        "varicose veins",
        "cold hands",
        "cold feet"
    ],
    "womens_health": [
        "period cramps",
        "pms",
        "menstrual pain",
        "irregular periods",
        "hot flashes",
        "menopause",
        "hormonal imbalance",
        "breast tenderness",
        "heavy periods",
        "mood swings menstrual"
    ],
    "liver_detox": [
        "liver support",
        "hangover",
        "detox",
        "toxin buildup",
        "fatty liver",
        "alcohol recovery",
        "sluggish liver"
    ],
    "gut_microbiome": [
        "gut health",
        "microbiome",
        "bloating after antibiotics",
        "candida",
        "yeast infection",
        "probiotic need",
        "digestive flora"
    ],
    "blood_sugar": [
        "blood sugar",
        "insulin resistance",
        "sugar cravings",
        "pre diabetes",
        "glucose control",
        "metabolic syndrome"
    ],
    "mens_health": [
        "prostate",
        "low testosterone",
        "male vitality",
        "erectile issues",
        "prostate enlargement"
    ],
    "urinary": [
        "uti",
        "bladder infection",
        "frequent urination",
        "kidney support",
        "urinary tract"
    ]
}

ALL_SYMPTOMS = sorted(set(
    symptom for symptoms in SYMPTOM_CATEGORIES.values() for symptom in symptoms
))

FOLLOW_UP_QUESTIONS = [
    {
        "id": "severity",
        "question": "How severe are your symptoms?",
        "options": [
            "Mild \u2014 Noticeable but not disruptive",
            "Moderate \u2014 Affects daily activities",
            "Severe \u2014 Significantly impacts quality of life"
        ]
    },
    {
        "id": "duration",
        "question": "How long have you been experiencing these symptoms?",
        "options": [
            "Less than a week",
            "1\u20134 weeks",
            "1\u20133 months",
            "More than 3 months"
        ]
    },
    {
        "id": "preference",
        "question": "Do you have a preference for remedy type?",
        "options": [
            "Ayurvedic (traditional Indian medicine)",
            "Herbal (plant-based remedies)",
            "Supplements (vitamins, minerals, extracts)",
            "No preference \u2014 show me everything"
        ]
    },
    {
        "id": "allergies",
        "question": "Do you have any known allergies or sensitivities?",
        "options": [
            "None that I know of",
            "Ragweed / daisy family plants",
            "Shellfish (affects glucosamine)",
            "Nightshade family (tomatoes, peppers)",
            "Soy or dairy"
        ]
    },
    {
        "id": "medications",
        "question": "Are you currently taking any medications?",
        "options": [
            "No medications",
            "Blood thinners",
            "Blood pressure medication",
            "Antidepressants / anti-anxiety",
            "Thyroid medication",
            "Diabetes medication",
            "Other prescription medication"
        ]
    },
    {
        "id": "supplements",
        "question": "Are you currently taking any supplements?",
        "options": [
            "No supplements",
            "Multivitamin",
            "Fish oil / Omega-3",
            "Vitamin D",
            "Magnesium",
            "Probiotics",
            "Turmeric / Curcumin",
            "Herbal supplements",
            "Other supplements"
        ]
    },
    {
        "id": "conditions",
        "question": "Have you been diagnosed with any of these conditions?",
        "options": [
            "None",
            "High blood pressure",
            "Diabetes / blood sugar issues",
            "Thyroid disorder",
            "Liver or kidney condition",
            "Autoimmune condition",
            "Anxiety or depression",
            "Other condition"
        ]
    },
    {
        "id": "pregnancy",
        "question": "Are you pregnant or nursing?",
        "options": [
            "No",
            "Yes \u2014 pregnant",
            "Yes \u2014 nursing",
            "Trying to conceive"
        ]
    },
    {
        "id": "age",
        "question": "What is your age range?",
        "options": [
            "Under 18",
            "18\u201330",
            "31\u201350",
            "51\u201365",
            "Over 65"
        ]
    }
]

REMEDIES = [
    {
        "name": "Turmeric (Curcumin)",
        "category": "ayurvedic",
        "tags": [
            "digestive",
            "pain_inflammation",
            "skin"
        ],
        "symptoms": [
            "bloating",
            "indigestion",
            "inflammation",
            "joint pain",
            "skin inflammation",
            "arthritis"
        ],
        "description": "Golden spice with curcumin \u2014 a potent anti-inflammatory and antioxidant compound used in Ayurveda for centuries.",
        "benefits": [
            "Reduces digestive inflammation",
            "Eases bloating and gas",
            "Supports joint health",
            "Antioxidant protection"
        ],
        "dosage": "500\u20132000mg curcumin daily with black pepper (piperine) for absorption",
        "cautions": [
            "May interact with blood thinners",
            "High doses may cause stomach upset",
            "Avoid before surgery"
        ],
        "amazon_query": "turmeric curcumin supplement with bioperine",
        "evidence_level": "strong",
        "references": [
            [
                "Hewlings & Kalman: Curcumin \u2014 A Review",
                "https://pubmed.ncbi.nlm.nih.gov/29065496/",
                2017
            ],
            [
                "Daily et al: Efficacy of Turmeric Extracts",
                "https://pubmed.ncbi.nlm.nih.gov/27213821/",
                2016
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood thinner",
                "warning": "Curcumin may increase bleeding risk with anticoagulants."
            }
        ]
    },
    {
        "name": "Ginger Root",
        "category": "herbal",
        "tags": [
            "digestive",
            "pain_inflammation",
            "immunity"
        ],
        "symptoms": [
            "nausea",
            "indigestion",
            "bloating",
            "stomach pain",
            "cold",
            "inflammation"
        ],
        "description": "A warming root containing gingerols and shogaols that soothe the GI tract and reduce inflammation.",
        "benefits": [
            "Relieves nausea and morning sickness",
            "Aids digestion",
            "Anti-inflammatory",
            "Supports immune function"
        ],
        "dosage": "250\u20131000mg dried ginger or fresh ginger tea 2\u20133 times daily",
        "cautions": [
            "May interact with blood thinners",
            "High doses may cause heartburn"
        ],
        "amazon_query": "organic ginger root supplement capsules",
        "evidence_level": "strong",
        "references": [
            [
                "Lete & Allu\u00e9: Effectiveness of Ginger for Nausea",
                "https://pubmed.ncbi.nlm.nih.gov/26228533/",
                2016
            ],
            [
                "Terry et al: Ginger \u2014 Systematic Review",
                "https://pubmed.ncbi.nlm.nih.gov/20842291/",
                2011
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood thinner",
                "warning": "Ginger may increase bleeding risk."
            }
        ]
    },
    {
        "name": "Triphala",
        "category": "ayurvedic",
        "tags": [
            "digestive"
        ],
        "symptoms": [
            "constipation",
            "bloating",
            "indigestion",
            "ibs",
            "appetite loss"
        ],
        "description": "Classic Ayurvedic formula combining three fruits (Amalaki, Bibhitaki, Haritaki) for digestive support.",
        "benefits": [
            "Gentle natural laxative",
            "Supports regularity",
            "Detoxification support",
            "Rich in antioxidants"
        ],
        "dosage": "500\u20131000mg before bed or \u00bd tsp powder in warm water",
        "cautions": [
            "May cause loose stools initially",
            "Avoid during pregnancy"
        ],
        "amazon_query": "triphala supplement organic",
        "evidence_level": "traditional",
        "references": [
            [
                "Peterson et al: Triphala \u2014 Therapeutic Uses",
                "https://pubmed.ncbi.nlm.nih.gov/28696777/",
                2017
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Peppermint",
        "category": "herbal",
        "tags": [
            "digestive",
            "respiratory"
        ],
        "symptoms": [
            "bloating",
            "gas",
            "ibs",
            "stomach cramps",
            "indigestion",
            "nausea",
            "headache"
        ],
        "description": "Cooling herb with menthol that relaxes GI smooth muscle, relieving digestive discomfort.",
        "benefits": [
            "Relieves IBS symptoms",
            "Reduces bloating and gas",
            "Soothes stomach cramps",
            "Freshens breath"
        ],
        "dosage": "1\u20132 enteric-coated capsules (0.2mL oil) or peppermint tea 2\u20133x daily",
        "cautions": [
            "May worsen acid reflux/GERD",
            "Enteric coating important for IBS use"
        ],
        "amazon_query": "peppermint oil capsules enteric coated",
        "evidence_level": "strong",
        "references": [
            [
                "Alammar et al: Peppermint Oil for IBS \u2014 Meta-analysis",
                "https://pubmed.ncbi.nlm.nih.gov/30654773/",
                2019
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Fennel Seed",
        "category": "ayurvedic",
        "tags": [
            "digestive"
        ],
        "symptoms": [
            "bloating",
            "gas",
            "acid reflux",
            "stomach cramps",
            "indigestion"
        ],
        "description": "Aromatic seed containing anethole that relaxes the digestive tract. Used in Ayurveda as a digestive tonic.",
        "benefits": [
            "Relieves gas and bloating",
            "Soothes stomach cramps",
            "Supports healthy digestion",
            "Freshens breath naturally"
        ],
        "dosage": "1 tsp seeds chewed after meals or fennel tea 2\u20133x daily",
        "cautions": [
            "Generally very safe",
            "Avoid in large amounts during pregnancy"
        ],
        "amazon_query": "organic fennel seed tea",
        "evidence_level": "traditional",
        "references": [
            [
                "Badgujar et al: Fenugreek & Fennel Review",
                "https://pubmed.ncbi.nlm.nih.gov/25276048/",
                2014
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Digestive Enzymes",
        "category": "supplement",
        "tags": [
            "digestive"
        ],
        "symptoms": [
            "bloating",
            "indigestion",
            "gas",
            "stomach pain",
            "constipation",
            "food intolerance"
        ],
        "description": "Blend of enzymes (protease, lipase, amylase) that improve food breakdown and nutrient absorption.",
        "benefits": [
            "Improves nutrient absorption",
            "Reduces post-meal bloating",
            "Helps with food intolerances",
            "Supports overall digestion"
        ],
        "dosage": "1 capsule with each meal",
        "cautions": [
            "Choose broad-spectrum formula",
            "Start with lower dose"
        ],
        "amazon_query": "digestive enzyme supplement broad spectrum",
        "evidence_level": "moderate",
        "references": [
            [
                "Ianiro et al: Digestive Enzyme Supplements",
                "https://pubmed.ncbi.nlm.nih.gov/27793210/",
                2016
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Slippery Elm",
        "category": "herbal",
        "tags": [
            "digestive",
            "gut_microbiome"
        ],
        "symptoms": [
            "acid reflux",
            "heartburn",
            "ibs",
            "stomach pain",
            "leaky gut",
            "gut health"
        ],
        "description": "Inner bark mucilage that coats and soothes the digestive lining, reducing irritation and inflammation.",
        "benefits": [
            "Soothes irritated gut lining",
            "Relieves heartburn",
            "Prebiotic fiber source",
            "Supports IBS management"
        ],
        "dosage": "400\u2013500mg capsules before meals or 1 tbsp powder in water",
        "cautions": [
            "May slow absorption of medications \u2014 take 2 hrs apart",
            "Generally very safe"
        ],
        "amazon_query": "slippery elm bark supplement",
        "evidence_level": "traditional",
        "references": [
            [
                "Hawrelak & Myers: Slippery Elm for IBS",
                "https://pubmed.ncbi.nlm.nih.gov/20214759/",
                2010
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Probiotics (Multi-Strain)",
        "category": "supplement",
        "tags": [
            "gut_microbiome",
            "digestive",
            "immunity"
        ],
        "symptoms": [
            "gut health",
            "bloating after antibiotics",
            "digestive flora",
            "microbiome",
            "ibs",
            "weak immunity"
        ],
        "description": "Live beneficial bacteria that restore gut microbiome balance. Best studied with Lactobacillus and Bifidobacterium strains.",
        "benefits": [
            "Restores gut flora after antibiotics",
            "Reduces bloating and IBS symptoms",
            "Supports immune function",
            "Improves nutrient absorption"
        ],
        "dosage": "10\u201350 billion CFU daily with multiple strains",
        "cautions": [
            "Refrigerated strains may be more effective",
            "May cause initial gas/bloating",
            "Choose spore-based for shelf stability"
        ],
        "amazon_query": "probiotic supplement 50 billion CFU",
        "evidence_level": "strong",
        "references": [
            [
                "Ford et al: Probiotics in IBS \u2014 Meta-analysis",
                "https://pubmed.ncbi.nlm.nih.gov/29460487/",
                2018
            ],
            [
                "Hao et al: Probiotics for Upper Respiratory Infections",
                "https://pubmed.ncbi.nlm.nih.gov/25927096/",
                2015
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Ashwagandha",
        "category": "ayurvedic",
        "tags": [
            "sleep_stress",
            "energy_focus",
            "immunity"
        ],
        "symptoms": [
            "stress",
            "anxiety",
            "insomnia",
            "fatigue",
            "low energy",
            "burnout",
            "nervousness"
        ],
        "description": "Premier Ayurvedic adaptogen (Withania somnifera) that helps the body resist stress while promoting calm energy.",
        "benefits": [
            "Reduces cortisol levels",
            "Improves sleep quality",
            "Enhances mental clarity",
            "Boosts stamina and energy"
        ],
        "dosage": "300\u2013600mg KSM-66 or Sensoril extract daily",
        "cautions": [
            "May interact with thyroid medication",
            "Avoid during pregnancy",
            "Nightshade family plant"
        ],
        "amazon_query": "ashwagandha KSM-66 supplement",
        "evidence_level": "strong",
        "references": [
            [
                "Chandrasekhar et al: Ashwagandha Root for Stress",
                "https://pubmed.ncbi.nlm.nih.gov/23439798/",
                2012
            ],
            [
                "Salve et al: Ashwagandha for Sleep",
                "https://pubmed.ncbi.nlm.nih.gov/31728244/",
                2019
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "thyroid medication",
                "warning": "May alter thyroid hormone levels."
            }
        ]
    },
    {
        "name": "Valerian Root",
        "category": "herbal",
        "tags": [
            "sleep_stress"
        ],
        "symptoms": [
            "insomnia",
            "sleep problems",
            "trouble sleeping",
            "anxiety",
            "restlessness"
        ],
        "description": "Traditional herbal sedative that increases GABA activity in the brain for natural relaxation.",
        "benefits": [
            "Promotes faster sleep onset",
            "Improves sleep quality",
            "Reduces nighttime waking",
            "Eases anxiety naturally"
        ],
        "dosage": "300\u2013600mg extract 30\u201360 minutes before bed",
        "cautions": [
            "May cause morning grogginess",
            "Don't combine with sleep medications",
            "Takes 2\u20134 weeks for full effect"
        ],
        "amazon_query": "valerian root sleep supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Bent et al: Valerian for Sleep \u2014 Systematic Review",
                "https://pubmed.ncbi.nlm.nih.gov/17145239/",
                2006
            ],
            [
                "Fern\u00e1ndez-San-Mart\u00edn et al: Valerian Efficacy",
                "https://pubmed.ncbi.nlm.nih.gov/20347389/",
                2010
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "antidepressants",
                "warning": "May amplify sedative effects of SSRIs/benzodiazepines."
            }
        ]
    },
    {
        "name": "Chamomile",
        "category": "herbal",
        "tags": [
            "sleep_stress",
            "digestive"
        ],
        "symptoms": [
            "insomnia",
            "anxiety",
            "stress",
            "restlessness",
            "stomach cramps",
            "indigestion"
        ],
        "description": "Gentle herb with apigenin that binds to GABA receptors, promoting relaxation without heavy sedation.",
        "benefits": [
            "Promotes relaxation",
            "Supports sleep",
            "Soothes digestive upset",
            "Mild anti-inflammatory"
        ],
        "dosage": "1\u20132 cups chamomile tea before bed or 400\u20131600mg extract",
        "cautions": [
            "Ragweed allergy cross-reactivity",
            "May interact with blood thinners"
        ],
        "amazon_query": "organic chamomile tea bags",
        "evidence_level": "moderate",
        "references": [
            [
                "Amsterdam et al: Chamomile for GAD",
                "https://pubmed.ncbi.nlm.nih.gov/19593179/",
                2009
            ],
            [
                "Srivastava et al: Chamomile \u2014 Review",
                "https://pubmed.ncbi.nlm.nih.gov/20929128/",
                2010
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Magnesium Glycinate",
        "category": "supplement",
        "tags": [
            "sleep_stress",
            "joint_muscle",
            "mood"
        ],
        "symptoms": [
            "insomnia",
            "anxiety",
            "muscle cramps",
            "stress",
            "restlessness",
            "muscle tension",
            "irritability"
        ],
        "description": "Highly bioavailable magnesium chelated with glycine. Both compounds support calm and relaxation.",
        "benefits": [
            "Promotes deep, restful sleep",
            "Relaxes muscles",
            "Calms the nervous system",
            "Supports mood stability"
        ],
        "dosage": "200\u2013400mg elemental magnesium before bed",
        "cautions": [
            "High doses may cause loose stools",
            "Check with doctor if on heart/kidney meds"
        ],
        "amazon_query": "magnesium glycinate supplement 400mg",
        "evidence_level": "strong",
        "references": [
            [
                "Abbasi et al: Magnesium and Sleep Quality",
                "https://pubmed.ncbi.nlm.nih.gov/23853635/",
                2012
            ],
            [
                "Boyle et al: Magnesium and Stress",
                "https://pubmed.ncbi.nlm.nih.gov/28445426/",
                2017
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Passionflower",
        "category": "herbal",
        "tags": [
            "sleep_stress"
        ],
        "symptoms": [
            "anxiety",
            "insomnia",
            "nervousness",
            "racing thoughts",
            "restlessness",
            "tension"
        ],
        "description": "Tropical vine flower that boosts GABA levels. Some studies suggest anxiety-reducing effects comparable to low-dose anxiolytics.",
        "benefits": [
            "Reduces anxiety",
            "Calms racing thoughts",
            "Improves sleep quality",
            "Non-habit forming"
        ],
        "dosage": "500mg extract or tea 1 hour before bed",
        "cautions": [
            "May cause drowsiness",
            "Avoid with sedative medications"
        ],
        "amazon_query": "passionflower extract supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Akhondzadeh et al: Passionflower vs Oxazepam",
                "https://pubmed.ncbi.nlm.nih.gov/11679026/",
                2001
            ],
            [
                "Ngan & Conduit: Passionflower Tea and Sleep",
                "https://pubmed.ncbi.nlm.nih.gov/21294203/",
                2011
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "L-Theanine",
        "category": "supplement",
        "tags": [
            "sleep_stress",
            "energy_focus"
        ],
        "symptoms": [
            "anxiety",
            "stress",
            "poor concentration",
            "racing thoughts",
            "tension",
            "poor focus"
        ],
        "description": "Amino acid from green tea that promotes calm alertness by boosting alpha brain waves and GABA.",
        "benefits": [
            "Reduces anxiety without drowsiness",
            "Improves focus and concentration",
            "Promotes relaxation",
            "Enhances sleep quality"
        ],
        "dosage": "100\u2013200mg 1\u20132 times daily",
        "cautions": [
            "Very safe profile",
            "May enhance effects of blood pressure medications"
        ],
        "amazon_query": "L-theanine supplement 200mg",
        "evidence_level": "strong",
        "references": [
            [
                "Hidese et al: L-Theanine for Stress and Cognition",
                "https://pubmed.ncbi.nlm.nih.gov/31623400/",
                2019
            ],
            [
                "Nobre et al: L-Theanine and Alpha Brain Waves",
                "https://pubmed.ncbi.nlm.nih.gov/18296328/",
                2008
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Brahmi (Bacopa monnieri)",
        "category": "ayurvedic",
        "tags": [
            "sleep_stress",
            "energy_focus"
        ],
        "symptoms": [
            "anxiety",
            "brain fog",
            "poor concentration",
            "memory problems",
            "stress"
        ],
        "description": "Sacred Ayurvedic herb for cognitive function. Results build over 8\u201312 weeks of consistent use.",
        "benefits": [
            "Enhances memory",
            "Reduces anxiety",
            "Improves learning",
            "Neuroprotective"
        ],
        "dosage": "300\u2013450mg standardized extract daily",
        "cautions": [
            "May cause GI upset initially",
            "Takes 8\u201312 weeks for full cognitive effects"
        ],
        "amazon_query": "bacopa monnieri brahmi supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Kongkeaw et al: Bacopa Meta-Analysis",
                "https://pubmed.ncbi.nlm.nih.gov/24252493/",
                2014
            ],
            [
                "Pase et al: Bacopa and Cognition",
                "https://pubmed.ncbi.nlm.nih.gov/22747190/",
                2012
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Lemon Balm",
        "category": "herbal",
        "tags": [
            "sleep_stress",
            "digestive"
        ],
        "symptoms": [
            "anxiety",
            "stress",
            "insomnia",
            "restlessness",
            "indigestion",
            "nervousness"
        ],
        "description": "Mint-family herb with rosmarinic acid that calms the nervous system and eases digestive tension.",
        "benefits": [
            "Reduces anxiety and stress",
            "Promotes restful sleep",
            "Soothes digestive discomfort",
            "Enhances mood"
        ],
        "dosage": "300\u2013600mg extract or 2\u20133 cups tea daily",
        "cautions": [
            "Generally very safe",
            "May interact with thyroid medications",
            "May enhance sedative effects"
        ],
        "amazon_query": "lemon balm extract supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Cases et al: Lemon Balm for Anxiety and Sleep",
                "https://pubmed.ncbi.nlm.nih.gov/21036578/",
                2011
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "thyroid medication",
                "warning": "May interfere with thyroid hormone absorption."
            }
        ]
    },
    {
        "name": "Elderberry",
        "category": "herbal",
        "tags": [
            "immunity",
            "respiratory"
        ],
        "symptoms": [
            "cold",
            "flu",
            "sore throat",
            "congestion",
            "weak immunity",
            "frequent colds"
        ],
        "description": "Dark purple berry rich in anthocyanins and vitamin C. May reduce cold and flu duration by 1\u20132 days.",
        "benefits": [
            "May shorten cold/flu duration",
            "Rich in antioxidants",
            "Supports immune response",
            "Natural anti-viral properties"
        ],
        "dosage": "600\u2013900mg extract daily during illness, 300mg for prevention",
        "cautions": [
            "Only use commercially prepared products (raw berries toxic)",
            "May stimulate immune system (caution with autoimmune)"
        ],
        "amazon_query": "elderberry supplement immune support",
        "evidence_level": "moderate",
        "references": [
            [
                "Hawkins et al: Elderberry Meta-Analysis",
                "https://pubmed.ncbi.nlm.nih.gov/30670267/",
                2019
            ],
            [
                "Tiralongo et al: Elderberry and Air Travellers",
                "https://pubmed.ncbi.nlm.nih.gov/26922132/",
                2016
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Echinacea",
        "category": "herbal",
        "tags": [
            "immunity",
            "respiratory"
        ],
        "symptoms": [
            "cold",
            "flu",
            "sore throat",
            "weak immunity",
            "infections",
            "congestion"
        ],
        "description": "North American coneflower that activates immune cells. Most effective at the first sign of cold symptoms.",
        "benefits": [
            "Boosts immune cell activity",
            "Reduces cold severity",
            "Speeds recovery",
            "Anti-inflammatory"
        ],
        "dosage": "300\u2013500mg 3x daily at onset of symptoms, for up to 10 days",
        "cautions": [
            "Ragweed allergy cross-reactivity",
            "Not for long-term continuous use",
            "Avoid with immunosuppressants"
        ],
        "amazon_query": "echinacea supplement immune",
        "evidence_level": "moderate",
        "references": [
            [
                "Shah et al: Echinacea Meta-Analysis",
                "https://pubmed.ncbi.nlm.nih.gov/17597571/",
                2007
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Vitamin C",
        "category": "supplement",
        "tags": [
            "immunity",
            "skin"
        ],
        "symptoms": [
            "cold",
            "flu",
            "weak immunity",
            "frequent colds",
            "aging skin"
        ],
        "description": "Essential antioxidant vitamin supporting immune cell function and collagen production.",
        "benefits": [
            "Supports immune function",
            "Powerful antioxidant",
            "Promotes collagen synthesis",
            "Enhances iron absorption"
        ],
        "dosage": "500\u20131000mg daily, up to 2000mg during illness",
        "cautions": [
            "High doses may cause digestive upset",
            "Liposomal form better absorbed"
        ],
        "amazon_query": "vitamin C 1000mg supplement",
        "evidence_level": "strong",
        "references": [
            [
                "Hemil\u00e4 & Chalker: Vitamin C for Common Cold",
                "https://pubmed.ncbi.nlm.nih.gov/23440782/",
                2013
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Zinc",
        "category": "supplement",
        "tags": [
            "immunity",
            "skin"
        ],
        "symptoms": [
            "cold",
            "sore throat",
            "weak immunity",
            "frequent colds",
            "acne"
        ],
        "description": "Essential trace mineral critical for immune cell development. Zinc lozenges may reduce cold duration by ~33%.",
        "benefits": [
            "Shortens cold duration",
            "Supports immune cell function",
            "Promotes wound healing",
            "Supports skin health"
        ],
        "dosage": "15\u201330mg daily, zinc lozenges for active colds",
        "cautions": [
            "Don't exceed 40mg daily long-term",
            "Take with food to avoid nausea",
            "Can reduce copper absorption"
        ],
        "amazon_query": "zinc supplement lozenges immune",
        "evidence_level": "strong",
        "references": [
            [
                "Science et al: Zinc for the Common Cold",
                "https://pubmed.ncbi.nlm.nih.gov/22566526/",
                2012
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Tulsi (Holy Basil)",
        "category": "ayurvedic",
        "tags": [
            "immunity",
            "sleep_stress",
            "respiratory"
        ],
        "symptoms": [
            "stress",
            "cold",
            "cough",
            "weak immunity",
            "anxiety",
            "congestion"
        ],
        "description": "Sacred Ayurvedic adaptogen known as 'The Queen of Herbs' \u2014 supports both immunity and stress resilience.",
        "benefits": [
            "Adaptogenic stress support",
            "Boosts immune function",
            "Eases respiratory issues",
            "Balances cortisol"
        ],
        "dosage": "300\u2013600mg extract or 2\u20133 cups tulsi tea daily",
        "cautions": [
            "May lower blood sugar",
            "Avoid before surgery",
            "May affect fertility at very high doses"
        ],
        "amazon_query": "tulsi holy basil supplement organic",
        "evidence_level": "moderate",
        "references": [
            [
                "Cohen: Tulsi (Holy Basil) \u2014 Review",
                "https://pubmed.ncbi.nlm.nih.gov/25006348/",
                2014
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "diabetes medication",
                "warning": "May lower blood sugar; monitor levels."
            }
        ]
    },
    {
        "name": "Vitamin D3",
        "category": "supplement",
        "tags": [
            "immunity",
            "mood",
            "joint_muscle"
        ],
        "symptoms": [
            "weak immunity",
            "frequent colds",
            "low mood",
            "seasonal affective",
            "joint pain",
            "fatigue"
        ],
        "description": "The 'sunshine vitamin' \u2014 most adults are deficient. Critical for immune regulation and mood.",
        "benefits": [
            "Strengthens immune defense",
            "Supports mood and mental health",
            "Essential for bone health",
            "Reduces infection risk"
        ],
        "dosage": "1000\u20135000 IU daily with a fatty meal",
        "cautions": [
            "Get levels tested ideally",
            "Take with vitamin K2 for best results",
            "Fat-soluble \u2014 don't mega-dose"
        ],
        "amazon_query": "vitamin D3 K2 supplement 5000 IU",
        "evidence_level": "strong",
        "references": [
            [
                "Martineau et al: Vitamin D and Respiratory Infections",
                "https://pubmed.ncbi.nlm.nih.gov/28202713/",
                2017
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Boswellia (Indian Frankincense)",
        "category": "ayurvedic",
        "tags": [
            "pain_inflammation",
            "joint_muscle"
        ],
        "symptoms": [
            "joint pain",
            "arthritis",
            "inflammation",
            "stiffness",
            "knee pain",
            "back pain"
        ],
        "description": "Ayurvedic resin extract that inhibits 5-LOX enzyme. Shows promise in clinical trials for joint pain relief.",
        "benefits": [
            "Reduces joint inflammation",
            "Improves mobility",
            "Supports cartilage health",
            "Fast-acting pain relief"
        ],
        "dosage": "300\u2013500mg standardized extract (AKBA) 2\u20133x daily",
        "cautions": [
            "Generally well tolerated",
            "May interact with anti-inflammatory drugs"
        ],
        "amazon_query": "boswellia serrata extract supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Sengupta et al: 5-Loxin for OA",
                "https://pubmed.ncbi.nlm.nih.gov/18544350/",
                2008
            ],
            [
                "Yu et al: Boswellia Meta-Analysis",
                "https://pubmed.ncbi.nlm.nih.gov/31640888/",
                2020
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Willow Bark",
        "category": "herbal",
        "tags": [
            "pain_inflammation"
        ],
        "symptoms": [
            "headache",
            "back pain",
            "joint pain",
            "muscle pain",
            "chronic pain",
            "inflammation"
        ],
        "description": "Contains salicin \u2014 converting to salicylic acid for pain relief. The natural precursor to aspirin.",
        "benefits": [
            "Natural pain relief",
            "Reduces inflammation",
            "Eases headaches",
            "May be gentler on stomach than aspirin in some individuals"
        ],
        "dosage": "240mg salicin daily in divided doses",
        "cautions": [
            "Same contraindications as aspirin",
            "Avoid with blood thinners",
            "Not for children",
            "Avoid if aspirin-allergic"
        ],
        "amazon_query": "willow bark extract supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Vlachojannis et al: Willow Bark for Pain",
                "https://pubmed.ncbi.nlm.nih.gov/19140159/",
                2009
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": True,
        "interactions": [
            {
                "med": "blood thinner",
                "warning": "Salicin has aspirin-like blood thinning effects."
            }
        ]
    },
    {
        "name": "Omega-3 Fish Oil",
        "category": "supplement",
        "tags": [
            "pain_inflammation",
            "heart",
            "mood"
        ],
        "symptoms": [
            "inflammation",
            "joint pain",
            "high cholesterol",
            "dry skin",
            "low mood",
            "depression"
        ],
        "description": "Essential fatty acids (EPA/DHA) that resolve inflammation and support heart, brain, and joint health.",
        "benefits": [
            "Powerful anti-inflammatory",
            "Supports heart health",
            "Improves mood",
            "Lubricates joints"
        ],
        "dosage": "2000\u20133000mg combined EPA/DHA daily",
        "cautions": [
            "May interact with blood thinners",
            "Choose purified/mercury-tested brands",
            "Take with meals"
        ],
        "amazon_query": "omega 3 fish oil EPA DHA supplement",
        "evidence_level": "strong",
        "references": [
            [
                "Calder: Omega-3 and Inflammation",
                "https://pubmed.ncbi.nlm.nih.gov/25149823/",
                2015
            ],
            [
                "Grosso et al: Omega-3 and Depression",
                "https://pubmed.ncbi.nlm.nih.gov/24805797/",
                2014
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood thinner",
                "warning": "Omega-3 may increase bleeding risk at high doses."
            }
        ]
    },
    {
        "name": "Arnica",
        "category": "herbal",
        "tags": [
            "pain_inflammation",
            "joint_muscle"
        ],
        "symptoms": [
            "muscle pain",
            "swelling",
            "sprain",
            "strain",
            "muscle soreness"
        ],
        "description": "Mountain daisy used topically to reduce bruising, swelling, and post-exercise muscle soreness.",
        "benefits": [
            "Reduces bruising",
            "Eases muscle soreness",
            "Decreases swelling",
            "Speeds recovery from injury"
        ],
        "dosage": "Apply topical gel/cream to affected area 2\u20133x daily",
        "cautions": [
            "Topical use only \u2014 do not ingest",
            "Avoid on broken skin",
            "Daisy family allergy risk"
        ],
        "amazon_query": "arnica gel topical pain relief",
        "evidence_level": "moderate",
        "references": [
            [
                "Iannitti et al: Arnica Montana \u2014 Review",
                "https://pubmed.ncbi.nlm.nih.gov/27023202/",
                2016
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Eucalyptus",
        "category": "herbal",
        "tags": [
            "respiratory"
        ],
        "symptoms": [
            "congestion",
            "cough",
            "sinus pressure",
            "nasal congestion",
            "chest congestion",
            "sinusitis"
        ],
        "description": "Aromatic oil with eucalyptol (1,8-cineole) that opens airways and thins mucus.",
        "benefits": [
            "Clears nasal congestion",
            "Thins mucus",
            "Opens airways",
            "Natural antimicrobial"
        ],
        "dosage": "Steam inhalation with 3\u20135 drops oil, or 200mg cineole capsules",
        "cautions": [
            "Do not ingest essential oil directly",
            "Keep away from young children's faces",
            "May trigger asthma in sensitive individuals"
        ],
        "amazon_query": "eucalyptus essential oil organic",
        "evidence_level": "moderate",
        "references": [
            [
                "Worth & Dethlefsen: Cineole in Acute Bronchitis",
                "https://pubmed.ncbi.nlm.nih.gov/22495631/",
                2012
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": True,
        "interactions": []
    },
    {
        "name": "Licorice Root",
        "category": "herbal",
        "tags": [
            "respiratory",
            "digestive"
        ],
        "symptoms": [
            "sore throat",
            "cough",
            "acid reflux",
            "heartburn",
            "chest congestion"
        ],
        "description": "Sweet root with glycyrrhizin that soothes mucous membranes, calms coughs, and protects stomach lining.",
        "benefits": [
            "Soothes sore throat",
            "Calms coughs",
            "Protects stomach lining",
            "Anti-viral properties"
        ],
        "dosage": "DGL form 380\u2013400mg before meals, or licorice tea 1\u20132x daily",
        "cautions": [
            "Avoid non-DGL form with high blood pressure",
            "Limit to 4\u20136 weeks of use",
            "Can lower potassium"
        ],
        "amazon_query": "DGL licorice root supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Wahab et al: Glycyrrhizin \u2014 Pharmacological Review",
                "https://pubmed.ncbi.nlm.nih.gov/34198867/",
                2021
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood pressure medication",
                "warning": "Non-DGL licorice may raise blood pressure."
            }
        ]
    },
    {
        "name": "Mullein Leaf",
        "category": "herbal",
        "tags": [
            "respiratory"
        ],
        "symptoms": [
            "cough",
            "bronchitis",
            "chest congestion",
            "wheezing",
            "sore throat"
        ],
        "description": "Natural expectorant herb that loosens and expels mucus from the lungs.",
        "benefits": [
            "Natural expectorant",
            "Soothes irritated airways",
            "Supports lung health",
            "Anti-inflammatory"
        ],
        "dosage": "1\u20132 cups mullein tea daily or 500mg capsules 2x daily",
        "cautions": [
            "Strain tea well to remove tiny hairs",
            "Generally very safe"
        ],
        "amazon_query": "mullein leaf tea organic lung support",
        "evidence_level": "traditional",
        "references": [
            [
                "Turker & Camper: Biological Activity of Mullein",
                "https://pubmed.ncbi.nlm.nih.gov/12234405/",
                2002
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Quercetin",
        "category": "supplement",
        "tags": [
            "respiratory",
            "immunity"
        ],
        "symptoms": [
            "allergies",
            "hay fever",
            "sinusitis",
            "nasal congestion",
            "sneezing",
            "inflammation"
        ],
        "description": "Plant flavonoid that stabilizes mast cells, acting as a natural mast cell stabilizer for allergy sufferers.",
        "benefits": [
            "Natural mast cell stabilizer",
            "Reduces allergy symptoms",
            "Anti-inflammatory",
            "Antioxidant support"
        ],
        "dosage": "500\u20131000mg daily with vitamin C and bromelain for absorption",
        "cautions": [
            "May interact with certain antibiotics",
            "Take on empty stomach"
        ],
        "amazon_query": "quercetin supplement with bromelain",
        "evidence_level": "moderate",
        "references": [
            [
                "Mlcek et al: Quercetin and Health",
                "https://pubmed.ncbi.nlm.nih.gov/26999194/",
                2016
            ],
            [
                "Li et al: Quercetin Anti-inflammatory",
                "https://pubmed.ncbi.nlm.nih.gov/26999194/",
                2016
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Rhodiola Rosea",
        "category": "herbal",
        "tags": [
            "energy_focus",
            "sleep_stress",
            "mood"
        ],
        "symptoms": [
            "fatigue",
            "low energy",
            "brain fog",
            "burnout",
            "mental fatigue",
            "low mood"
        ],
        "description": "Arctic adaptogen that enhances cellular energy production and stress resilience.",
        "benefits": [
            "Fights fatigue",
            "Enhances mental performance",
            "Improves stress resilience",
            "Supports mood"
        ],
        "dosage": "200\u2013400mg standardized extract (3% rosavins) in the morning",
        "cautions": [
            "Take early in day (may affect sleep)",
            "Start with lower dose",
            "May interact with SSRIs"
        ],
        "amazon_query": "rhodiola rosea supplement 400mg",
        "evidence_level": "moderate",
        "references": [
            [
                "Ishaque et al: Rhodiola \u2014 Systematic Review",
                "https://pubmed.ncbi.nlm.nih.gov/22643043/",
                2012
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "antidepressants",
                "warning": "May interact with SSRIs/MAOIs."
            }
        ]
    },
    {
        "name": "Panax Ginseng",
        "category": "herbal",
        "tags": [
            "energy_focus",
            "immunity"
        ],
        "symptoms": [
            "fatigue",
            "low energy",
            "poor concentration",
            "weak immunity",
            "exhaustion",
            "lack of motivation"
        ],
        "description": "Traditional adaptogen that enhances physical stamina, mental clarity, and immune function.",
        "benefits": [
            "Boosts physical energy",
            "Enhances cognitive function",
            "Supports immune system",
            "Improves stamina"
        ],
        "dosage": "200\u2013400mg standardized extract daily",
        "cautions": [
            "May raise blood pressure",
            "Avoid with stimulants",
            "Cycle 2 weeks on, 1 week off"
        ],
        "amazon_query": "panax ginseng supplement Korean",
        "evidence_level": "moderate",
        "references": [
            [
                "Geng et al: Ginseng for Cognition",
                "https://pubmed.ncbi.nlm.nih.gov/20737519/",
                2010
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood thinner",
                "warning": "Ginseng may affect blood clotting."
            },
            {
                "med": "diabetes medication",
                "warning": "May lower blood sugar."
            }
        ]
    },
    {
        "name": "Lion's Mane Mushroom",
        "category": "supplement",
        "tags": [
            "energy_focus",
            "mood"
        ],
        "symptoms": [
            "brain fog",
            "poor concentration",
            "memory problems",
            "mental fatigue",
            "poor focus"
        ],
        "description": "Medicinal mushroom shown to increase NGF production in laboratory studies, supporting cognitive function.",
        "benefits": [
            "Supports nerve health",
            "Improves memory and focus",
            "Neuroprotective",
            "Supports mood"
        ],
        "dosage": "500\u20131000mg extract 2x daily",
        "cautions": [
            "Generally very safe",
            "May cause mild digestive upset initially",
            "Avoid if allergic to mushrooms"
        ],
        "amazon_query": "lions mane mushroom supplement extract",
        "evidence_level": "moderate",
        "references": [
            [
                "Mori et al: Lion's Mane and Cognition",
                "https://pubmed.ncbi.nlm.nih.gov/18844328/",
                2009
            ],
            [
                "Saitsu et al: Lion's Mane Cognitive Function",
                "https://pubmed.ncbi.nlm.nih.gov/31413233/",
                2019
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Maca Root",
        "category": "herbal",
        "tags": [
            "energy_focus",
            "mood"
        ],
        "symptoms": [
            "fatigue",
            "low energy",
            "lack of motivation",
            "mood swings",
            "exhaustion"
        ],
        "description": "Peruvian root adaptogen that supports energy, stamina, and hormonal balance without caffeine.",
        "benefits": [
            "Increases energy and stamina",
            "Supports hormonal balance",
            "Enhances mood",
            "Improves endurance"
        ],
        "dosage": "1500\u20133000mg powder or equivalent extract daily",
        "cautions": [
            "Start low and build up",
            "Avoid with hormone-sensitive conditions",
            "May cause jitteriness in some"
        ],
        "amazon_query": "organic maca root powder supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Gonzales et al: Maca \u2014 Biological Review",
                "https://pubmed.ncbi.nlm.nih.gov/22081352/",
                2012
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "B-Complex Vitamins",
        "category": "supplement",
        "tags": [
            "energy_focus",
            "mood"
        ],
        "symptoms": [
            "fatigue",
            "low energy",
            "brain fog",
            "irritability",
            "tiredness",
            "low mood"
        ],
        "description": "Essential B vitamins (B1\u2013B12) \u2014 cofactors in cellular energy production and nervous system function.",
        "benefits": [
            "Supports energy metabolism",
            "Reduces fatigue",
            "Supports nervous system",
            "Enhances mood"
        ],
        "dosage": "1 capsule daily with food \u2014 choose methylated forms",
        "cautions": [
            "May cause bright yellow urine (harmless \u2014 B2)",
            "Choose methylated B12 and folate"
        ],
        "amazon_query": "B complex vitamin methylated supplement",
        "evidence_level": "strong",
        "references": [
            [
                "Kennedy: B Vitamins and the Brain",
                "https://pubmed.ncbi.nlm.nih.gov/26828517/",
                2016
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Green Tea Extract (EGCG)",
        "category": "herbal",
        "tags": [
            "weight",
            "energy_focus"
        ],
        "symptoms": [
            "slow metabolism",
            "weight gain",
            "fatigue",
            "low energy",
            "brain fog"
        ],
        "description": "Concentrated catechins (EGCG) that boost metabolism and provide clean mental energy.",
        "benefits": [
            "Boosts metabolism",
            "Enhances fat oxidation",
            "Provides calm energy",
            "Powerful antioxidant"
        ],
        "dosage": "250\u2013500mg EGCG extract or 3\u20134 cups green tea daily",
        "cautions": [
            "Contains caffeine",
            "Take with food to avoid nausea",
            "Rare liver concerns at very high doses"
        ],
        "amazon_query": "green tea extract EGCG supplement",
        "evidence_level": "strong",
        "references": [
            [
                "Hursel et al: Green Tea and Weight Loss",
                "https://pubmed.ncbi.nlm.nih.gov/19597519/",
                2009
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Neem",
        "category": "ayurvedic",
        "tags": [
            "skin",
            "immunity"
        ],
        "symptoms": [
            "acne",
            "skin irritation",
            "eczema",
            "oily skin",
            "infections",
            "rash"
        ],
        "description": "Ayurvedic 'village pharmacy' with antibacterial, antifungal, and blood-purifying properties.",
        "benefits": [
            "Clears acne",
            "Antibacterial and antifungal",
            "Purifies blood",
            "Reduces skin inflammation"
        ],
        "dosage": "Neem oil topically (diluted), or 500mg leaf capsules daily",
        "cautions": [
            "Very bitter taste internally",
            "Do not use during pregnancy",
            "Dilute oil before skin application"
        ],
        "amazon_query": "neem oil organic skin care",
        "evidence_level": "traditional",
        "references": [
            [
                "Alzohairy: Neem Therapeutics \u2014 Review",
                "https://pubmed.ncbi.nlm.nih.gov/27559512/",
                2016
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Aloe Vera",
        "category": "herbal",
        "tags": [
            "skin",
            "digestive"
        ],
        "symptoms": [
            "dry skin",
            "skin irritation",
            "rash",
            "acid reflux",
            "itching",
            "redness"
        ],
        "description": "Succulent plant gel rich in polysaccharides that hydrate, soothe inflammation, and accelerate skin healing.",
        "benefits": [
            "Deeply hydrates skin",
            "Soothes sunburn and irritation",
            "Promotes wound healing",
            "Supports digestive lining"
        ],
        "dosage": "Gel applied topically as needed, or 1\u20132 oz juice for digestive use",
        "cautions": [
            "Internal use may cause cramping",
            "Topical generally very safe",
            "Patch test first"
        ],
        "amazon_query": "organic aloe vera gel pure",
        "evidence_level": "moderate",
        "references": [
            [
                "Mahor & Ali: Aloe Vera \u2014 Review",
                "https://pubmed.ncbi.nlm.nih.gov/26309411/",
                2016
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Tea Tree Oil",
        "category": "herbal",
        "tags": [
            "skin"
        ],
        "symptoms": [
            "acne",
            "itching",
            "rash",
            "oily skin"
        ],
        "description": "Australian essential oil with terpinen-4-ol that fights acne-causing bacteria and fungal infections.",
        "benefits": [
            "Fights acne bacteria",
            "Antifungal properties",
            "Reduces skin inflammation",
            "Natural antiseptic"
        ],
        "dosage": "5% diluted solution applied topically to affected areas",
        "cautions": [
            "Never ingest",
            "Always dilute before applying",
            "May irritate sensitive skin \u2014 patch test"
        ],
        "amazon_query": "tea tree oil organic skin care",
        "evidence_level": "moderate",
        "references": [
            [
                "Hammer et al: Tea Tree Oil Antimicrobial",
                "https://pubmed.ncbi.nlm.nih.gov/25922485/",
                2015
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Collagen Peptides",
        "category": "supplement",
        "tags": [
            "skin",
            "joint_muscle"
        ],
        "symptoms": [
            "aging skin",
            "wrinkles",
            "dry skin",
            "joint stiffness",
            "brittle hair"
        ],
        "description": "Hydrolyzed collagen protein providing building blocks for skin elasticity and joint cartilage.",
        "benefits": [
            "Improves skin elasticity",
            "Reduces wrinkles",
            "Supports joint health",
            "Strengthens hair and nails"
        ],
        "dosage": "10\u201315g powder daily in water, smoothies, or coffee",
        "cautions": [
            "Marine collagen for pescatarians",
            "Results take 4\u20138 weeks",
            "Choose grass-fed/pasture-raised"
        ],
        "amazon_query": "collagen peptides powder grass fed",
        "evidence_level": "moderate",
        "references": [
            [
                "Bolke et al: Collagen Supplements and Skin",
                "https://pubmed.ncbi.nlm.nih.gov/30681787/",
                2019
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Glucosamine & Chondroitin",
        "category": "supplement",
        "tags": [
            "joint_muscle"
        ],
        "symptoms": [
            "joint pain",
            "arthritis",
            "joint stiffness",
            "knee pain"
        ],
        "description": "Cartilage building blocks that support joint structure, lubrication, and repair.",
        "benefits": [
            "Supports cartilage repair",
            "Reduces joint pain",
            "Improves joint mobility",
            "Slows cartilage degradation"
        ],
        "dosage": "1500mg glucosamine + 1200mg chondroitin daily",
        "cautions": [
            "Shellfish-derived (alternatives available)",
            "Takes 4\u20138 weeks for results",
            "May affect blood sugar"
        ],
        "amazon_query": "glucosamine chondroitin joint supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Zeng et al: Glucosamine \u2014 Meta-Analysis",
                "https://pubmed.ncbi.nlm.nih.gov/25589511/",
                2015
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "MSM (Methylsulfonylmethane)",
        "category": "supplement",
        "tags": [
            "joint_muscle",
            "pain_inflammation"
        ],
        "symptoms": [
            "joint pain",
            "muscle pain",
            "inflammation",
            "arthritis",
            "stiffness",
            "muscle soreness"
        ],
        "description": "Organic sulfur compound supporting connective tissue and reducing exercise-induced inflammation.",
        "benefits": [
            "Reduces joint inflammation",
            "Supports connective tissue",
            "Speeds recovery",
            "Reduces exercise-induced pain"
        ],
        "dosage": "1000\u20133000mg daily in divided doses",
        "cautions": [
            "Generally very safe",
            "May cause mild digestive upset initially",
            "Start low"
        ],
        "amazon_query": "MSM supplement joint support",
        "evidence_level": "moderate",
        "references": [
            [
                "Butawan et al: MSM \u2014 Review",
                "https://pubmed.ncbi.nlm.nih.gov/28300758/",
                2017
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Bhringraj",
        "category": "ayurvedic",
        "tags": [
            "hair"
        ],
        "symptoms": [
            "hair loss",
            "thinning hair",
            "premature graying",
            "slow hair growth"
        ],
        "description": "Known as 'King of Hair' in Ayurvedic tradition. Limited clinical data, but long history of traditional use.",
        "benefits": [
            "Traditionally used for hair growth",
            "May prevent premature graying",
            "Strengthens hair follicles",
            "Nourishes scalp"
        ],
        "dosage": "Bhringraj oil massage 2\u20133x weekly, or 500mg capsules daily",
        "cautions": [
            "Patch test oil first",
            "Generally very safe",
            "Best with consistent use"
        ],
        "amazon_query": "bhringraj oil hair growth ayurvedic",
        "evidence_level": "traditional",
        "references": [
            [
                "Roy et al: Bhringraj Hair Growth \u2014 Animal Study",
                "https://pubmed.ncbi.nlm.nih.gov/19138864/",
                2008
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Biotin (Vitamin B7)",
        "category": "supplement",
        "tags": [
            "hair",
            "skin"
        ],
        "symptoms": [
            "hair loss",
            "thinning hair",
            "brittle hair",
            "slow hair growth"
        ],
        "description": "Essential B vitamin supporting keratin production. Most beneficial for those with biotin deficiency.",
        "benefits": [
            "Strengthens hair if deficient",
            "Reduces hair shedding",
            "Strengthens nails",
            "Supports skin health"
        ],
        "dosage": "2500\u20135000mcg daily",
        "cautions": [
            "Can interfere with certain blood tests (inform your lab)",
            "Results take 3\u20136 months",
            "Greatest benefit if actually deficient"
        ],
        "amazon_query": "biotin supplement 5000mcg hair growth",
        "evidence_level": "moderate",
        "references": [
            [
                "Patel et al: Biotin for Hair and Nails",
                "https://pubmed.ncbi.nlm.nih.gov/28879195/",
                2017
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "St. John's Wort",
        "category": "herbal",
        "tags": [
            "mood"
        ],
        "symptoms": [
            "depression",
            "low mood",
            "sadness",
            "seasonal affective",
            "mood swings"
        ],
        "description": "Well-studied herbal antidepressant containing hypericin and hyperforin. Effective for mild-to-moderate depression.",
        "benefits": [
            "Supports positive mood",
            "Reduces mild depression symptoms",
            "Eases seasonal mood changes",
            "Well-researched"
        ],
        "dosage": "300mg standardized extract (0.3% hypericin) 3x daily",
        "cautions": [
            "MANY drug interactions \u2014 check with pharmacist",
            "Causes sun sensitivity",
            "Do NOT combine with SSRIs/MAOIs",
            "Takes 4\u20136 weeks for full effect"
        ],
        "amazon_query": "St Johns Wort supplement 300mg",
        "evidence_level": "strong",
        "references": [
            [
                "Linde et al: St. John's Wort \u2014 Cochrane Review",
                "https://pubmed.ncbi.nlm.nih.gov/18843608/",
                2008
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "antidepressants",
                "warning": "DANGEROUS combination with SSRIs \u2014 risk of serotonin syndrome."
            },
            {
                "med": "blood thinner",
                "warning": "Reduces effectiveness of warfarin."
            }
        ]
    },
    {
        "name": "Saffron Extract",
        "category": "ayurvedic",
        "tags": [
            "mood",
            "sleep_stress"
        ],
        "symptoms": [
            "depression",
            "low mood",
            "anxiety",
            "sadness",
            "mood swings",
            "emotional imbalance"
        ],
        "description": "Precious spice with crocin and safranal. Small-scale clinical trials show mood-improving effects.",
        "benefits": [
            "Clinically studied mood support",
            "Reduces anxiety in some trials",
            "Supports emotional balance",
            "Antioxidant properties"
        ],
        "dosage": "30mg standardized extract daily",
        "cautions": [
            "Expensive but effective",
            "Avoid in pregnancy (high doses)",
            "Generally well tolerated"
        ],
        "amazon_query": "saffron extract supplement mood support",
        "evidence_level": "moderate",
        "references": [
            [
                "Hausenblas et al: Saffron and Depression",
                "https://pubmed.ncbi.nlm.nih.gov/23647535/",
                2013
            ],
            [
                "Mazidi et al: Saffron Meta-Analysis",
                "https://pubmed.ncbi.nlm.nih.gov/27101556/",
                2016
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "5-HTP",
        "category": "supplement",
        "tags": [
            "mood",
            "sleep_stress"
        ],
        "symptoms": [
            "depression",
            "low mood",
            "insomnia",
            "anxiety",
            "sadness"
        ],
        "description": "Natural precursor to serotonin derived from Griffonia bean. Supports mood and sleep by increasing serotonin.",
        "benefits": [
            "Supports serotonin production",
            "May improve mood",
            "Promotes better sleep",
            "Reduces anxiety in some"
        ],
        "dosage": "50\u2013100mg 1\u20133 times daily",
        "cautions": [
            "Do NOT combine with SSRIs/MAOIs (serotonin syndrome risk)",
            "Start with low dose",
            "May cause GI upset"
        ],
        "amazon_query": "5-HTP supplement 100mg",
        "evidence_level": "moderate",
        "references": [
            [
                "Birdsall: 5-HTP Therapeutic Review",
                "https://pubmed.ncbi.nlm.nih.gov/9727088/",
                1998
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "antidepressants",
                "warning": "DANGEROUS \u2014 risk of serotonin syndrome when combined."
            }
        ]
    },
    {
        "name": "Garcinia Cambogia",
        "category": "herbal",
        "tags": [
            "weight"
        ],
        "symptoms": [
            "appetite control",
            "cravings",
            "weight gain",
            "overeating"
        ],
        "description": "Tropical fruit rind containing HCA. Evidence is limited and effects are modest \u2014 works best with diet/exercise.",
        "benefits": [
            "May modestly reduce appetite",
            "May inhibit fat storage",
            "Supports weight management",
            "Curbs cravings"
        ],
        "dosage": "500\u20131000mg HCA 30\u201360 minutes before meals",
        "cautions": [
            "Modest effects \u2014 works best with diet/exercise",
            "May cause digestive upset",
            "Avoid with statins"
        ],
        "amazon_query": "garcinia cambogia supplement HCA",
        "evidence_level": "traditional",
        "references": [
            [
                "Onakpoya et al: Garcinia \u2014 Systematic Review",
                "https://pubmed.ncbi.nlm.nih.gov/21250783/",
                2011
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Berberine",
        "category": "supplement",
        "tags": [
            "blood_sugar",
            "weight",
            "heart"
        ],
        "symptoms": [
            "blood sugar",
            "insulin resistance",
            "sugar cravings",
            "high cholesterol",
            "weight gain",
            "metabolic syndrome"
        ],
        "description": "Plant alkaloid with strong evidence for blood sugar and metabolic health. Sometimes called 'nature's metformin.'",
        "benefits": [
            "Supports healthy blood sugar levels",
            "Improves insulin sensitivity",
            "May lower cholesterol",
            "Supports weight management"
        ],
        "dosage": "500mg 2\u20133 times daily with meals",
        "cautions": [
            "May cause GI upset initially",
            "Don't combine with metformin without doctor supervision",
            "Can lower blood sugar significantly"
        ],
        "amazon_query": "berberine supplement 500mg",
        "evidence_level": "strong",
        "references": [
            [
                "Liang et al: Berberine for Type 2 Diabetes",
                "https://pubmed.ncbi.nlm.nih.gov/30466985/",
                2019
            ],
            [
                "Yin et al: Berberine vs Metformin",
                "https://pubmed.ncbi.nlm.nih.gov/18442638/",
                2008
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "diabetes medication",
                "warning": "May cause dangerously low blood sugar when combined with diabetes drugs."
            }
        ]
    },
    {
        "name": "Hawthorn Berry",
        "category": "herbal",
        "tags": [
            "heart"
        ],
        "symptoms": [
            "palpitations",
            "high blood pressure",
            "poor circulation"
        ],
        "description": "Heart tonic rich in oligomeric procyanidins that strengthen heart muscle and improve blood flow.",
        "benefits": [
            "Supports heart muscle function",
            "Improves circulation",
            "Mild blood pressure support",
            "Rich in antioxidants"
        ],
        "dosage": "250\u2013500mg standardized extract 2\u20133x daily",
        "cautions": [
            "May interact with heart medications",
            "Takes several weeks for effect",
            "Consult doctor if on cardiac drugs"
        ],
        "amazon_query": "hawthorn berry supplement heart",
        "evidence_level": "moderate",
        "references": [
            [
                "Pittler et al: Hawthorn for Heart Failure",
                "https://pubmed.ncbi.nlm.nih.gov/18254076/",
                2008
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood pressure medication",
                "warning": "May enhance blood pressure lowering effects."
            }
        ]
    },
    {
        "name": "CoQ10 (Ubiquinol)",
        "category": "supplement",
        "tags": [
            "heart",
            "energy_focus"
        ],
        "symptoms": [
            "fatigue",
            "low energy",
            "palpitations",
            "high blood pressure",
            "muscle weakness"
        ],
        "description": "Essential coenzyme for mitochondrial energy. Levels decline with age and are depleted by statins.",
        "benefits": [
            "Supports heart energy",
            "Powerful antioxidant",
            "Essential if on statins",
            "Boosts cellular energy"
        ],
        "dosage": "100\u2013300mg ubiquinol form daily with fatty meal",
        "cautions": [
            "Ubiquinol form better absorbed",
            "May lower blood pressure slightly",
            "Check with doctor if on blood thinners"
        ],
        "amazon_query": "CoQ10 ubiquinol supplement 200mg",
        "evidence_level": "strong",
        "references": [
            [
                "Mortensen et al: CoQ10 in Heart Failure",
                "https://pubmed.ncbi.nlm.nih.gov/25282031/",
                2014
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood thinner",
                "warning": "May reduce warfarin effectiveness."
            }
        ]
    },
    {
        "name": "Guggul",
        "category": "ayurvedic",
        "tags": [
            "heart",
            "weight"
        ],
        "symptoms": [
            "high cholesterol",
            "weight gain",
            "slow metabolism",
            "inflammation"
        ],
        "description": "Ayurvedic resin traditionally used for lipid balance. Clinical results have been mixed in Western studies.",
        "benefits": [
            "Traditionally supports cholesterol levels",
            "May boost metabolism",
            "Anti-inflammatory",
            "Traditional detoxifier"
        ],
        "dosage": "500\u20131000mg standardized extract (guggulsterones) daily",
        "cautions": [
            "May interact with thyroid medication",
            "May affect blood clotting",
            "GI upset possible"
        ],
        "amazon_query": "guggul extract supplement cholesterol",
        "evidence_level": "traditional",
        "references": [
            [
                "Szapary et al: Guggulipid for Hypercholesterolemia",
                "https://pubmed.ncbi.nlm.nih.gov/12917222/",
                2003
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "thyroid medication",
                "warning": "May alter thyroid hormone levels."
            }
        ]
    },
    {
        "name": "Arjuna Bark",
        "category": "ayurvedic",
        "tags": [
            "heart"
        ],
        "symptoms": [
            "high blood pressure",
            "palpitations",
            "poor circulation",
            "high cholesterol"
        ],
        "description": "Ayurvedic heart tonic from Terminalia arjuna bark. Used for cardiovascular support in Indian medicine for centuries.",
        "benefits": [
            "Supports heart function",
            "May reduce blood pressure",
            "Antioxidant for heart tissue",
            "Traditional cardiotonic"
        ],
        "dosage": "500mg bark extract 2x daily",
        "cautions": [
            "Consult doctor if on heart medications",
            "May enhance blood pressure medication effects",
            "Monitor blood pressure"
        ],
        "amazon_query": "arjuna bark supplement heart",
        "evidence_level": "moderate",
        "references": [
            [
                "Dwivedi & Jauhari: Arjuna Cardioprotective",
                "https://pubmed.ncbi.nlm.nih.gov/9234163/",
                1997
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood pressure medication",
                "warning": "May enhance BP-lowering effects."
            }
        ]
    },
    {
        "name": "Vitex (Chasteberry)",
        "category": "herbal",
        "tags": [
            "womens_health",
            "mood"
        ],
        "symptoms": [
            "pms",
            "period cramps",
            "menstrual pain",
            "irregular periods",
            "hormonal imbalance",
            "mood swings menstrual",
            "breast tenderness"
        ],
        "description": "Berry extract that modulates prolactin and supports hormonal balance. Well-studied for PMS relief.",
        "benefits": [
            "Reduces PMS symptoms",
            "Regulates menstrual cycles",
            "Eases breast tenderness",
            "Supports hormonal balance"
        ],
        "dosage": "20\u201340mg standardized extract daily",
        "cautions": [
            "Takes 2\u20133 cycles for full effect",
            "Avoid with hormonal contraceptives",
            "Not for use during pregnancy"
        ],
        "amazon_query": "vitex chasteberry supplement",
        "evidence_level": "strong",
        "references": [
            [
                "Csupor et al: Vitex for PMS \u2014 Systematic Review",
                "https://pubmed.ncbi.nlm.nih.gov/30887855/",
                2019
            ],
            [
                "Schellenberg: Vitex for PMS \u2014 RCT",
                "https://pubmed.ncbi.nlm.nih.gov/11159568/",
                2001
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "antidepressants",
                "warning": "May interact with dopaminergic drugs."
            }
        ]
    },
    {
        "name": "Shatavari",
        "category": "ayurvedic",
        "tags": [
            "womens_health",
            "immunity"
        ],
        "symptoms": [
            "hormonal imbalance",
            "menopause",
            "hot flashes",
            "irregular periods",
            "weak immunity"
        ],
        "description": "Queen of Herbs in Ayurveda for women's health. Adaptogenic root supporting hormonal balance across life stages.",
        "benefits": [
            "Supports hormonal transitions",
            "Eases menopausal symptoms",
            "Adaptogenic immune support",
            "Nourishes reproductive system"
        ],
        "dosage": "500\u20131000mg root extract daily",
        "cautions": [
            "Avoid with hormone-sensitive conditions",
            "May cause weight gain in some",
            "Asparagus family \u2014 avoid if allergic"
        ],
        "amazon_query": "shatavari supplement organic",
        "evidence_level": "traditional",
        "references": [
            [
                "Alok et al: Shatavari Pharmacological Review",
                "https://pubmed.ncbi.nlm.nih.gov/23704215/",
                2013
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Evening Primrose Oil",
        "category": "supplement",
        "tags": [
            "womens_health",
            "skin"
        ],
        "symptoms": [
            "pms",
            "breast tenderness",
            "hormonal imbalance",
            "eczema",
            "dry skin"
        ],
        "description": "Rich in gamma-linolenic acid (GLA) \u2014 an anti-inflammatory omega-6 fatty acid supporting hormonal and skin health.",
        "benefits": [
            "Reduces PMS breast pain",
            "Supports skin hydration",
            "Anti-inflammatory GLA",
            "Hormonal balance support"
        ],
        "dosage": "500\u20131000mg GLA-standardized oil daily",
        "cautions": [
            "May increase bleeding risk with blood thinners",
            "Takes 2\u20133 months for full effect",
            "Choose cold-pressed"
        ],
        "amazon_query": "evening primrose oil supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Mahboubi: Evening Primrose for PMS",
                "https://pubmed.ncbi.nlm.nih.gov/28155711/",
                2019
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood thinner",
                "warning": "May increase bleeding risk."
            }
        ]
    },
    {
        "name": "Black Cohosh",
        "category": "herbal",
        "tags": [
            "womens_health"
        ],
        "symptoms": [
            "menopause",
            "hot flashes",
            "mood swings menstrual"
        ],
        "description": "Native American herb used for menopausal symptom relief. Moderate evidence for reducing hot flash frequency.",
        "benefits": [
            "Reduces hot flash frequency",
            "Supports menopausal transition",
            "May improve sleep during menopause",
            "Non-hormonal option"
        ],
        "dosage": "20\u201340mg standardized extract daily",
        "cautions": [
            "Limit use to 6 months",
            "Rare liver toxicity reports \u2014 monitor",
            "Avoid during pregnancy"
        ],
        "amazon_query": "black cohosh supplement menopause",
        "evidence_level": "moderate",
        "references": [
            [
                "Leach & Moore: Black Cohosh \u2014 Cochrane Review",
                "https://pubmed.ncbi.nlm.nih.gov/22161372/",
                2012
            ]
        ],
        "unsafe_pregnancy": True,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Milk Thistle (Silymarin)",
        "category": "herbal",
        "tags": [
            "liver_detox"
        ],
        "symptoms": [
            "liver support",
            "hangover",
            "detox",
            "fatty liver",
            "toxin buildup"
        ],
        "description": "Silymarin flavonoid complex that protects liver cells from toxins and supports regeneration.",
        "benefits": [
            "Protects liver cells",
            "Supports liver regeneration",
            "Antioxidant for liver tissue",
            "May improve liver enzyme levels"
        ],
        "dosage": "200\u2013400mg silymarin extract daily",
        "cautions": [
            "Generally very safe",
            "May cause mild laxative effect",
            "May lower blood sugar slightly"
        ],
        "amazon_query": "milk thistle silymarin supplement",
        "evidence_level": "strong",
        "references": [
            [
                "Saller et al: Milk Thistle for Liver Disease",
                "https://pubmed.ncbi.nlm.nih.gov/11678576/",
                2001
            ],
            [
                "Abenavoli et al: Milk Thistle Hepatoprotection",
                "https://pubmed.ncbi.nlm.nih.gov/20564545/",
                2010
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "diabetes medication",
                "warning": "May lower blood sugar."
            }
        ]
    },
    {
        "name": "Dandelion Root",
        "category": "herbal",
        "tags": [
            "liver_detox",
            "digestive"
        ],
        "symptoms": [
            "liver support",
            "detox",
            "bloating",
            "water retention",
            "sluggish liver",
            "constipation"
        ],
        "description": "Common weed root with potent diuretic and liver-supporting properties. Rich in prebiotic inulin fiber.",
        "benefits": [
            "Supports liver detoxification",
            "Natural diuretic",
            "Rich in prebiotic fiber",
            "Supports digestion"
        ],
        "dosage": "500\u20131000mg root extract or 2\u20133 cups tea daily",
        "cautions": [
            "May interact with diuretics",
            "Avoid with bile duct obstruction",
            "Ragweed allergy cross-reactivity"
        ],
        "amazon_query": "dandelion root tea organic",
        "evidence_level": "traditional",
        "references": [
            [
                "Clare et al: Dandelion Diuretic Effect",
                "https://pubmed.ncbi.nlm.nih.gov/19678785/",
                2009
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": []
    },
    {
        "name": "Gymnema Sylvestre",
        "category": "ayurvedic",
        "tags": [
            "blood_sugar"
        ],
        "symptoms": [
            "blood sugar",
            "sugar cravings",
            "insulin resistance",
            "pre diabetes"
        ],
        "description": "Ayurvedic 'sugar destroyer' \u2014 temporarily blocks sweet taste receptors and supports insulin function.",
        "benefits": [
            "Reduces sugar cravings",
            "Supports healthy blood sugar",
            "May improve insulin function",
            "Traditional 'sugar destroyer'"
        ],
        "dosage": "400\u2013800mg standardized extract daily",
        "cautions": [
            "Monitor blood sugar closely",
            "May enhance diabetes medication effects",
            "Take before meals"
        ],
        "amazon_query": "gymnema sylvestre supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Khan et al: Gymnema for Diabetes",
                "https://pubmed.ncbi.nlm.nih.gov/31307168/",
                2019
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "diabetes medication",
                "warning": "May cause low blood sugar when combined."
            }
        ]
    },
    {
        "name": "Cinnamon Extract",
        "category": "herbal",
        "tags": [
            "blood_sugar",
            "digestive"
        ],
        "symptoms": [
            "blood sugar",
            "insulin resistance",
            "sugar cravings",
            "indigestion",
            "glucose control"
        ],
        "description": "Ceylon cinnamon extract shown in some studies to modestly improve insulin sensitivity and fasting glucose.",
        "benefits": [
            "May improve insulin sensitivity",
            "Supports glucose metabolism",
            "Anti-inflammatory",
            "Antioxidant properties"
        ],
        "dosage": "500mg Ceylon cinnamon extract daily",
        "cautions": [
            "Use Ceylon variety (not Cassia \u2014 liver risk)",
            "Modest effects",
            "Monitor blood sugar if on medication"
        ],
        "amazon_query": "ceylon cinnamon extract supplement",
        "evidence_level": "moderate",
        "references": [
            [
                "Allen et al: Cinnamon for Blood Sugar",
                "https://pubmed.ncbi.nlm.nih.gov/24019277/",
                2013
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "diabetes medication",
                "warning": "May lower blood sugar."
            }
        ]
    },
    {
        "name": "Fenugreek",
        "category": "ayurvedic",
        "tags": [
            "blood_sugar",
            "digestive",
            "womens_health"
        ],
        "symptoms": [
            "blood sugar",
            "insulin resistance",
            "indigestion",
            "low milk supply",
            "glucose control"
        ],
        "description": "Ayurvedic seed used for blood sugar support and lactation. Contains galactomannan fiber that slows glucose absorption.",
        "benefits": [
            "Supports blood sugar control",
            "Soluble fiber slows glucose absorption",
            "Traditional galactagogue",
            "Supports digestion"
        ],
        "dosage": "500\u20131000mg seed extract daily before meals",
        "cautions": [
            "May cause GI gas initially",
            "Maple syrup-like body odor at high doses",
            "May interact with diabetes drugs"
        ],
        "amazon_query": "fenugreek supplement blood sugar",
        "evidence_level": "moderate",
        "references": [
            [
                "Neelakantan et al: Fenugreek for Glycemic Control",
                "https://pubmed.ncbi.nlm.nih.gov/25185839/",
                2014
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "diabetes medication",
                "warning": "May enhance blood sugar lowering effects."
            },
            {
                "med": "blood thinner",
                "warning": "May increase bleeding risk."
            }
        ]
    },
    {
        "name": "Cranberry Extract",
        "category": "supplement",
        "tags": [
            "urinary",
            "immunity"
        ],
        "symptoms": [
            "uti",
            "bladder infection",
            "frequent urination",
            "urinary tract"
        ],
        "description": "Concentrated proanthocyanidins (PACs) that prevent bacteria from adhering to urinary tract walls.",
        "benefits": [
            "Prevents UTI recurrence",
            "Anti-adhesion properties",
            "Rich in antioxidants",
            "Supports urinary tract health"
        ],
        "dosage": "500mg standardized extract (36mg PACs) daily",
        "cautions": [
            "Prevention \u2014 not treatment for active UTI",
            "May interact with blood thinners",
            "Choose PAC-standardized supplements"
        ],
        "amazon_query": "cranberry extract supplement UTI",
        "evidence_level": "strong",
        "references": [
            [
                "Jepson et al: Cranberries for UTI \u2014 Cochrane",
                "https://pubmed.ncbi.nlm.nih.gov/23235689/",
                2012
            ]
        ],
        "unsafe_pregnancy": False,
        "unsafe_children": False,
        "interactions": [
            {
                "med": "blood thinner",
                "warning": "May enhance warfarin effects."
            }
        ]
    }
]

def get_matching_remedies(symptoms, answers):
    return _match(REMEDIES, SYMPTOM_CATEGORIES, symptoms, answers)
